const axios = require("axios");

const config = require("../../config/app.config");

/**
 * ==========================================================
 * Notification Client
 * ==========================================================
 *
 * Best-effort by design — the caller (transfer.service.js)
 * wraps every call in a try/catch that only logs a warning.
 * No ApiError translation needed here since nothing downstream
 * inspects the error type; it's swallowed either way.
 */
const client = axios.create({

    baseURL: config.notificationService.url,

    timeout: 10000,

    headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
    }

});

class NotificationClient {

    async send({

        userId,

        channel,

        type,

        recipient,

        subject,

        message,

        correlationId

    }) {

        await client.post(

            "/internal/notifications",

            {
                userId,
                channel,
                type,
                recipient,
                subject,
                message
            },

            {
                headers: correlationId
                    ? { "X-Correlation-Id": correlationId }
                    : {}
            }

        );

    }

}

module.exports = new NotificationClient();
