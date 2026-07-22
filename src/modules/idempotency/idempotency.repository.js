const IdempotencyRecord = require("./idempotency.model");

class IdempotencyRepository {

    /**
     * Find by idempotency key.
     */
    async findByKey(key) {

        return IdempotencyRecord.findOne({
            key
        });

    }

    /**
     * Create a new in-progress record.
     */
    async create(data) {

        return IdempotencyRecord.create(data);

    }

    /**
     * Mark a record completed with its final response.
     */
    async markCompleted(
        key,
        {
            statusCode,
            responseBody
        }
    ) {

        return IdempotencyRecord.findOneAndUpdate(
            {
                key
            },
            {
                status: "COMPLETED",
                statusCode,
                responseBody
            },
            {
                new: true
            }
        );

    }

}

module.exports = new IdempotencyRepository();
