const nodemailer = require("nodemailer");

const config = require("../../config/app.config");

const { logger } = require("../../config");

/**
 * ==========================================================
 * Email OTP Provider
 * ==========================================================
 *
 * Sends OTP via email using Gmail SMTP (Nodemailer).
 *
 * ==========================================================
 */

const transporter = nodemailer.createTransport({

    host: config.email.host,

    port: config.email.port,

    secure: config.email.secure,

    auth: {

        user: config.email.user,

        pass: config.email.password

    }

});

class EmailProvider {

    /**
     * Send Email OTP
     */
    async send({

        email,

        otp,

        subject = "Transfer Verification Code"

    }) {

        try {

            await transporter.sendMail({

                from: config.email.from,

                to: email,

                subject,

                text:
                    `Your transfer verification code is ${otp}. It expires in ${config.otp.expiryMinutes} minutes.`,

                html:
                    `<p>Your transfer verification code is <strong>${otp}</strong>.</p><p>It expires in ${config.otp.expiryMinutes} minutes.</p>`

            });

            return {

                success: true,

                provider: "GMAIL"

            };

        } catch (error) {

            logger.warn(
                {
                    error: {
                        message: error.message
                    },
                    email
                },
                "Failed to send email OTP."
            );

            return {

                success: false,

                provider: "GMAIL",

                error: error.message

            };

        }

    }

}

module.exports = new EmailProvider();
