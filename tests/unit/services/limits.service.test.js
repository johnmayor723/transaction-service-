jest.mock("../../../src/modules/limits/limits.repository");

const repository = require("../../../src/modules/limits/limits.repository");

const limitsService = require("../../../src/modules/limits/limits.service");

describe("Limits Service", () => {

    afterEach(() => {
        jest.resetAllMocks();
    });

    test("rejects an amount above the per-transaction limit", async () => {

        await expect(
            limitsService.check({ userId: "user-1", amount: 6000000 })
        ).rejects.toThrow("maximum per-transaction limit");

    });

    test("allows an amount within limits when no prior usage exists", async () => {

        repository.findByUserAndDate.mockResolvedValue(null);

        await expect(
            limitsService.check({ userId: "user-1", amount: 100000 })
        ).resolves.toBeUndefined();

    });

    test("rejects when cumulative daily usage would exceed the daily limit", async () => {

        repository.findByUserAndDate.mockResolvedValue({
            totalAmount: 9950000
        });

        await expect(
            limitsService.check({ userId: "user-1", amount: 100000 })
        ).rejects.toThrow("daily limit");

    });

    test("recordUsage delegates to the repository", async () => {

        await limitsService.recordUsage("user-1", 50000);

        expect(repository.incrementUsage).toHaveBeenCalledWith(
            "user-1",
            expect.any(String),
            50000
        );

    });

});
