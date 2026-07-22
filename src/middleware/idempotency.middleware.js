const crypto = require("crypto");

const repository = require("../modules/idempotency/idempotency.repository");

const { ValidationError, ConflictError } = require("../errors");

const hashPayload = (payload) =>
    crypto
        .createHash("sha256")
        .update(JSON.stringify(payload || {}))
        .digest("hex");

/**
 * ==========================================================
 * Idempotency
 * ==========================================================
 *
 * Requires an Idempotency-Key header on money-moving
 * endpoints. Replays the cached response for a repeated
 * key + identical payload; rejects a repeated key with a
 * different payload, or a key still in flight.
 */
const idempotency = async (req, res, next) => {

    const key =
        req.headers["idempotency-key"];

    if (!key) {

        return next(
            new ValidationError(
                "Idempotency-Key header is required."
            )
        );

    }

    const requestHash =
        hashPayload(req.body);

    const existing =
        await repository.findByKey(key);

    if (existing) {

        if (existing.requestHash !== requestHash) {

            return next(
                new ConflictError(
                    "Idempotency-Key has already been used with a different request payload."
                )
            );

        }

        if (existing.status === "IN_PROGRESS") {

            return next(
                new ConflictError(
                    "A request with this Idempotency-Key is already being processed."
                )
            );

        }

        return res
            .status(existing.statusCode)
            .json(existing.responseBody);

    }

    try {

        await repository.create({

            key,

            userId:
                req.user ? req.user.userId : "anonymous",

            requestHash,

            status: "IN_PROGRESS"

        });

    } catch (error) {

        /**
         * Concurrent duplicate submission — the record was
         * created by a request that arrived a moment earlier.
         */
        if (error.code === 11000) {

            return next(
                new ConflictError(
                    "A request with this Idempotency-Key is already being processed."
                )
            );

        }

        throw error;

    }

    /**
     * Cache the eventual response (success or error — the
     * global error handler also responds via res.json).
     */
    const originalJson =
        res.json.bind(res);

    res.json = (body) => {

        repository.markCompleted(
            key,
            {
                statusCode: res.statusCode,
                responseBody: body
            }
        ).catch(() => {});

        return originalJson(body);

    };

    next();

};

module.exports = idempotency;
