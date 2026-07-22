const mongoose = require("mongoose");

/**
 * ==========================================================
 * Bulk Transfer
 * ==========================================================
 *
 * One OTP authorizes the whole batch; each item becomes its
 * own Transfer record once processed (see bulkTransferId /
 * bulkItemIndex on the Transfer model).
 */

const BulkTransferItemSchema = new mongoose.Schema(
    {
        destinationAccountNumber: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        narration: {
            type: String,
            default: null
        },

        status: {
            type: String,
            enum: ["PENDING", "SUCCESSFUL", "FAILED"],
            default: "PENDING"
        },

        transferId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transfer",
            default: null
        },

        failureReason: {
            type: String,
            default: null
        }
    }
);

const BulkTransferSchema = new mongoose.Schema(
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

        reference: {
            type: String,
            required: true,
            unique: true
        },

        totalAmount: {
            type: Number,
            required: true
        },

        itemCount: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            required: true,
            enum: ["PENDING_OTP", "PROCESSING", "COMPLETED", "PARTIALLY_FAILED", "FAILED"],
            default: "PENDING_OTP"
        },

        otpChannel: {
            type: String,
            enum: ["EMAIL", "SMS"],
            default: null
        },

        items: [BulkTransferItemSchema],

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

BulkTransferSchema.index({ initiatorUserId: 1, createdAt: -1 });

module.exports = mongoose.model(
    "BulkTransfer",
    BulkTransferSchema
);
