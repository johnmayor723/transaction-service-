const app = require("./app");

const {
    app: appConfig,
    logger,
    database
} = require("./config");

const start = async () => {
    try {
        await database.connectDatabase();

        const server = app.listen(appConfig.port, () => {
            logger.info(
                {
                    service: appConfig.serviceName,
                    environment: appConfig.environment,
                    version: appConfig.version,
                    port: appConfig.port
                },
                "Application started successfully."
            );
        });

        const shutdown = async (signal) => {
            logger.info(`${signal} received. Shutting down gracefully...`);

            server.close(async () => {
                const mongoose = require("mongoose");
                await mongoose.connection.close();

                logger.info("Application shutdown complete.");
                process.exit(0);
            });
        };

        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));

        server.on("error", (error) => {
            logger.fatal(error, "Server startup failed.");
            process.exit(1);
        });

    } catch (error) {
        logger.fatal(error, "Application startup failed.");
        process.exit(1);
    }
};

start();
