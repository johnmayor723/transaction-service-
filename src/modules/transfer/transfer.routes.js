const express = require("express");

const router = express.Router();

const controller = require("./transfer.controller");

const validator = require("./transfer.validator");

const validate = require("../../middleware/validation.middleware");

const authenticate = require("../../middleware/authenticate.middleware");

const idempotency = require("../../middleware/idempotency.middleware");

/**
 * Initiate Transfer
 */
router.post(
    "/transfers",
    authenticate,
    validator.initiate,
    validate,
    idempotency,
    controller.initiate
);

/**
 * Confirm Transfer
 */
router.post(
    "/transfers/:id/confirm",
    authenticate,
    validator.confirm,
    validate,
    idempotency,
    controller.confirm
);

/**
 * Transfer History
 */
router.get(
    "/transfers",
    authenticate,
    validator.history,
    validate,
    controller.history
);

/**
 * Get Transfer By ID
 */
router.get(
    "/transfers/:id",
    authenticate,
    validator.getById,
    validate,
    controller.getById
);

module.exports = router;
