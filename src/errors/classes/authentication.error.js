const ApiError = require("../api.error");

class AuthenticationError extends ApiError {
    constructor(
        message = "Authentication failed."
    ) {
        super({
            statusCode: 401,
            message,
            errorCode: "SYS-4010"
        });
    }
}

module.exports = AuthenticationError;
