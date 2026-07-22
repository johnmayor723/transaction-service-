const service = require("./standing-order.service");

const { success, created } = require("../../responses/api.response");

/**
 * Initiate Standing Order
 */
const initiate = async (req, res) => {

    const result =
        await service.initiate(req.user, req.body, req);

    return created(res, {
        message: "Standing order initiated. Enter the OTP to confirm.",
        data: result
    });

};

/**
 * Confirm Standing Order
 */
const confirm = async (req, res) => {

    const result =
        await service.confirm(
            req.user,
            req.params.id,
            req.body.code
        );

    return success(res, {
        message: "Standing order confirmed and active.",
        data: result
    });

};

/**
 * Cancel Standing Order
 */
const cancel = async (req, res) => {

    const result =
        await service.cancel(req.user, req.params.id);

    return success(res, {
        message: "Standing order cancelled.",
        data: result
    });

};

/**
 * Pause Standing Order
 */
const pause = async (req, res) => {

    const result =
        await service.pause(req.user, req.params.id);

    return success(res, {
        message: "Standing order paused.",
        data: result
    });

};

/**
 * Resume Standing Order
 */
const resume = async (req, res) => {

    const result =
        await service.resume(req.user, req.params.id);

    return success(res, {
        message: "Standing order resumed.",
        data: result
    });

};

/**
 * Get Standing Order By ID
 */
const getById = async (req, res) => {

    const result =
        await service.getById(req.user, req.params.id);

    return success(res, {
        message: "Standing order retrieved successfully.",
        data: result
    });

};

/**
 * Standing Order History
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
        message: "Standing orders retrieved successfully.",
        data: result
    });

};

module.exports = {

    initiate,

    confirm,

    cancel,

    pause,

    resume,

    getById,

    history

};
