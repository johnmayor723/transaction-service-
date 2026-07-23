const BulkTransfer = require("./bulk-transfer.model");

class BulkTransferRepository {

    /**
     * Create a bulk transfer.
     */
    async create(data) {

        return BulkTransfer.create(data);

    }

    /**
     * Find by ID.
     */
    async findById(id) {

        return BulkTransfer.findById(id);

    }

    /**
     * Find paginated bulk transfers for a user, newest first.
     */
    async findByUserId(
        userId,
        {
            page = 1,
            limit = 20
        } = {}
    ) {

        return BulkTransfer
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
     * Count bulk transfers for a user.
     */
    async countByUserId(userId) {

        return BulkTransfer.countDocuments({
            initiatorUserId: userId
        });

    }

    /**
     * Atomically transition status only if it still matches
     * fromStatus — closes the race where two concurrent confirm
     * requests for the same batch could otherwise both pass their
     * pre-checks and both process every item. Returns null if
     * another request already claimed it.
     */
    async transitionStatus(
        id,
        {
            fromStatus,
            status,
            message,
            extra = {}
        }
    ) {

        return BulkTransfer.findOneAndUpdate(

            {
                _id: id,
                status: fromStatus
            },

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

        return BulkTransfer.findByIdAndUpdate(

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

    /**
     * Update a single item within the batch by its index.
     */
    async updateItem(id, itemIndex, itemUpdate) {

        const setObject = {};

        Object.keys(itemUpdate).forEach((key) => {

            setObject[`items.${itemIndex}.${key}`] = itemUpdate[key];

        });

        return BulkTransfer.findByIdAndUpdate(

            id,

            {
                $set: setObject
            },

            {
                new: true
            }

        );

    }

}

module.exports = new BulkTransferRepository();
