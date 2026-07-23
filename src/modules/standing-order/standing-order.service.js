const crypto = require("crypto");

const repository = require("./standing-order.repository");

const { advance } = require("./frequency.util");

const otpService = require("../otp/otp.service");

const fraudService = require("../fraud/fraud.service");

const limitsService = require("../limits/limits.service");

const { client: accountClient } = require("../../integrations/account");

const config = require("../../config/app.config");

const {
    NotFoundError,
    AuthorizationError,
    BusinessRuleError,
    ValidationError
} = require("../../errors");

class StandingOrderService {

    /**
     * ==========================================================
     * Initiate Standing Order
     * ==========================================================
     */
    async initiate(user, data, request) {

        const {
            destinationAccountNumber,
            destinationBankCode,
            amount,
            narration,
            frequency,
            startDate,
            endDate,
            maxExecutions
        } = data;

        const sourceAccount =
            await accountClient.getAccount(
                user.accountNumber,
                { correlationId: request.correlationId }
            );

        if (sourceAccount.status !== "ACTIVE") {

            throw new BusinessRuleError(
                "Source account is not active."
            );

        }

        if (sourceAccount.accountNumber === destinationAccountNumber) {

            throw new ValidationError(
                "Source and destination accounts must be different."
            );

        }

        await limitsService.check({
            userId: user.userId,
            amount
        });

        const fraudResult =
            await fraudService.assess({
                amount
            });

        if (fraudResult.decision === "BLOCK") {

            throw new BusinessRuleError(
                "This standing order cannot be created."
            );

        }

        const reference =
            `SO${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

        const order =
            await repository.create({

                initiatorUserId:
                    user.userId,

                sourceAccountNumber:
                    sourceAccount.accountNumber,

                destinationAccountNumber,

                destinationBankCode:
                    destinationBankCode || null,

                amount,

                narration,

                reference,

                frequency,

                startDate:
                    new Date(startDate),

                endDate:
                    endDate ? new Date(endDate) : null,

                maxExecutions:
                    maxExecutions || null,

                statusHistory: [{

                    status: "PENDING_OTP",

                    message: "Standing order initiated.",

                    changedAt: new Date()

                }]

            });

        const otpResult =
            await otpService.sendTransferOtp(
                order.id,
                {
                    email: sourceAccount.email,
                    phoneNumber: sourceAccount.phoneNumber
                }
            );

        await repository.updateStatus(
            order.id,
            {
                status: "PENDING_OTP",
                message: "OTP sent.",
                extra: {
                    otpChannel: otpResult.channel
                }
            }
        );

        const response = {

            standingOrderId: order.id,

            reference,

            status: "PENDING_OTP",

            expiresAt: otpResult.expiresAt

        };

        if (!config.isProduction) {

            response.otp = otpResult.code;

        }

        return response;

    }

    /**
     * ==========================================================
     * Confirm Standing Order
     * ==========================================================
     *
     * Verifies the OTP once, activates the order, and computes
     * the first nextRunAt. Recurring occurrences are executed
     * by the scheduler without further OTP prompts.
     */
    async confirm(user, orderId, code) {

        const order =
            await repository.findById(orderId);

        if (!order) {

            throw new NotFoundError(
                "Standing order not found."
            );

        }

        if (order.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This standing order does not belong to you."
            );

        }

        if (order.status !== "PENDING_OTP") {

            throw new BusinessRuleError(
                `Standing order is already ${order.status.toLowerCase()}.`
            );

        }

        await otpService.verifyTransferOtp(
            order.id,
            code,
            order.otpChannel
        );

        const nextRunAt =
            order.startDate > new Date()
                ? order.startDate
                : advance(new Date(), order.frequency);

        const activated =
            await repository.transitionStatus(
                order.id,
                {
                    fromStatus: "PENDING_OTP",
                    status: "ACTIVE",
                    message: "OTP verified, standing order active.",
                    extra: {
                        nextRunAt
                    }
                }
            );

        if (!activated) {

            throw new BusinessRuleError(
                "This standing order has already been confirmed."
            );

        }

        return {

            standingOrderId: activated.id,

            status: activated.status,

            nextRunAt: activated.nextRunAt

        };

    }

    /**
     * ==========================================================
     * Cancel / Pause / Resume
     * ==========================================================
     */
    async cancel(user, orderId) {

        const order =
            await this.getOwned(user, orderId);

        if (["CANCELLED", "COMPLETED"].includes(order.status)) {

            throw new BusinessRuleError(
                `Standing order is already ${order.status.toLowerCase()}.`
            );

        }

        const updated =
            await repository.updateStatus(
                order.id,
                {
                    status: "CANCELLED",
                    message: "Cancelled by user."
                }
            );

        return this.toPublicShape(updated);

    }

    async pause(user, orderId) {

        const order =
            await this.getOwned(user, orderId);

        if (order.status !== "ACTIVE") {

            throw new BusinessRuleError(
                "Only an active standing order can be paused."
            );

        }

        const updated =
            await repository.updateStatus(
                order.id,
                {
                    status: "PAUSED",
                    message: "Paused by user."
                }
            );

        return this.toPublicShape(updated);

    }

    async resume(user, orderId) {

        const order =
            await this.getOwned(user, orderId);

        if (order.status !== "PAUSED") {

            throw new BusinessRuleError(
                "Only a paused standing order can be resumed."
            );

        }

        const nextRunAt =
            advance(new Date(), order.frequency);

        const updated =
            await repository.updateStatus(
                order.id,
                {
                    status: "ACTIVE",
                    message: "Resumed by user.",
                    extra: {
                        nextRunAt
                    }
                }
            );

        return this.toPublicShape(updated);

    }

    /**
     * ==========================================================
     * Get / History
     * ==========================================================
     */
    async getOwned(user, orderId) {

        const order =
            await repository.findById(orderId);

        if (!order) {

            throw new NotFoundError(
                "Standing order not found."
            );

        }

        if (order.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This standing order does not belong to you."
            );

        }

        return order;

    }

    async getById(user, orderId) {

        const order =
            await this.getOwned(user, orderId);

        return this.toPublicShape(order);

    }

    async history(user, { page, limit }) {

        const [
            orders,
            total
        ] = await Promise.all([

            repository.findByUserId(
                user.userId,
                { page, limit }
            ),

            repository.countByUserId(
                user.userId
            )

        ]);

        return {

            standingOrders:
                orders.map(
                    (order) => this.toPublicShape(order)
                ),

            pagination: {
                page,
                limit,
                total
            }

        };

    }

    toPublicShape(order) {

        return {

            id: order.id,

            reference: order.reference,

            sourceAccountNumber: order.sourceAccountNumber,

            destinationAccountNumber: order.destinationAccountNumber,

            destinationBankCode: order.destinationBankCode,

            amount: order.amount,

            narration: order.narration,

            frequency: order.frequency,

            startDate: order.startDate,

            endDate: order.endDate,

            nextRunAt: order.nextRunAt,

            maxExecutions: order.maxExecutions,

            executionCount: order.executionCount,

            status: order.status,

            statusHistory: order.statusHistory,

            createdAt: order.createdAt

        };

    }

}

module.exports = new StandingOrderService();
