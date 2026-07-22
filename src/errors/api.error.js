/**
 * ==========================================================
 * Base API Error
 * ==========================================================
 */

class ApiError extends Error {
    constructor({
        statusCode = 500,
        message = "Internal Server Error.",
        errorCode = "SYS-5000",
        isOperational = true,
        details = null
    }) {
        super(message);

        this.name = this.constructor.name;

        this.statusCode = statusCode;

        this.errorCode = errorCode;

        this.isOperational = isOperational;

        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;
