/**
 * ==========================================================
 * Standard API Response Builder
 * ==========================================================
 */

const success = (
    res,
    {
        statusCode = 200,
        message = "Operation completed successfully.",
        data = null,
        meta = {}
    } = {}
) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta
        }
    });
};

const created = (
    res,
    {
        message = "Resource created successfully.",
        data = null,
        meta = {}
    } = {}
) => {
    return success(res, {
        statusCode: 201,
        message,
        data,
        meta
    });
};

const noContent = (res) => {
    return res.status(204).send();
};

module.exports = {
    success,
    created,
    noContent
};
