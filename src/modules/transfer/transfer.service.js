const crypto = require("crypto");

const repository = require("./transfer.repository");

const otpService = require("../otp/otp.service");

const fraudService = require("../fraud/fraud.service");

const limitsService = require("../limits/limits.service");

const { client: accountClient } = require("../../integrations/account");

const { client: fineractClient } = require("../../integrations/fineract");

const { adapter: nibssAdapter } = require("../../integrations/nibss");

const config = require("../../config/app.config");

const {
    NotFoundError,
    AuthorizationError,
    BusinessRuleError,
    ValidationError
} = require("../../errors");

class TransferService {

    /**
     * ==========================================================
     * Initiate Transfer
     * ==========================================================
     *
     * Validates the source/destination + limits + fraud, then
     * creates the transfer as PENDING_OTP and sends the OTP.
     * No money moves yet — that only happens on confirm().
     */
    async initiate(user, data, request) {

        const {
            destinationAccountNumber,
            destinationBankCode,
            amount,
            narration
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
                "This transfer cannot be processed."
            );

        }

        /**
         * NIP transfers go to another bank — the dummy adapter
         * doesn't perform real cross-bank lookups, so only
         * format-validate. Everything else must resolve against
         * an account Account Service actually knows about.
         */
        let type = "NIP";

        if (!destinationBankCode) {

            const destinationAccount =
                await accountClient.getAccount(
                    destinationAccountNumber,
                    { correlationId: request.correlationId }
                );

            type =
                destinationAccount.clientId === sourceAccount.clientId
                    ? "OWN_ACCOUNT"
                    : "INTERNAL";

        }

        const reference =
            `TXN${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

        const transfer =
            await repository.create({

                initiatorUserId:
                    user.userId,

                sourceAccountNumber:
                    sourceAccount.accountNumber,

                destinationAccountNumber,

                destinationBankCode:
                    type === "NIP" ? destinationBankCode : null,

                type,

                amount,

                narration,

                reference,

                idempotencyKey:
                    request.headers["idempotency-key"],

                correlationId:
                    request.correlationId,

                fraudDecision:
                    fraudResult.decision,

                statusHistory: [{

                    status: "PENDING_OTP",

                    message: "Transfer initiated.",

                    changedAt: new Date()

                }]

            });

        const otpResult =
            await otpService.sendTransferOtp(
                transfer.id,
                {
                    email: sourceAccount.email,
                    phoneNumber: sourceAccount.phoneNumber
                }
            );

        await repository.updateStatus(
            transfer.id,
            {
                status: "PENDING_OTP",
                message: "OTP sent.",
                extra: {
                    otpChannel: otpResult.channel
                }
            }
        );

        const response = {

            transferId: transfer.id,

            reference,

            status: "PENDING_OTP",

            expiresAt: otpResult.expiresAt

        };

        /**
         * Expose the plaintext OTP outside production so the
         * flow can be tested without a live email/SMS provider —
         * same pattern already used in Auth Service.
         */
        if (!config.isProduction) {

            response.otp = otpResult.code;

        }

        return response;

    }

    /**
     * ==========================================================
     * Confirm Transfer
     * ==========================================================
     *
     * Verifies the OTP, then posts the actual money movement.
     */
    async confirm(user, transferId, code, request) {

        const transfer =
            await repository.findById(transferId);

        if (!transfer) {

            throw new NotFoundError(
                "Transfer not found."
            );

        }

        if (transfer.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This transfer does not belong to you."
            );

        }

        if (transfer.status !== "PENDING_OTP") {

            throw new BusinessRuleError(
                `Transfer is already ${transfer.status.toLowerCase()}.`
            );

        }

        await otpService.verifyTransferOtp(
            transfer.id,
            code,
            transfer.otpChannel
        );

        await repository.updateStatus(
            transfer.id,
            {
                status: "PROCESSING",
                message: "OTP verified, processing."
            }
        );

        try {

            if (transfer.type === "NIP") {

                const result =
                    await nibssAdapter.initiateNip({

                        sourceAccountNumber:
                            transfer.sourceAccountNumber,

                        destinationBankCode:
                            transfer.destinationBankCode,

                        destinationAccountNumber:
                            transfer.destinationAccountNumber,

                        amount:
                            transfer.amount,

                        narration:
                            transfer.narration

                    });

                if (result.status !== "SUCCESSFUL") {

                    throw new BusinessRuleError(
                        "NIP transfer failed."
                    );

                }

            } else {

                const sourceAccount =
                    await accountClient.getAccount(
                        transfer.sourceAccountNumber,
                        { correlationId: request.correlationId }
                    );

                const destinationAccount =
                    await accountClient.getAccount(
                        transfer.destinationAccountNumber,
                        { correlationId: request.correlationId }
                    );

                await fineractClient.postWithdrawal(
                    sourceAccount.fineractAccountId,
                    {
                        amount: transfer.amount,
                        correlationId: request.correlationId
                    }
                );

                await fineractClient.postDeposit(
                    destinationAccount.fineractAccountId,
                    {
                        amount: transfer.amount,
                        correlationId: request.correlationId
                    }
                );

            }

            await limitsService.recordUsage(
                user.userId,
                transfer.amount
            );

            const completed =
                await repository.updateStatus(
                    transfer.id,
                    {
                        status: "SUCCESSFUL",
                        message: "Transfer completed successfully.",
                        extra: {
                            completedAt: new Date()
                        }
                    }
                );

            return {

                transferId: completed.id,

                reference: completed.reference,

                status: completed.status

            };

        } catch (error) {

            await repository.updateStatus(
                transfer.id,
                {
                    status: "FAILED",
                    message: error.message,
                    extra: {
                        failureReason: error.message
                    }
                }
            );

            throw error;

        }

    }

    /**
     * ==========================================================
     * Get Transfer By ID
     * ==========================================================
     */
    async getById(user, transferId) {

        const transfer =
            await repository.findById(transferId);

        if (!transfer) {

            throw new NotFoundError(
                "Transfer not found."
            );

        }

        if (transfer.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This transfer does not belong to you."
            );

        }

        return this.toPublicShape(transfer);

    }

    /**
     * ==========================================================
     * Transfer History
     * ==========================================================
     */
    async history(user, { page, limit }) {

        const [
            transfers,
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

            transfers:
                transfers.map(
                    (transfer) => this.toPublicShape(transfer)
                ),

            pagination: {
                page,
                limit,
                total
            }

        };

    }

    /**
     * Strip internal-only fields before returning to the client.
     */
    toPublicShape(transfer) {

        return {

            id: transfer.id,

            reference: transfer.reference,

            type: transfer.type,

            sourceAccountNumber: transfer.sourceAccountNumber,

            destinationAccountNumber: transfer.destinationAccountNumber,

            destinationBankCode: transfer.destinationBankCode,

            amount: transfer.amount,

            currency: transfer.currency,

            narration: transfer.narration,

            status: transfer.status,

            failureReason: transfer.failureReason,

            statusHistory: transfer.statusHistory,

            createdAt: transfer.createdAt,

            completedAt: transfer.completedAt

        };

    }

}

module.exports = new TransferService();
