const { logger } = require("../config");

const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;

        logger.info(
            {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get("user-agent"),
                correlationId: req.correlationId
            },
            "Request completed."
        );
    });

    next();
};

module.exports = requestLogger;
