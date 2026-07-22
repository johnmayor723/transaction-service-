require("express-async-errors");

const express = require("express");

const routes = require("./routes");

const correlationId = require("./middleware/correlation-id.middleware");
const requestLogger = require("./middleware/request-logger.middleware");
const notFoundMiddleware = require("./middleware/not-found.middleware");
const errorHandler = require("./middleware/error-handler.middleware");

const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

/**
 * Correlation ID must run before logging so every log line
 * (including this request's own) carries it.
 */
app.use(correlationId);

/**
 * Log every request.
 */
app.use(requestLogger);

/**
 * Register application routes.
 */
app.use(routes);

/**
 * Unknown routes.
 */
app.use(notFoundMiddleware);

/**
 * Global error handler.
 */
app.use(errorHandler);

module.exports = app;
