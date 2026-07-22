const { validationResult } = require("express-validator");

const { ValidationError } = require("../errors");

const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        return next();
    }

    const formattedErrors = errors.array().map((error) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
    }));

    return next(
        new ValidationError(
            "Request validation failed.",
            formattedErrors
        )
    );
};

module.exports = validate;
