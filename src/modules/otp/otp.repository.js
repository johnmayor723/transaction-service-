const Otp = require("./otp.model");

class OtpRepository {

    /**
     * ==========================================================
     * Create OTP
     * ==========================================================
     */
    async create(data) {

        return Otp.create(data);

    }

    /**
     * ==========================================================
     * Find OTP
     * ==========================================================
     */
    async find(
        referenceId,
        channel
    ) {

        return Otp.findOne({

            referenceId,

            channel

        });

    }

    /**
     * ==========================================================
     * Increment Attempts
     * ==========================================================
     */
    async incrementAttempts(
        id
    ) {

        return Otp.findByIdAndUpdate(

            id,

            {

                $inc: {

                    attempts: 1

                }

            },

            {

                new: true

            }

        );

    }

    /**
     * ==========================================================
     * Mark Verified
     * ==========================================================
     */
    async markVerified(
        id
    ) {

        return Otp.findByIdAndUpdate(

            id,

            {

                verified: true,

                verifiedAt:
                    new Date()

            },

            {

                new: true

            }

        );

    }

    /**
     * ==========================================================
     * Replace Existing OTP
     * ==========================================================
     */
    async replace(
        referenceId,
        channel,
        data
    ) {

        return Otp.findOneAndUpdate(

            {

                referenceId,

                channel

            },

            data,

            {

                upsert: true,

                new: true,

                runValidators: true

            }

        );

    }

    /**
     * ==========================================================
     * Delete By Reference
     * ==========================================================
     */
    async deleteByReferenceId(
        referenceId
    ) {

        return Otp.deleteMany({

            referenceId

        });

    }

}

module.exports =
    new OtpRepository();
