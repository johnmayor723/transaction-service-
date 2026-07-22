const mongoose = require("mongoose");

/**
 * ==========================================================
 * Transfer
 * ==========================================================
 *
 * The single, universal money-movement record. A scheduled
 * transfer is a Transfer with a future scheduledAt; a standing
 * order occurrence is a Transfer with standingOrderId set; a
 * bulk item is a Transfer with bulkTransferId set; a reversal
 * is a Transfer with isReversal: true.
 */

const TransferSchema = new mongoose.Schema(
    {
        initiatorUserId: {
            type: String,
            required: true,
            index: true
        },

        sourceAccountNumber: {
            type: String,
            required: true
        },

        destinationAccountNumber: {
            type: String,
            required: true
        },

        destinationBankCode: {
            type: String,
            default: null
        },

        type: {
            type: String,
            required: true,
            enum: ["OWN_ACCOUNT", "INTERNAL", "NIP"]
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            default: "NGN"
        },

        narration: {
            type: String,
            default: null
        },

        reference: {
            type: String,
            required: true,
            unique: true
        },

        idempotencyKey: {
            type: String,
            default: null,
            index: true
        },

        correlationId: {
            type: String,
            default: null
        },

        status: {
            type: String,
            required: true,
            enum: ["PENDING_OTP", "SCHEDULED", "PROCESSING", "SUCCESSFUL", "FAILED", "REJECTED"],
            default: "PENDING_OTP"
        },

        /**
         * Set when the transfer should execute later instead of
         * immediately on confirm(). Picked up by the scheduler.
         */
        scheduledAt: {
            type: Date,
            default: null
        },

        otpChannel: {
            type: String,
            enum: ["EMAIL", "SMS"],
            default: null
        },

        fraudDecision: {
            type: String,
            enum: ["ALLOW", "REVIEW", "BLOCK"],
            default: null
        },

        statusHistory: [
            {
                status: String,
                message: String,
                changedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        failureReason: {
            type: String,
            default: null
        },

        completedAt: {
            type: Date,
            default: null
        },

        /**
         * Standing order linkage — set on a Transfer generated
         * by a recurring order's execution.
         */
        standingOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StandingOrder",
            default: null
        },

        /**
         * Bulk transfer linkage — set on a Transfer generated as
         * one item of a batch.
         */
        bulkTransferId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BulkTransfer",
            default: null
        },

        bulkItemIndex: {
            type: Number,
            default: null
        },

        /**
         * Reversal linkage. isReversal/reversalOf are set on the
         * reversal record itself; reversed/reversalTransferId are
         * set on the original once its reversal succeeds.
         */
        isReversal: {
            type: Boolean,
            default: false
        },

        reversalOf: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transfer",
            default: null
        },

        reversed: {
            type: Boolean,
            default: false
        },

        reversalTransferId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transfer",
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

TransferSchema.index({ initiatorUserId: 1, createdAt: -1 });

TransferSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model(
    "Transfer",
    TransferSchema
);
