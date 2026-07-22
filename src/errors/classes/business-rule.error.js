const ApiError = require("../api.error");

class BusinessRuleError extends ApiError {
    constructor(
        message = "Business rule violated."
    ) {
        super({
            statusCode: 422,
            message,
            errorCode: "SYS-4220"
        });
    }
}

module.exports = BusinessRuleError;
