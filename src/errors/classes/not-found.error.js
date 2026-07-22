const ApiError = require("../api.error");

class NotFoundError extends ApiError {
    constructor(
        message = "Resource not found."
    ) {
        super({
            statusCode: 404,
            message,
            errorCode: "SYS-4040"
        });
    }
}

module.exports = NotFoundError;
