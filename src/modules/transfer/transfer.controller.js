const service = require("./transfer.service");

const { success, created } = require("../../responses/api.response");

/**
 * Initiate Transfer
 */
const initiate = async (req, res) => {

    const result =
        await service.initiate(req.user, req.body, req);

    return created(res, {
        message: "Transfer initiated. Enter the OTP to confirm.",
        data: result
    });

};

/**
 * Confirm Transfer
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
        message: "Transfer confirmed.",
        data: result
    });

};

/**
 * Get Transfer By ID
 */
const getById = async (req, res) => {

    const result =
        await service.getById(req.user, req.params.id);

    return success(res, {
        message: "Transfer retrieved successfully.",
        data: result
    });

};

/**
 * Transfer History
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
        message: "Transfer history retrieved successfully.",
        data: result
    });

};

module.exports = {

    initiate,

    confirm,

    getById,

    history

};
