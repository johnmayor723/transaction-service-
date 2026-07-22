const axios = require("axios");
const https = require("https");

const app = require("../../config/app.config");

/**
 * ==========================================================
 * Fineract Client (posting only)
 * ==========================================================
 *
 * Account Service owns all Fineract *read* access (accounts,
 * client info, loans, transaction history). This client is
 * scoped to Transaction Service's own concern: posting money
 * movement commands. Same connection pattern as Account
 * Service's fineract.client.js (axios, Basic Auth header,
 * tenantIdentifier query param, same gateway).
 */
const client = axios.create({

    baseURL: app.fineract.url,

    timeout: 30000,

    httpsAgent: new https.Agent({

        rejectUnauthorized: false

    }),

    headers: {

        Authorization: `Basic ${app.fineract.basicAuth}`,

        Accept: "application/json",

        "Content-Type": "application/json"

    }

});

/**
 * Request/Response Logger (same pattern as Account Service's
 * fineract.client.js) — surfaces the real Fineract error body
 * instead of just "Request failed with status code 400".
 */
client.interceptors.request.use((config) => {

    console.log("");
    console.log("========================================");
    console.log("FINERACT REQUEST");
    console.log("========================================");
    console.log(`${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    console.log("Body :", JSON.stringify(config.data));
    console.log("");

    return config;

});

client.interceptors.response.use(

    (response) => {

        console.log("");
        console.log("========================================");
        console.log("FINERACT RESPONSE");
        console.log("========================================");
        console.log("Status :", response.status);
        console.log("");

        return response;

    },

    (error) => {

        console.log("");
        console.log("========================================");
        console.log("FINERACT ERROR");
        console.log("========================================");

        if (error.response) {

            console.log("Status :", error.response.status);
            console.log("Body :");
            console.log(JSON.stringify(error.response.data, null, 4));

        } else {

            console.log("Message :", error.message);

        }

        console.log("");

        return Promise.reject(error);

    }

);

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const formatFineractDate = (date) =>
    `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

class FineractClient {

    /**
     * Post a deposit transaction command.
     */
    async postDeposit(accountId, { amount, correlationId } = {}) {

        const { data } = await client.post(

            `/savingsaccounts/${accountId}/transactions?command=deposit&tenantIdentifier=${app.fineract.tenant}`,

            {
                transactionDate: formatFineractDate(new Date()),
                transactionAmount: amount,
                paymentTypeId: 1,
                locale: "en",
                dateFormat: "dd MMMM yyyy"
            },

            {
                headers: correlationId
                    ? { "X-Correlation-Id": correlationId }
                    : {}
            }

        );

        return data;

    }

    /**
     * Post a withdrawal transaction command.
     */
    async postWithdrawal(accountId, { amount, correlationId } = {}) {

        const { data } = await client.post(

            `/savingsaccounts/${accountId}/transactions?command=withdrawal&tenantIdentifier=${app.fineract.tenant}`,

            {
                transactionDate: formatFineractDate(new Date()),
                transactionAmount: amount,
                paymentTypeId: 1,
                locale: "en",
                dateFormat: "dd MMMM yyyy"
            },

            {
                headers: correlationId
                    ? { "X-Correlation-Id": correlationId }
                    : {}
            }

        );

        return data;

    }

}

module.exports = new FineractClient();
