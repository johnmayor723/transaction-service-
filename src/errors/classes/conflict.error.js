const ApiError = require("../api.error");

class ConflictError extends ApiError {
    constructor(
        message = "Resource already exists."
    ) {
        super({
            statusCode: 409,
            message,
            errorCode: "SYS-4090"
        });
    }
}

module.exports = ConflictError;
