const DailyLimit = require("./limits.model");

class LimitsRepository {

    /**
     * Find a user's usage record for a given date.
     */
    async findByUserAndDate(
        userId,
        date
    ) {

        return DailyLimit.findOne({
            userId,
            date
        });

    }

    /**
     * Increment a user's usage for a given date.
     */
    async incrementUsage(
        userId,
        date,
        amount
    ) {

        return DailyLimit.findOneAndUpdate(

            {
                userId,
                date
            },

            {
                $inc: {
                    totalAmount: amount,
                    transactionCount: 1
                }
            },

            {
                upsert: true,
                new: true
            }

        );

    }

}

module.exports = new LimitsRepository();
