const crypto = require("crypto");

/**
 * ==========================================================
 * Dummy NIP Adapter
 * ==========================================================
 *
 * Placeholder for the real NIBSS NIP integration. Implements
 * the same interface the live adapter will implement later
 * (`initiateNip()`), so switching NIBSS_PROVIDER from "dummy"
 * to "live" once NIBSS is configured is a config change, not
 * a rewrite of anything that calls this.
 */
class DummyNibssAdapter {

    async initiateNip({

        sourceAccountNumber,

        destinationBankCode,

        destinationAccountNumber,

        amount,

        narration

    }) {

        /**
         * Simulate a realistic NIP round-trip.
         */
        await new Promise(
            (resolve) => setTimeout(resolve, 300)
        );

        return {

            sessionId:
                `DUMMY-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,

            status: "SUCCESSFUL",

            reference:
                `NIP${Date.now()}`,

            provider: "DUMMY"

        };

    }

}

module.exports = new DummyNibssAdapter();
