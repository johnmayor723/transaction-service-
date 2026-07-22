const mongoose = require("mongoose");

/**
 * ==========================================================
 * Transfer
 * ==========================================================
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
            enum: ["PENDING_OTP", "PROCESSING", "SUCCESSFUL", "FAILED", "REJECTED"],
            default: "PENDING_OTP"
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
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

TransferSchema.index({ initiatorUserId: 1, createdAt: -1 });

module.exports = mongoose.model(
    "Transfer",
    TransferSchema
);
