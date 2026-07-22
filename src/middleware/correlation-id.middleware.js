const crypto = require("crypto");

const HEADER = "x-correlation-id";

const correlationId = (req, res, next) => {

    const incoming =
        req.headers[HEADER];

    req.correlationId =
        incoming || crypto.randomUUID();

    res.setHeader(
        "X-Correlation-Id",
        req.correlationId
    );

    next();

};

module.exports = correlationId;
