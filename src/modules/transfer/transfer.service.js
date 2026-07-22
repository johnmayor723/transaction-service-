const crypto = require("crypto");

const repository = require("./transfer.repository");

const otpService = require("../otp/otp.service");

const fraudService = require("../fraud/fraud.service");

const limitsService = require("../limits/limits.service");

const { client: accountClient } = require("../../integrations/account");

const { client: fineractClient } = require("../../integrations/fineract");

const { adapter: nibssAdapter } = require("../../integrations/nibss");

const { client: notificationClient } = require("../../integrations/notification");

const config = require("../../config/app.config");

const { logger } = require("../../config");

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
     * No money moves yet — that only happens on confirm(). If
     * scheduledAt is supplied, authorization still happens now,
     * but execution is deferred to the scheduler.
     */
    async initiate(user, data, request) {

        const {
            destinationAccountNumber,
            destinationBankCode,
            amount,
            narration,
            scheduledAt
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

                scheduledAt:
                    scheduledAt ? new Date(scheduledAt) : null,

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
     * Verifies the OTP. A scheduled transfer (future scheduledAt)
     * moves to SCHEDULED for the scheduler to pick up later;
     * everything else executes immediately.
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

        if (transfer.scheduledAt && transfer.scheduledAt > new Date()) {

            const scheduled =
                await repository.updateStatus(
                    transfer.id,
                    {
                        status: "SCHEDULED",
                        message: `OTP verified. Scheduled for ${transfer.scheduledAt.toISOString()}.`
                    }
                );

            return {

                transferId: scheduled.id,

                reference: scheduled.reference,

                status: scheduled.status

            };

        }

        await repository.updateStatus(
            transfer.id,
            {
                status: "PROCESSING",
                message: "OTP verified, processing."
            }
        );

        const executed =
            await this.executeMovement(transfer, request);

        return {

            transferId: executed.id,

            reference: executed.reference,

            status: executed.status

        };

    }

    /**
     * ==========================================================
     * Execute Movement
     * ==========================================================
     *
     * The single code path that actually moves money, once a
     * transfer is authorized and ready to process (status
     * PROCESSING). Reused by confirm(), the scheduler (scheduled
     * transfers + standing order occurrences), and bulk transfer
     * item processing.
     */
    async executeMovement(transfer, request = {}) {

        let sourceAccount = null;

        try {

            sourceAccount =
                await accountClient.getAccount(
                    transfer.sourceAccountNumber,
                    { correlationId: request.correlationId }
                );

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
                transfer.initiatorUserId,
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

            await this.notifyBestEffort(
                transfer,
                sourceAccount,
                "SUCCESSFUL",
                request.correlationId
            );

            return completed;

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

            await this.notifyBestEffort(
                transfer,
                sourceAccount,
                "FAILED",
                request.correlationId
            );

            throw error;

        }

    }

    /**
     * ==========================================================
     * Notify (best-effort)
     * ==========================================================
     *
     * Never throws, never blocks, never changes the transfer's
     * own outcome — a failure here is only ever logged. Skips
     * silently if sourceAccount couldn't be resolved (e.g. the
     * very first accountClient call in executeMovement failed).
     */
    async notifyBestEffort(transfer, sourceAccount, status, correlationId) {

        if (!sourceAccount) {

            return;

        }

        try {

            const type =
                status === "SUCCESSFUL"
                    ? "TRANSFER_COMPLETED"
                    : "TRANSFER_FAILED";

            const message =
                status === "SUCCESSFUL"
                    ? `Your transfer of ${transfer.amount} ${transfer.currency} to ${transfer.destinationAccountNumber} was successful. Ref: ${transfer.reference}.`
                    : `Your transfer of ${transfer.amount} ${transfer.currency} to ${transfer.destinationAccountNumber} failed. Ref: ${transfer.reference}.`;

            await notificationClient.send({

                userId:
                    transfer.initiatorUserId,

                channel:
                    sourceAccount.email ? "EMAIL" : "SMS",

                type,

                recipient:
                    sourceAccount.email || sourceAccount.phoneNumber,

                subject:
                    status === "SUCCESSFUL" ? "Transfer Successful" : "Transfer Failed",

                message,

                correlationId

            });

        } catch (error) {

            logger.warn(
                {
                    error: {
                        message: error.message
                    },
                    transferId: transfer.id
                },
                "Failed to send transfer notification."
            );

        }

    }

    /**
     * ==========================================================
     * Initiate Reversal
     * ==========================================================
     *
     * Eligibility is checked up front so an ineligible reversal
     * never gets an OTP sent for it.
     */
    async initiateReversal(user, transferId, request) {

        const original =
            await repository.findById(transferId);

        if (!original) {

            throw new NotFoundError(
                "Transfer not found."
            );

        }

        if (original.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This transfer does not belong to you."
            );

        }

        if (original.status !== "SUCCESSFUL") {

            throw new BusinessRuleError(
                "Only successful transfers can be reversed."
            );

        }

        if (original.type === "NIP") {

            throw new BusinessRuleError(
                "NIP transfers cannot be reversed."
            );

        }

        if (original.isReversal) {

            throw new BusinessRuleError(
                "A reversal cannot itself be reversed."
            );

        }

        if (original.reversed) {

            throw new BusinessRuleError(
                "This transfer has already been reversed."
            );

        }

        const existingReversal =
            await repository.findPendingReversalByOriginal(
                original.id
            );

        if (existingReversal) {

            throw new BusinessRuleError(
                "A reversal for this transfer is already pending confirmation."
            );

        }

        const windowMs =
            config.reversal.windowHours * 60 * 60 * 1000;

        if (
            !original.completedAt ||
            (Date.now() - original.completedAt.getTime()) > windowMs
        ) {

            throw new BusinessRuleError(
                `Transfers can only be reversed within ${config.reversal.windowHours} hours of completion.`
            );

        }

        await limitsService.check({
            userId: user.userId,
            amount: original.amount
        });

        const fraudResult =
            await fraudService.assess({
                amount: original.amount
            });

        if (fraudResult.decision === "BLOCK") {

            throw new BusinessRuleError(
                "This reversal cannot be processed."
            );

        }

        const reference =
            `REV${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

        const reversal =
            await repository.create({

                initiatorUserId:
                    user.userId,

                sourceAccountNumber:
                    original.destinationAccountNumber,

                destinationAccountNumber:
                    original.sourceAccountNumber,

                type:
                    original.type,

                amount:
                    original.amount,

                narration:
                    `Reversal of ${original.reference}`,

                reference,

                idempotencyKey:
                    request.headers["idempotency-key"],

                correlationId:
                    request.correlationId,

                fraudDecision:
                    fraudResult.decision,

                isReversal: true,

                reversalOf:
                    original.id,

                statusHistory: [{

                    status: "PENDING_OTP",

                    message: "Reversal initiated.",

                    changedAt: new Date()

                }]

            });

        const requester =
            await accountClient.getAccount(
                user.accountNumber,
                { correlationId: request.correlationId }
            );

        const otpResult =
            await otpService.sendTransferOtp(
                reversal.id,
                {
                    email: requester.email,
                    phoneNumber: requester.phoneNumber
                }
            );

        await repository.updateStatus(
            reversal.id,
            {
                status: "PENDING_OTP",
                message: "OTP sent.",
                extra: {
                    otpChannel: otpResult.channel
                }
            }
        );

        const response = {

            transferId: reversal.id,

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
     * Confirm Reversal
     * ==========================================================
     *
     * transferId here is the ORIGINAL transfer's id — the same
     * :id used for POST /transfers/:id/reverse — so the caller
     * never needs to track the reversal's own generated id.
     */
    async confirmReversal(user, transferId, code, request) {

        const reversal =
            await repository.findPendingReversalByOriginal(transferId);

        if (!reversal) {

            throw new NotFoundError(
                "No pending reversal found for this transfer."
            );

        }

        if (reversal.initiatorUserId !== user.userId) {

            throw new AuthorizationError(
                "This reversal does not belong to you."
            );

        }

        await otpService.verifyTransferOtp(
            reversal.id,
            code,
            reversal.otpChannel
        );

        await repository.updateStatus(
            reversal.id,
            {
                status: "PROCESSING",
                message: "OTP verified, processing."
            }
        );

        const executed =
            await this.executeMovement(reversal, request);

        if (executed.status === "SUCCESSFUL") {

            await repository.markReversed(
                reversal.reversalOf,
                reversal.id
            );

        }

        return {

            transferId: executed.id,

            reference: executed.reference,

            status: executed.status

        };

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

            scheduledAt: transfer.scheduledAt,

            failureReason: transfer.failureReason,

            isReversal: transfer.isReversal,

            reversalOf: transfer.reversalOf,

            reversed: transfer.reversed,

            reversalTransferId: transfer.reversalTransferId,

            standingOrderId: transfer.standingOrderId,

            bulkTransferId: transfer.bulkTransferId,

            statusHistory: transfer.statusHistory,

            createdAt: transfer.createdAt,

            completedAt: transfer.completedAt

        };

    }

}

module.exports = new TransferService();
