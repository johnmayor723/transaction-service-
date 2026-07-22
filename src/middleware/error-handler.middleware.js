const { ApiError } = require("../errors");
const { app, logger } = require("../config");

const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        logger.error(
            {
                error: {
                    message: error.message,
                    stack: error.stack
                },
                correlationId: req.correlationId
            },
            "Unhandled application error."
        );

        error = new ApiError({
            statusCode: 500,
            message: "An unexpected error occurred.",
            errorCode: "SYS-5000",
            isOperational: false
        });
    }

    const response = {
        success: false,
        message: error.message,
        error: {
            code: error.errorCode,
            details: error.details
        },
        meta: {
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
        }
    };

    if (app.isDevelopment) {
        response.error.stack = err.stack;
    }

    return res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
