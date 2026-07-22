jest.mock("../../../src/modules/transfer/transfer.repository");
jest.mock("../../../src/modules/transfer/transfer.service");
jest.mock("../../../src/modules/standing-order/standing-order.repository");
jest.mock("../../../src/modules/fraud/fraud.service");
jest.mock("../../../src/modules/limits/limits.service");
jest.mock("../../../src/integrations/account/account.client");

const transferRepository = require("../../../src/modules/transfer/transfer.repository");
const transferService = require("../../../src/modules/transfer/transfer.service");
const standingOrderRepository = require("../../../src/modules/standing-order/standing-order.repository");
const fraudService = require("../../../src/modules/fraud/fraud.service");
const limitsService = require("../../../src/modules/limits/limits.service");
const accountClient = require("../../../src/integrations/account/account.client");

const scheduler = require("../../../src/modules/scheduler/scheduler.service");

describe("Scheduler Service", () => {

    afterEach(() => {
        jest.resetAllMocks();
        scheduler.isRunning = false;
    });

    describe("processDueTransfers", () => {

        test("executes a due scheduled transfer", async () => {

            transferRepository.findScheduledDue.mockResolvedValue([
                { id: "transfer-1", initiatorUserId: "user-1", amount: 1000, correlationId: "corr-1" }
            ]);

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });
            transferRepository.updateStatus.mockResolvedValue({});
            transferService.executeMovement.mockResolvedValue({ status: "SUCCESSFUL" });

            await scheduler.processDueTransfers();

            expect(transferService.executeMovement).toHaveBeenCalled();

        });

        test("marks a transfer FAILED when limits reject it before execution", async () => {

            transferRepository.findScheduledDue.mockResolvedValue([
                { id: "transfer-1", initiatorUserId: "user-1", amount: 1000 }
            ]);

            limitsService.check.mockRejectedValue(new Error("Daily limit exceeded."));
            transferRepository.findById.mockResolvedValue({ id: "transfer-1", status: "SCHEDULED" });
            transferRepository.updateStatus.mockResolvedValue({});

            await scheduler.processDueTransfers();

            expect(transferService.executeMovement).not.toHaveBeenCalled();

            expect(transferRepository.updateStatus).toHaveBeenCalledWith(
                "transfer-1",
                expect.objectContaining({ status: "FAILED" })
            );

        });

        test("does not double-mark FAILED when executeMovement already did", async () => {

            transferRepository.findScheduledDue.mockResolvedValue([
                { id: "transfer-1", initiatorUserId: "user-1", amount: 1000 }
            ]);

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });
            transferRepository.updateStatus.mockResolvedValue({});
            transferService.executeMovement.mockRejectedValue(new Error("Fineract unavailable"));

            transferRepository.findById.mockResolvedValue({ id: "transfer-1", status: "FAILED" });

            await scheduler.processDueTransfers();

            // Only the "PROCESSING" transition should have called
            // updateStatus — not a second FAILED one, since the
            // transfer is already FAILED by the time we check.
            const failedCalls = transferRepository.updateStatus.mock.calls.filter(
                ([, arg]) => arg.status === "FAILED"
            );

            expect(failedCalls).toHaveLength(0);

        });

    });

    describe("processDueStandingOrders", () => {

        test("creates a Transfer and advances nextRunAt for a due order", async () => {

            const nextRunAt = new Date("2026-01-01T00:00:00.000Z");

            standingOrderRepository.findActiveDue.mockResolvedValue([
                {
                    id: "order-1",
                    initiatorUserId: "user-1",
                    sourceAccountNumber: "1111111111",
                    destinationAccountNumber: "2222222222",
                    destinationBankCode: null,
                    amount: 1000,
                    narration: null,
                    reference: "SO123",
                    frequency: "MONTHLY",
                    nextRunAt,
                    executionCount: 0,
                    maxExecutions: null,
                    endDate: null
                }
            ]);

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });

            accountClient.getAccount.mockImplementation(async (accountNumber) => ({
                accountNumber,
                clientId: "1"
            }));

            transferRepository.create.mockResolvedValue({ id: "transfer-x" });
            transferService.executeMovement.mockResolvedValue({ status: "SUCCESSFUL" });
            standingOrderRepository.updateStatus.mockResolvedValue({});

            await scheduler.processDueStandingOrders();

            expect(transferRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ standingOrderId: "order-1", amount: 1000 })
            );

            expect(standingOrderRepository.updateStatus).toHaveBeenCalledWith(
                "order-1",
                expect.objectContaining({
                    status: "ACTIVE",
                    extra: expect.objectContaining({ executionCount: 1 })
                })
            );

        });

        test("completes the order once maxExecutions is reached", async () => {

            standingOrderRepository.findActiveDue.mockResolvedValue([
                {
                    id: "order-1",
                    initiatorUserId: "user-1",
                    sourceAccountNumber: "1111111111",
                    destinationAccountNumber: "2222222222",
                    destinationBankCode: null,
                    amount: 1000,
                    narration: null,
                    reference: "SO123",
                    frequency: "MONTHLY",
                    nextRunAt: new Date(),
                    executionCount: 2,
                    maxExecutions: 3,
                    endDate: null
                }
            ]);

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });

            accountClient.getAccount.mockImplementation(async (accountNumber) => ({
                accountNumber,
                clientId: "1"
            }));

            transferRepository.create.mockResolvedValue({ id: "transfer-x" });
            transferService.executeMovement.mockResolvedValue({ status: "SUCCESSFUL" });
            standingOrderRepository.updateStatus.mockResolvedValue({});

            await scheduler.processDueStandingOrders();

            expect(standingOrderRepository.updateStatus).toHaveBeenCalledWith(
                "order-1",
                expect.objectContaining({ status: "COMPLETED" })
            );

        });

    });

});
