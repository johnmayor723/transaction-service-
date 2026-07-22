const fraudService = require("../../../src/modules/fraud/fraud.service");

describe("Fraud Service", () => {

    test("allows an amount below the review threshold", async () => {

        const result = await fraudService.assess({ amount: 100000 });

        expect(result.decision).toBe("ALLOW");
        expect(result.reasons).toEqual([]);

    });

    test("flags an amount at or above the review threshold", async () => {

        const result = await fraudService.assess({ amount: 2000000 });

        expect(result.decision).toBe("REVIEW");
        expect(result.reasons.length).toBeGreaterThan(0);

    });

});
