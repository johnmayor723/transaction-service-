const config = require("../../config/app.config");

const dummyAdapter = require("./dummy.adapter");

/**
 * Provider selection — only "dummy" exists today. Adding a
 * real NIBSS adapter later means adding a "live" entry here
 * and setting NIBSS_PROVIDER=live; nothing that calls
 * `adapter.initiateNip()` needs to change.
 */
const providers = {
    dummy: dummyAdapter
};

const adapter =
    providers[config.nibss.provider] || dummyAdapter;

module.exports = {
    adapter
};
