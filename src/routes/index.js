const express = require("express");

const healthModule = require("../modules/health");
const transferModule = require("../modules/transfer/transfer.routes");

const router = express.Router();

router.use("/", healthModule);
router.use("/", transferModule);

module.exports = router;
