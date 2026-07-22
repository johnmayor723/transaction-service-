const axios = require("axios");

const config = require("../../config/app.config");

const {
    ApiError,
    NotFoundError,
    BusinessRuleError
} = require("../../errors");

const client = axios.create({

    baseURL: config.accountService.url,

    timeout: 30000,

    headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
    }

});

/**
 * ------------------------------------------------------
 * Translate Account Service failures into ApiErrors.
 * ------------------------------------------------------
 */
const handleError = (error) => {

    if (error.response) {

        const {
            status,
            data
        } = error.response;

        const message =
            (data && data.message) ||
            "Account Service request failed.";

        if (status === 404) {
            throw new NotFoundError(message);
        }

        if (status >= 400 && status < 500) {
            throw new BusinessRuleError(message);
        }

        throw new ApiError({
            statusCode: 502,
            message: "Account Service returned an unexpected error.",
            errorCode: "SYS-5020"
        });

    }

    throw new ApiError({
        statusCode: 503,
        message: "Account Service is unavailable.",
        errorCode: "SYS-5030"
    });

};

class AccountClient {

    /**
     * ------------------------------------------------------
     * Get Account Mapping (ownership, status, contact info)
     * ------------------------------------------------------
     */
    async getAccount(accountNumber, { correlationId } = {}) {

        try {

            const { data: response } =
                await client.get(
                    `/accounts/internal/accounts/${accountNumber}`,
                    {
                        headers: correlationId
                            ? { "X-Correlation-Id": correlationId }
                            : {}
                    }
                );

            return response.data;

        } catch (error) {

            handleError(error);

        }

    }

}

module.exports = new AccountClient();
