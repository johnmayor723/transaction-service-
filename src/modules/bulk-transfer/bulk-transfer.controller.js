const service = require("./bulk-transfer.service");

const { success, created } = require("../../responses/api.response");

/**
 * Initiate Bulk Transfer
 */
const initiate = async (req, res) => {

    const result =
        await service.initiate(req.user, req.body, req);

    return created(res, {
        message: "Bulk transfer initiated. Enter the OTP to confirm.",
        data: result
    });

};

/**
 * Confirm Bulk Transfer
 */
const confirm = async (req, res) => {

    const result =
        await service.confirm(
            req.user,
            req.params.id,
            req.body.code,
            req
        );

    return success(res, {
        message: "Bulk transfer processed.",
        data: result
    });

};

/**
 * Get Bulk Transfer By ID
 */
const getById = async (req, res) => {

    const result =
        await service.getById(req.user, req.params.id);

    return success(res, {
        message: "Bulk transfer retrieved successfully.",
        data: result
    });

};

/**
 * Bulk Transfer History
 */
const history = async (req, res) => {

    const {
        page,
        limit
    } = req.query;

    const result =
        await service.history(req.user, {

            page:
                page ? Number(page) : 1,

            limit:
                limit ? Number(limit) : 20

        });

    return success(res, {
        message: "Bulk transfers retrieved successfully.",
        data: result
    });

};

module.exports = {

    initiate,

    confirm,

    getById,

    history

};
