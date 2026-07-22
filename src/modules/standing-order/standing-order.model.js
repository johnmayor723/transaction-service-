const mongoose = require("mongoose");

/**
 * ==========================================================
 * Standing Order
 * ==========================================================
 *
 * Authorized once (PENDING_OTP -> ACTIVE via OTP), then the
 * scheduler generates a Transfer for each due occurrence
 * without further OTP prompts.
 */

const StandingOrderSchema = new mongoose.Schema(
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

        amount: {
            type: Number,
            required: true
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

        frequency: {
            type: String,
            required: true,
            enum: ["DAILY", "WEEKLY", "MONTHLY"]
        },

        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            default: null
        },

        nextRunAt: {
            type: Date,
            default: null
        },

        maxExecutions: {
            type: Number,
            default: null
        },

        executionCount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            required: true,
            enum: ["PENDING_OTP", "ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"],
            default: "PENDING_OTP"
        },

        otpChannel: {
            type: String,
            enum: ["EMAIL", "SMS"],
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
        ]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

StandingOrderSchema.index({ initiatorUserId: 1, createdAt: -1 });

StandingOrderSchema.index({ status: 1, nextRunAt: 1 });

module.exports = mongoose.model(
    "StandingOrder",
    StandingOrderSchema
);
