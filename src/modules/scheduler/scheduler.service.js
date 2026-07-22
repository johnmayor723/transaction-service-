const crypto = require("crypto");

const config = require("../../config/app.config");

const { logger } = require("../../config");

const transferRepository = require("../transfer/transfer.repository");

const transferService = require("../transfer/transfer.service");

const standingOrderRepository = require("../standing-order/standing-order.repository");

const { advance } = require("../standing-order/frequency.util");

const fraudService = require("../fraud/fraud.service");

const limitsService = require("../limits/limits.service");

const { client: accountClient } = require("../../integrations/account");

/**
 * ==========================================================
 * Scheduler
 * ==========================================================
 *
 * Single-instance in-process poller (no queue/broker exists
 * yet). Guarded against overlapping ticks. Running more than
 * one instance of this service would require a distributed
 * lock, which isn't a concern at this scale.
 */
class SchedulerService {

    constructor() {

        this.intervalHandle = null;

        this.isRunning = false;

    }

    start() {

        if (this.intervalHandle) {

            return;

        }

        this.intervalHandle = setInterval(

            () => {

                this.tick().catch((error) => {

                    logger.error(
                        {
                            error: {
                                message: error.message
                            }
                        },
                        "Scheduler tick failed."
                    );

                });

            },

            config.scheduler.pollIntervalSeconds * 1000

        );

        logger.info(
            {
                intervalSeconds: config.scheduler.pollIntervalSeconds
            },
            "Scheduler started."
        );

    }

    stop() {

        if (this.intervalHandle) {

            clearInterval(this.intervalHandle);

            this.intervalHandle = null;

        }

    }

    async tick() {

        if (this.isRunning) {

            return;

        }

        this.isRunning = true;

        try {

            await this.processDueTransfers();

            await this.processDueStandingOrders();

        } finally {

            this.isRunning = false;

        }

    }

    /**
     * ==========================================================
     * Process Due Scheduled Transfers
     * ==========================================================
     */
    async processDueTransfers() {

        const dueTransfers =
            await transferRepository.findScheduledDue();

        for (const transfer of dueTransfers) {

            try {

                await limitsService.check({
                    userId: transfer.initiatorUserId,
                    amount: transfer.amount
                });

                const fraudResult =
                    await fraudService.assess({
                        amount: transfer.amount
                    });

                if (fraudResult.decision === "BLOCK") {

                    throw new Error(
                        "Blocked by fraud check at execution time."
                    );

                }

                await transferRepository.updateStatus(
                    transfer.id,
                    {
                        status: "PROCESSING",
                        message: "Scheduled execution starting."
                    }
                );

                await transferService.executeMovement(
                    transfer,
                    { correlationId: transfer.correlationId }
                );

            } catch (error) {

                /**
                 * executeMovement() already marks FAILED on its
                 * own errors — only mark it here if the transfer
                 * never reached executeMovement (limits/fraud
                 * rejected it beforehand).
                 */
                const current =
                    await transferRepository.findById(transfer.id);

                if (current && current.status !== "FAILED") {

                    await transferRepository.updateStatus(
                        transfer.id,
                        {
                            status: "FAILED",
                            message: error.message,
                            extra: {
                                failureReason: error.message
                            }
                        }
                    );

                }

                logger.warn(
                    {
                        error: {
                            message: error.message
                        },
                        transferId: transfer.id
                    },
                    "Scheduled transfer execution failed."
                );

            }

        }

    }

    /**
     * ==========================================================
     * Process Due Standing Order Occurrences
     * ==========================================================
     */
    async processDueStandingOrders() {

        const dueOrders =
            await standingOrderRepository.findActiveDue();

        for (const order of dueOrders) {

            try {

                await limitsService.check({
                    userId: order.initiatorUserId,
                    amount: order.amount
                });

                const fraudResult =
                    await fraudService.assess({
                        amount: order.amount
                    });

                if (fraudResult.decision === "BLOCK") {

                    throw new Error(
                        "Blocked by fraud check at execution time."
                    );

                }

                let type = "NIP";

                if (!order.destinationBankCode) {

                    const sourceAccount =
                        await accountClient.getAccount(
                            order.sourceAccountNumber
                        );

                    const destinationAccount =
                        await accountClient.getAccount(
                            order.destinationAccountNumber
                        );

                    type =
                        destinationAccount.clientId === sourceAccount.clientId
                            ? "OWN_ACCOUNT"
                            : "INTERNAL";

                }

                const reference =
                    `SOX${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

                const transfer =
                    await transferRepository.create({

                        initiatorUserId:
                            order.initiatorUserId,

                        sourceAccountNumber:
                            order.sourceAccountNumber,

                        destinationAccountNumber:
                            order.destinationAccountNumber,

                        destinationBankCode:
                            type === "NIP" ? order.destinationBankCode : null,

                        type,

                        amount:
                            order.amount,

                        narration:
                            order.narration || `Standing order ${order.reference}`,

                        reference,

                        status: "PROCESSING",

                        standingOrderId:
                            order.id,

                        statusHistory: [{

                            status: "PROCESSING",

                            message: "Standing order occurrence.",

                            changedAt: new Date()

                        }]

                    });

                await transferService.executeMovement(transfer);

                const executionCount =
                    order.executionCount + 1;

                const nextRunAt =
                    advance(order.nextRunAt, order.frequency);

                const reachedLimit =
                    (order.maxExecutions && executionCount >= order.maxExecutions) ||
                    (order.endDate && nextRunAt > order.endDate);

                await standingOrderRepository.updateStatus(
                    order.id,
                    {
                        status: reachedLimit ? "COMPLETED" : "ACTIVE",
                        message: reachedLimit
                            ? "Reached execution limit; standing order completed."
                            : "Occurrence executed.",
                        extra: {
                            executionCount,
                            nextRunAt
                        }
                    }
                );

            } catch (error) {

                /**
                 * A failed occurrence doesn't cancel the order —
                 * it stays ACTIVE and is retried next tick.
                 */
                await standingOrderRepository.updateStatus(
                    order.id,
                    {
                        status: order.status,
                        message: `Occurrence failed: ${error.message}`
                    }
                );

                logger.warn(
                    {
                        error: {
                            message: error.message
                        },
                        standingOrderId: order.id
                    },
                    "Standing order occurrence failed."
                );

            }

        }

    }

}

module.exports = new SchedulerService();
