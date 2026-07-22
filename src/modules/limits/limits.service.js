const repository = require("./limits.repository");

const config = require("../../config/app.config");

const { BusinessRuleError } = require("../../errors");

const todayString = () =>
    new Date().toISOString().slice(0, 10);

/**
 * ==========================================================
 * Limits Service (dummy rule-based, v1)
 * ==========================================================
 *
 * Same "clean interface, swappable implementation" approach
 * as the Fraud module — `check()`/`recordUsage()` can later be
 * backed by a real standalone Limits Service without changing
 * how Transfer Service calls them.
 */
class LimitsService {

    /**
     * Check a proposed transfer against per-transaction and
     * daily limits. Throws if either is exceeded.
     */
    async check({

        userId,

        amount

    }) {

        if (amount > config.limits.maxTransactionAmount) {

            throw new BusinessRuleError(
                `Amount exceeds the maximum per-transaction limit of ${config.limits.maxTransactionAmount}.`
            );

        }

        const record =
            await repository.findByUserAndDate(
                userId,
                todayString()
            );

        const usedToday =
            record ? record.totalAmount : 0;

        if (usedToday + amount > config.limits.maxDailyAmount) {

            throw new BusinessRuleError(
                `This transfer would exceed the daily limit of ${config.limits.maxDailyAmount}.`
            );

        }

    }

    /**
     * Record usage against the daily limit once a transfer
     * has actually succeeded.
     */
    async recordUsage(
        userId,
        amount
    ) {

        return repository.incrementUsage(
            userId,
            todayString(),
            amount
        );

    }

}

module.exports = new LimitsService();
