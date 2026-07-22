const axios = require("axios");

const config = require("../../config/app.config");

const { logger } = require("../../config");

/**
 * ==========================================================
 * SMS OTP Provider
 * ==========================================================
 *
 * Sends OTP via SMS using Termii.
 *
 * ==========================================================
 */

class SmsProvider {

    /**
     * Send SMS OTP
     */
    async send({

        phoneNumber,

        otp

    }) {

        try {

            await axios.post(

                `${config.sms.termii.baseUrl}/api/sms/send`,

                {

                    api_key:
                        config.sms.termii.apiKey,

                    to:
                        phoneNumber,

                    from:
                        config.sms.termii.senderId,

                    sms:
                        `Your transfer verification code is ${otp}. It expires in ${config.otp.expiryMinutes} minutes.`,

                    type: "plain",

                    channel: "generic"

                }

            );

            return {

                success: true,

                provider: "TERMII"

            };

        } catch (error) {

            logger.warn(
                {
                    error: {
                        message: error.message
                    },
                    phoneNumber
                },
                "Failed to send SMS OTP."
            );

            return {

                success: false,

                provider: "TERMII",

                error: error.message

            };

        }

    }

}

module.exports = new SmsProvider();
