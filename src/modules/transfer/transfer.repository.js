const Transfer = require("./transfer.model");

class TransferRepository {

    /**
     * Create a transfer.
     */
    async create(data) {

        return Transfer.create(data);

    }

    /**
     * Find by ID.
     */
    async findById(id) {

        return Transfer.findById(id);

    }

    /**
     * Find paginated transfers for a user, newest first.
     */
    async findByUserId(
        userId,
        {
            page = 1,
            limit = 20
        } = {}
    ) {

        return Transfer
            .find({
                initiatorUserId: userId
            })
            .sort({
                createdAt: -1
            })
            .skip((page - 1) * limit)
            .limit(limit);

    }

    /**
     * Count transfers for a user.
     */
    async countByUserId(userId) {

        return Transfer.countDocuments({
            initiatorUserId: userId
        });

    }

    /**
     * Transition status, appending to the audit history.
     */
    async updateStatus(
        id,
        {
            status,
            message,
            extra = {}
        }
    ) {

        return Transfer.findByIdAndUpdate(

            id,

            {

                status,

                ...extra,

                $push: {

                    statusHistory: {
                        status,
                        message,
                        changedAt: new Date()
                    }

                }

            },

            {
                new: true
            }

        );

    }

}

module.exports = new TransferRepository();
