const express = require("express");

const router = express.Router();

const controller = require("./standing-order.controller");

const validator = require("./standing-order.validator");

const validate = require("../../middleware/validation.middleware");

const authenticate = require("../../middleware/authenticate.middleware");

const idempotency = require("../../middleware/idempotency.middleware");

/**
 * Initiate Standing Order
 */
router.post(
    "/standing-orders",
    authenticate,
    validator.initiate,
    validate,
    idempotency,
    controller.initiate
);

/**
 * Confirm Standing Order
 */
router.post(
    "/standing-orders/:id/confirm",
    authenticate,
    validator.confirm,
    validate,
    idempotency,
    controller.confirm
);

/**
 * Standing Order History
 */
router.get(
    "/standing-orders",
    authenticate,
    validator.history,
    validate,
    controller.history
);

/**
 * Get Standing Order By ID
 */
router.get(
    "/standing-orders/:id",
    authenticate,
    validator.getById,
    validate,
    controller.getById
);

/**
 * Cancel Standing Order
 */
router.post(
    "/standing-orders/:id/cancel",
    authenticate,
    validator.getById,
    validate,
    controller.cancel
);

/**
 * Pause Standing Order
 */
router.post(
    "/standing-orders/:id/pause",
    authenticate,
    validator.getById,
    validate,
    controller.pause
);

/**
 * Resume Standing Order
 */
router.post(
    "/standing-orders/:id/resume",
    authenticate,
    validator.getById,
    validate,
    controller.resume
);

module.exports = router;
