const express = require("express");

const router = express.Router();

const controller = require("./bulk-transfer.controller");

const validator = require("./bulk-transfer.validator");

const validate = require("../../middleware/validation.middleware");

const authenticate = require("../../middleware/authenticate.middleware");

const idempotency = require("../../middleware/idempotency.middleware");

/**
 * Initiate Bulk Transfer
 */
router.post(
    "/bulk-transfers",
    authenticate,
    validator.initiate,
    validate,
    idempotency,
    controller.initiate
);

/**
 * Confirm Bulk Transfer
 */
router.post(
    "/bulk-transfers/:id/confirm",
    authenticate,
    validator.confirm,
    validate,
    idempotency,
    controller.confirm
);

/**
 * Bulk Transfer History
 */
router.get(
    "/bulk-transfers",
    authenticate,
    validator.history,
    validate,
    controller.history
);

/**
 * Get Bulk Transfer By ID
 */
router.get(
    "/bulk-transfers/:id",
    authenticate,
    validator.getById,
    validate,
    controller.getById
);

module.exports = router;
