const mongoose = require("mongoose");

const app = require("./app.config");
const logger = require("./logger.config");

const connectDatabase = async () => {
    try {
        await mongoose.connect(app.mongo.uri, {
            dbName: app.mongo.database
        });

        logger.info("MongoDB Atlas connected successfully.");
    } catch (error) {
        logger.fatal(error, "Failed to connect to MongoDB Atlas.");
        process.exit(1);
    }
};

mongoose.connection.on("connected", () => {
    logger.info("MongoDB connection established.");
});

mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected.");
});

mongoose.connection.on("error", (error) => {
    logger.error(error, "MongoDB connection error.");
});

module.exports = {
    connectDatabase
};
