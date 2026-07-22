const StandingOrder = require("./standing-order.model");

class StandingOrderRepository {

    /**
     * Create a standing order.
     */
    async create(data) {

        return StandingOrder.create(data);

    }

    /**
     * Find by ID.
     */
    async findById(id) {

        return StandingOrder.findById(id);

    }

    /**
     * Find paginated standing orders for a user, newest first.
     */
    async findByUserId(
        userId,
        {
            page = 1,
            limit = 20
        } = {}
    ) {

        return StandingOrder
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
     * Count standing orders for a user.
     */
    async countByUserId(userId) {

        return StandingOrder.countDocuments({
            initiatorUserId: userId
        });

    }

    /**
     * Find ACTIVE standing orders whose nextRunAt is now due.
     */
    async findActiveDue(now = new Date()) {

        return StandingOrder.find({
            status: "ACTIVE",
            nextRunAt: { $lte: now }
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

        return StandingOrder.findByIdAndUpdate(

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

module.exports = new StandingOrderRepository();
