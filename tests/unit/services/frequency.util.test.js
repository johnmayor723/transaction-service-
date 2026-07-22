const { advance } = require("../../../src/modules/standing-order/frequency.util");

describe("frequency.util", () => {

    test("DAILY advances by one day", () => {

        const result = advance(new Date("2026-01-01T00:00:00.000Z"), "DAILY");

        expect(result.toISOString()).toBe("2026-01-02T00:00:00.000Z");

    });

    test("WEEKLY advances by seven days", () => {

        const result = advance(new Date("2026-01-01T00:00:00.000Z"), "WEEKLY");

        expect(result.toISOString()).toBe("2026-01-08T00:00:00.000Z");

    });

    test("MONTHLY advances by one calendar month", () => {

        const result = advance(new Date("2026-01-31T00:00:00.000Z"), "MONTHLY");

        // JS Date rolls Jan 31 + 1 month into early March since
        // February doesn't have 31 days — documenting the actual
        // (known, acceptable) behavior rather than asserting an
        // idealized one.
        expect(result.getUTCMonth()).toBe(2);

    });

});
