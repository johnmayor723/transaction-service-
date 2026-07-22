const crypto = require("crypto");

const repository = require("./bulk-transfer.repository");

const transferRepository = require("../transfer/transfer.repository");

const transferService = require("../transfer/transfer.service");

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

class BulkTransferService {

    /**
     * ==========================================================
     * Initiate Bulk Transfer
     * ==========================================================
     *
     * One OTP authorizes the whole batch. Items are internal
     * transfers only (own-account/same-bank) — no NIP in a
     * bulk batch for v1.
     */
    async initiate(user, data, request) {

        const {
            items,
            narration
        } = data;

        if (!items || items.length === 0) {

            throw new ValidationError(
                "At least one item is required."
            );

        }

        if (items.length > config.bulkTransfer.maxItems) {

            throw new ValidationError(
                `A bulk transfer cannot contain more than ${config.bulkTransfer.maxItems} items.`
            );

        }

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

        const totalAmount =
            items.reduce(
                (sum, item) => sum + item.amount,
                0
            );

        await limitsService.check({
            userId: user.userId,
            amount: totalAmount
        });

        const fraudResult =
            await fraudService.assess({
                amount: totalAmount
            });

        if (fraudResult.decision === "BLOCK") {

            throw new BusinessRuleError(
                "This bulk transfer cannot be processed."
            );

        }

        const reference =
            `BLK${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

        const bulkTransfer =
            await repository.create({

                initiatorUserId:
                    user.userId,

                sourceAccountNumber:
                    sourceAccount.accountNumber,

                reference,

                totalAmount,

                itemCount:
                    items.length,

                items:
                    items.map((item) => ({

                        destinationAccountNumber:
                            item.destinationAccountNumber,

                        amount:
                            item.amount,

                        narration:
                            item.narration || narration || null,

                        status: "PENDING"

                    })),

                statusHistory: [{

                    status: "PENDING_OTP",

                    message: "Bulk transfer initiated.",

                    changedAt: new Date()

                }]

            });

        const otpResult =
            await otpService.sendTransferOtp(
                bulkTransfer.id,
                {
                    email: sourceAccount.email,
                    phoneNumber: sourceAccount.phoneNumber
                }
            );

        await repository.updateStatus(
            bulkTransfer.id,
            {
                status: "PENDING_OTP",
                message: "OTP sent.",
                extra: {
                    otpChannel: otpResult.channel
                }
            }
        );

        const response = {

            bulkTransferId: bulkTransfer.id,

            reference,

            itemCount: items.length,

            totalAmount,

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
     * Confirm Bulk Transfer
     * ==========================================================
     *
     * Verifies the single OTP, then processes each item
     * sequentially (not parallel, to keep daily-limit accounting
     * correct without a locking scheme).
     */
    async confirm(user, bulkTransferId, code, request) {

        const bulkTransfer =
            await repository.findById(bulkTransferId);

        if (!bulkTransfer) {

            throw new NotFoundError(
                "Bulk transfer not found."
            );

        }

        if (bulkTransfer.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This bulk transfer does not belong to you."
            );

        }

        if (bulkTransfer.status !== "PENDING_OTP") {

            throw new BusinessRuleError(
                `Bulk transfer is already ${bulkTransfer.status.toLowerCase()}.`
            );

        }

        await otpService.verifyTransferOtp(
            bulkTransfer.id,
            code,
            bulkTransfer.otpChannel
        );

        await repository.updateStatus(
            bulkTransfer.id,
            {
                status: "PROCESSING",
                message: "OTP verified, processing items."
            }
        );

        const sourceAccount =
            await accountClient.getAccount(
                bulkTransfer.sourceAccountNumber,
                { correlationId: request.correlationId }
            );

        let successCount = 0;

        let failCount = 0;

        for (let i = 0; i < bulkTransfer.items.length; i++) {

            const item = bulkTransfer.items[i];

            try {

                if (item.destinationAccountNumber === sourceAccount.accountNumber) {

                    throw new Error(
                        "Destination cannot be the same as the source account."
                    );

                }

                const destinationAccount =
                    await accountClient.getAccount(
                        item.destinationAccountNumber,
                        { correlationId: request.correlationId }
                    );

                const type =
                    destinationAccount.clientId === sourceAccount.clientId
                        ? "OWN_ACCOUNT"
                        : "INTERNAL";

                const itemReference =
                    `BLKI${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

                const transfer =
                    await transferRepository.create({

                        initiatorUserId:
                            user.userId,

                        sourceAccountNumber:
                            sourceAccount.accountNumber,

                        destinationAccountNumber:
                            item.destinationAccountNumber,

                        type,

                        amount:
                            item.amount,

                        narration:
                            item.narration,

                        reference:
                            itemReference,

                        status: "PROCESSING",

                        bulkTransferId:
                            bulkTransfer.id,

                        bulkItemIndex: i,

                        statusHistory: [{

                            status: "PROCESSING",

                            message: "Bulk transfer item.",

                            changedAt: new Date()

                        }]

                    });

                const executed =
                    await transferService.executeMovement(
                        transfer,
                        request
                    );

                await repository.updateItem(
                    bulkTransfer.id,
                    i,
                    {
                        status: "SUCCESSFUL",
                        transferId: executed.id
                    }
                );

                successCount++;

            } catch (error) {

                await repository.updateItem(
                    bulkTransfer.id,
                    i,
                    {
                        status: "FAILED",
                        failureReason: error.message
                    }
                );

                failCount++;

            }

        }

        const finalStatus =
            failCount === 0
                ? "COMPLETED"
                : (successCount === 0 ? "FAILED" : "PARTIALLY_FAILED");

        const completed =
            await repository.updateStatus(
                bulkTransfer.id,
                {
                    status: finalStatus,
                    message: `Processing complete: ${successCount} succeeded, ${failCount} failed.`
                }
            );

        return this.toPublicShape(completed);

    }

    /**
     * ==========================================================
     * Get / History
     * ==========================================================
     */
    async getById(user, bulkTransferId) {

        const bulkTransfer =
            await repository.findById(bulkTransferId);

        if (!bulkTransfer) {

            throw new NotFoundError(
                "Bulk transfer not found."
            );

        }

        if (bulkTransfer.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This bulk transfer does not belong to you."
            );

        }

        return this.toPublicShape(bulkTransfer);

    }

    async history(user, { page, limit }) {

        const [
            bulkTransfers,
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

            bulkTransfers:
                bulkTransfers.map(
                    (bulkTransfer) => this.toPublicShape(bulkTransfer)
                ),

            pagination: {
                page,
                limit,
                total
            }

        };

    }

    toPublicShape(bulkTransfer) {

        return {

            id: bulkTransfer.id,

            reference: bulkTransfer.reference,

            sourceAccountNumber: bulkTransfer.sourceAccountNumber,

            totalAmount: bulkTransfer.totalAmount,

            itemCount: bulkTransfer.itemCount,

            status: bulkTransfer.status,

            items: bulkTransfer.items,

            statusHistory: bulkTransfer.statusHistory,

            createdAt: bulkTransfer.createdAt

        };

    }

}

module.exports = new BulkTransferService();
