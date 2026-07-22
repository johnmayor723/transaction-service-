const mongoose = require("mongoose");

/**
 * ==========================================================
 * Daily Limit Usage
 * ==========================================================
 */

const DailyLimitSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },

        /**
         * YYYY-MM-DD
         */
        date: {
            type: String,
            required: true
        },

        totalAmount: {
            type: Number,
            default: 0
        },

        transactionCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

DailyLimitSchema.index(
    {
        userId: 1,
        date: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "DailyLimit",
    DailyLimitSchema
);
