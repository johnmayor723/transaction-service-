const { NotFoundError } = require("../errors");

const notFoundMiddleware = (req, res, next) => {
    next(
        new NotFoundError(
            `Route ${req.method} ${req.originalUrl} was not found.`
        )
    );
};

module.exports = notFoundMiddleware;
