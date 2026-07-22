const config = require("../../config/app.config");

/**
 * ==========================================================
 * Fraud Service (dummy rule-based, v1)
 * ==========================================================
 *
 * A placeholder for a real fraud-scoring engine. The interface
 * (`assess()` returning a decision + reasons) is what matters —
 * swapping this for a real fraud service later (rules engine,
 * ML model, or an actual external Fraud Service over REST) does
 * not require changing anything that calls it.
 */
class FraudService {

    /**
     * Assess a transfer for fraud risk.
     */
    async assess({

        amount

    }) {

        const reasons = [];

        let decision = "ALLOW";

        if (amount >= config.fraud.reviewThreshold) {

            decision = "REVIEW";

            reasons.push(
                `Amount ${amount} meets or exceeds the review threshold of ${config.fraud.reviewThreshold}.`
            );

        }

        return {

            decision,

            reasons

        };

    }

}

module.exports = new FraudService();
