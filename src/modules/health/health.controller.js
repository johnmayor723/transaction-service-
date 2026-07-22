const { app } = require("../../config");
const { success } = require("../../responses/api.response");

const health = async (req, res) => {
    return success(res, {
        message: "Service is healthy.",
        data: {
            service: app.serviceName,
            version: app.version,
            environment: app.environment
        }
    });
};

module.exports = {
    health
};
