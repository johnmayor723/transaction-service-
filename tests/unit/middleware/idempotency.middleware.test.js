jest.mock("../../../src/modules/idempotency/idempotency.repository");

const repository = require("../../../src/modules/idempotency/idempotency.repository");

const idempotency = require("../../../src/middleware/idempotency.middleware");

const makeRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const makeReq = (overrides = {}) => ({
    headers: {},
    body: { amount: 100 },
    user: { userId: "user-1" },
    ...overrides
});

describe("Idempotency Middleware", () => {

    afterEach(() => {
        jest.resetAllMocks();
    });

    test("rejects a request without an Idempotency-Key header", async () => {

        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("Idempotency-Key") })
        );

    });

    test("proceeds and wraps res.json on a fresh key", async () => {

        repository.findByKey.mockResolvedValue(null);
        repository.create.mockResolvedValue({});
        repository.markCompleted.mockResolvedValue({});

        const req = makeReq({ headers: { "idempotency-key": "key-1" } });
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(repository.create).toHaveBeenCalledWith(
            expect.objectContaining({ key: "key-1", status: "IN_PROGRESS" })
        );

        // Simulate the route handler sending a response.
        res.json({ success: true });

        expect(repository.markCompleted).toHaveBeenCalledWith(
            "key-1",
            expect.objectContaining({ responseBody: { success: true } })
        );

    });

    test("replays the cached response for a repeated key with the same payload", async () => {

        const requestHash = require("crypto")
            .createHash("sha256")
            .update(JSON.stringify({ amount: 100 }))
            .digest("hex");

        repository.findByKey.mockResolvedValue({
            requestHash,
            status: "COMPLETED",
            statusCode: 201,
            responseBody: { success: true, cached: true }
        });

        const req = makeReq({ headers: { "idempotency-key": "key-1" } });
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ success: true, cached: true });
        expect(next).not.toHaveBeenCalled();

    });

    test("rejects a repeated key with a different payload", async () => {

        repository.findByKey.mockResolvedValue({
            requestHash: "different-hash",
            status: "COMPLETED",
            statusCode: 201,
            responseBody: {}
        });

        const req = makeReq({ headers: { "idempotency-key": "key-1" } });
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("different request payload") })
        );

    });

    test("rejects a key still in flight", async () => {

        const requestHash = require("crypto")
            .createHash("sha256")
            .update(JSON.stringify({ amount: 100 }))
            .digest("hex");

        repository.findByKey.mockResolvedValue({
            requestHash,
            status: "IN_PROGRESS"
        });

        const req = makeReq({ headers: { "idempotency-key": "key-1" } });
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("already being processed") })
        );

    });

    test("handles a concurrent duplicate create (E11000) as in-flight", async () => {

        repository.findByKey.mockResolvedValue(null);

        const duplicateError = new Error("duplicate key");
        duplicateError.code = 11000;

        repository.create.mockRejectedValue(duplicateError);

        const req = makeReq({ headers: { "idempotency-key": "key-1" } });
        const res = makeRes();
        const next = jest.fn();

        await idempotency(req, res, next);

        expect(next).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("already being processed") })
        );

    });

});
