jest.mock("../../../src/modules/standing-order/standing-order.repository");
jest.mock("../../../src/modules/otp/otp.service");
jest.mock("../../../src/modules/fraud/fraud.service");
jest.mock("../../../src/modules/limits/limits.service");
jest.mock("../../../src/integrations/account/account.client");

const repository = require("../../../src/modules/standing-order/standing-order.repository");
const otpService = require("../../../src/modules/otp/otp.service");
const fraudService = require("../../../src/modules/fraud/fraud.service");
const limitsService = require("../../../src/modules/limits/limits.service");
const accountClient = require("../../../src/integrations/account/account.client");

const standingOrderService = require("../../../src/modules/standing-order/standing-order.service");

const user = { userId: "user-1", accountNumber: "1111111111" };

const fakeRequest = () => ({ correlationId: "corr-1", headers: {} });

describe("Standing Order Service", () => {

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("initiate", () => {

        test("creates a PENDING_OTP order and sends the OTP", async () => {

            accountClient.getAccount.mockResolvedValue({
                accountNumber: "1111111111",
                status: "ACTIVE",
                email: "jane@example.com",
                phoneNumber: "08000000000"
            });

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });
            repository.create.mockResolvedValue({ id: "order-1" });
            otpService.sendTransferOtp.mockResolvedValue({ expiresAt: new Date(), code: "111111", channel: "EMAIL" });
            repository.updateStatus.mockResolvedValue({});

            const result = await standingOrderService.initiate(
                user,
                {
                    destinationAccountNumber: "2222222222",
                    amount: 1000,
                    frequency: "MONTHLY",
                    startDate: "2026-02-01T00:00:00.000Z"
                },
                fakeRequest()
            );

            expect(result.standingOrderId).toBe("order-1");
            expect(result.status).toBe("PENDING_OTP");

        });

        test("rejects source and destination being the same account", async () => {

            accountClient.getAccount.mockResolvedValue({
                accountNumber: "1111111111",
                status: "ACTIVE"
            });

            await expect(
                standingOrderService.initiate(
                    user,
                    {
                        destinationAccountNumber: "1111111111",
                        amount: 1000,
                        frequency: "MONTHLY",
                        startDate: "2026-02-01T00:00:00.000Z"
                    },
                    fakeRequest()
                )
            ).rejects.toThrow("must be different");

        });

    });

    describe("confirm", () => {

        test("activates the order and sets nextRunAt to the future startDate", async () => {

            const futureStart = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "user-1",
                status: "PENDING_OTP",
                otpChannel: "EMAIL",
                frequency: "MONTHLY",
                startDate: futureStart
            });

            otpService.verifyTransferOtp.mockResolvedValue(true);

            repository.updateStatus.mockImplementation(async (id, { extra }) => ({
                id,
                status: "ACTIVE",
                nextRunAt: extra.nextRunAt
            }));

            const result = await standingOrderService.confirm(user, "order-1", "111111");

            expect(result.status).toBe("ACTIVE");
            expect(result.nextRunAt.getTime()).toBe(futureStart.getTime());

        });

        test("rejects confirming someone else's order", async () => {

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "someone-else",
                status: "PENDING_OTP"
            });

            await expect(
                standingOrderService.confirm(user, "order-1", "111111")
            ).rejects.toThrow("does not belong to you");

        });

    });

    describe("pause / resume / cancel", () => {

        test("pause rejects a non-active order", async () => {

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "user-1",
                status: "PAUSED"
            });

            await expect(
                standingOrderService.pause(user, "order-1")
            ).rejects.toThrow("Only an active standing order can be paused");

        });

        test("resume rejects a non-paused order", async () => {

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "user-1",
                status: "ACTIVE"
            });

            await expect(
                standingOrderService.resume(user, "order-1")
            ).rejects.toThrow("Only a paused standing order can be resumed");

        });

        test("cancel rejects an already-cancelled order", async () => {

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "user-1",
                status: "CANCELLED"
            });

            await expect(
                standingOrderService.cancel(user, "order-1")
            ).rejects.toThrow("already cancelled");

        });

        test("cancel succeeds on an active order", async () => {

            repository.findById.mockResolvedValue({
                id: "order-1",
                initiatorUserId: "user-1",
                status: "ACTIVE"
            });

            repository.updateStatus.mockResolvedValue({
                id: "order-1",
                status: "CANCELLED"
            });

            const result = await standingOrderService.cancel(user, "order-1");

            expect(result.status).toBe("CANCELLED");

        });

    });

});
