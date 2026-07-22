const mongoose = require("mongoose");

/**
 * ==========================================================
 * OTP Schema
 * ==========================================================
 *
 * Transaction Service owns its own OTP collection (separate
 * from Auth Service's) so transfer confirmation never has a
 * hard runtime dependency on Auth Service being reachable.
 * ==========================================================
 */

const OtpSchema = new mongoose.Schema(
    {
        /**
         * Public Reference (Transfer ID)
         */
        referenceId: {
            type: String,
            required: true
        },

        /**
         * Reference Type
         */
        referenceType: {
            type: String,
            required: true,
            enum: [
                "TRANSFER"
            ]
        },

        /**
         * Delivery Channel
         */
        channel: {
            type: String,
            required: true,
            enum: [
                "EMAIL",
                "SMS"
            ]
        },

        /**
         * Recipient
         */
        destination: {
            type: String,
            required: true
        },

        /**
         * SHA-256 Hash
         */
        codeHash: {
            type: String,
            required: true
        },

        /**
         * Verification Status
         */
        verified: {
            type: Boolean,
            default: false
        },

        /**
         * Attempts
         */
        attempts: {
            type: Number,
            default: 0
        },

        /**
         * Verified Time
         */
        verifiedAt: {
            type: Date,
            default: null
        },

        /**
         * Expiry
         */
        expiresAt: {
            type: Date,
            required: true
        }

    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * TTL Index
 */
OtpSchema.index(
    {
        expiresAt: 1
    },
    {
        expireAfterSeconds: 0
    }
);

/**
 * Search Indexes
 */
OtpSchema.index({
    referenceId: 1,
    channel: 1
});

module.exports = mongoose.model(
    "Otp",
    OtpSchema
);
