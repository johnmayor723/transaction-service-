module.exports = {
    ApiError: require("./api.error"),

    ValidationError: require("./classes/validation.error"),

    AuthenticationError: require("./classes/authentication.error"),

    UnauthorizedError: require("./classes/authentication.error"),

    AuthorizationError: require("./classes/authorization.error"),

    NotFoundError: require("./classes/not-found.error"),

    ConflictError: require("./classes/conflict.error"),

    BusinessRuleError: require("./classes/business-rule.error")
};
