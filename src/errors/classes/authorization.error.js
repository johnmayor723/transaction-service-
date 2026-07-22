const ApiError = require("../api.error");

class AuthorizationError extends ApiError {
    constructor(
        message = "Access denied."
    ) {
        super({
            statusCode: 403,
            message,
            errorCode: "SYS-4030"
        });
    }
}

module.exports = AuthorizationError;
