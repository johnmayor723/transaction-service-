const mongoose = require("mongoose");

const config = require("../../config/app.config");

/**
 * ==========================================================
 * Idempotency Record
 * ==========================================================
 */

const IdempotencyRecordSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        userId: {
            type: String,
            required: true
        },

        requestHash: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["IN_PROGRESS", "COMPLETED"],
            default: "IN_PROGRESS"
        },

        statusCode: {
            type: Number,
            default: null
        },

        responseBody: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * Auto-expire after the configured TTL window.
 */
IdempotencyRecordSchema.index(
    {
        createdAt: 1
    },
    {
        expireAfterSeconds: config.idempotency.ttlHours * 60 * 60
    }
);

module.exports = mongoose.model(
    "IdempotencyRecord",
    IdempotencyRecordSchema
);
