const ApiError = require("../api.error");

class ValidationError extends ApiError {
    constructor(
        message = "Validation failed.",
        details = null
    ) {
        super({
            statusCode: 400,
            message,
            errorCode: "SYS-4000",
            details
        });
    }
}

module.exports = ValidationError;
