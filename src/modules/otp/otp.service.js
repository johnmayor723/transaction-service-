const repository =
    require("./otp.repository");

const generator =
    require("./otp.generator");

const emailProvider =
    require("./email.provider");

const smsProvider =
    require("./sms.provider");

const config =
    require("../../config/app.config");

const {
    NotFoundError,
    ValidationError,
    UnauthorizedError
} = require("../../errors");

class OtpService {

    /**
     * ==========================================================
     * Create Email OTP
     * ==========================================================
     */
    async createEmailOtp({

        referenceId,

        referenceType,

        email,

        expiryMinutes = config.otp.expiryMinutes

    }) {

        const code =
            generator.generate();

        const codeHash =
            generator.hash(code);

        const expiresAt =
            new Date(
                Date.now() +
                (expiryMinutes * 60 * 1000)
            );

        await repository.replace(

            referenceId,

            "EMAIL",

            {

                referenceId,

                referenceType,

                channel: "EMAIL",

                destination: email,

                codeHash,

                verified: false,

                verifiedAt: null,

                attempts: 0,

                expiresAt

            }

        );

        await emailProvider.send({

            email,

            otp: code

        });

        return {

            expiresAt,

            code,

            channel: "EMAIL"

        };

    }

    /**
     * ==========================================================
     * Create SMS OTP
     * ==========================================================
     */
    async createSmsOtp({

        referenceId,

        referenceType,

        phoneNumber,

        expiryMinutes = config.otp.expiryMinutes

    }) {

        const code =
            generator.generate();

        const codeHash =
            generator.hash(code);

        const expiresAt =
            new Date(
                Date.now() +
                (expiryMinutes * 60 * 1000)
            );

        await repository.replace(

            referenceId,

            "SMS",

            {

                referenceId,

                referenceType,

                channel: "SMS",

                destination:
                    phoneNumber,

                codeHash,

                verified: false,

                verifiedAt: null,

                attempts: 0,

                expiresAt

            }

        );

        await smsProvider.send({

            phoneNumber,

            otp: code

        });

        return {

            expiresAt,

            code,

            channel: "SMS"

        };

    }

    /**
     * ==========================================================
     * Verify OTP
     * ==========================================================
     */
    async verify({

        referenceId,

        channel,

        code,

        maxAttempts = config.otp.maxAttempts

    }) {

        const otp =
            await repository.find(

                referenceId,

                channel

            );

        if (!otp) {

            throw new NotFoundError(
                "OTP not found."
            );

        }

        if (otp.verified) {

            return true;

        }

        if (

            otp.expiresAt <

            new Date()

        ) {

            throw new ValidationError(
                "OTP has expired."
            );

        }

        if (

            otp.attempts >=

            maxAttempts

        ) {

            throw new UnauthorizedError(
                "Maximum OTP attempts exceeded."
            );

        }

        const matched =
            generator.verify(

                code,

                otp.codeHash

            );

        if (!matched) {

            await repository.incrementAttempts(
                otp.id
            );

            throw new ValidationError(
                "Invalid OTP."
            );

        }

        await repository.markVerified(
            otp.id
        );

        return true;

    }

    /**
     * ==========================================================
     * Send Transfer OTP
     * ==========================================================
     */
    async sendTransferOtp(
        transferId,
        {
            email,
            phoneNumber
        }
    ) {

        if (email) {

            return this.createEmailOtp({

                referenceId:
                    transferId.toString(),

                referenceType:
                    "TRANSFER",

                email

            });

        }

        return this.createSmsOtp({

            referenceId:
                transferId.toString(),

            referenceType:
                "TRANSFER",

            phoneNumber

        });

    }

    /**
     * ==========================================================
     * Verify Transfer OTP
     * ==========================================================
     */
    async verifyTransferOtp(
        transferId,
        code,
        channel
    ) {

        const verified =
            await this.verify({

                referenceId:
                    transferId.toString(),

                channel,

                code

            });

        await this.delete(
            transferId.toString()
        );

        return verified;

    }

    /**
     * ==========================================================
     * Delete OTPs
     * ==========================================================
     */
    async delete(

        referenceId

    ) {

        return repository.deleteByReferenceId(
            referenceId
        );

    }

}

module.exports =
    new OtpService();
