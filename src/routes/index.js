const express = require("express");

const healthModule = require("../modules/health");
const transferModule = require("../modules/transfer/transfer.routes");
const standingOrderModule = require("../modules/standing-order/standing-order.routes");
const bulkTransferModule = require("../modules/bulk-transfer/bulk-transfer.routes");

const router = express.Router();

router.use("/", healthModule);
router.use("/", transferModule);
router.use("/", standingOrderModule);
router.use("/", bulkTransferModule);

module.exports = router;
