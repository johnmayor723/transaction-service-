jest.mock("../../../src/modules/bulk-transfer/bulk-transfer.repository");
jest.mock("../../../src/modules/transfer/transfer.repository");
jest.mock("../../../src/modules/transfer/transfer.service");
jest.mock("../../../src/modules/otp/otp.service");
jest.mock("../../../src/modules/fraud/fraud.service");
jest.mock("../../../src/modules/limits/limits.service");
jest.mock("../../../src/integrations/account/account.client");

const repository = require("../../../src/modules/bulk-transfer/bulk-transfer.repository");
const transferRepository = require("../../../src/modules/transfer/transfer.repository");
const transferService = require("../../../src/modules/transfer/transfer.service");
const otpService = require("../../../src/modules/otp/otp.service");
const fraudService = require("../../../src/modules/fraud/fraud.service");
const limitsService = require("../../../src/modules/limits/limits.service");
const accountClient = require("../../../src/integrations/account/account.client");

const bulkTransferService = require("../../../src/modules/bulk-transfer/bulk-transfer.service");

const user = { userId: "user-1", accountNumber: "1111111111" };

const fakeRequest = () => ({ correlationId: "corr-1", headers: {} });

describe("Bulk Transfer Service", () => {

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("initiate", () => {

        test("sums totalAmount and creates a PENDING_OTP batch", async () => {

            accountClient.getAccount.mockResolvedValue({
                accountNumber: "1111111111",
                status: "ACTIVE",
                email: "jane@example.com",
                phoneNumber: "08000000000"
            });

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });
            repository.create.mockResolvedValue({ id: "bulk-1" });
            otpService.sendTransferOtp.mockResolvedValue({ expiresAt: new Date(), code: "111111", channel: "EMAIL" });
            repository.updateStatus.mockResolvedValue({});

            const result = await bulkTransferService.initiate(
                user,
                {
                    items: [
                        { destinationAccountNumber: "2222222222", amount: 1000 },
                        { destinationAccountNumber: "3333333333", amount: 2000 }
                    ]
                },
                fakeRequest()
            );

            expect(result.totalAmount).toBe(3000);
            expect(result.itemCount).toBe(2);
            expect(limitsService.check).toHaveBeenCalledWith({ userId: "user-1", amount: 3000 });

        });

        test("rejects an empty item list", async () => {

            await expect(
                bulkTransferService.initiate(user, { items: [] }, fakeRequest())
            ).rejects.toThrow("At least one item is required");

        });

    });

    describe("confirm", () => {

        const batch = {
            id: "bulk-1",
            initiatorUserId: "user-1",
            status: "PENDING_OTP",
            otpChannel: "EMAIL",
            sourceAccountNumber: "1111111111",
            items: [
                { destinationAccountNumber: "2222222222", amount: 1000 },
                { destinationAccountNumber: "3333333333", amount: 2000 }
            ]
        };

        test("marks COMPLETED when every item succeeds", async () => {

            repository.findById.mockResolvedValue(batch);
            otpService.verifyTransferOtp.mockResolvedValue(true);
            repository.transitionStatus.mockResolvedValue({ ...batch, status: "PROCESSING" });
            repository.updateStatus.mockResolvedValue({ status: "COMPLETED" });

            accountClient.getAccount.mockImplementation(async (accountNumber) => ({
                accountNumber,
                clientId: "1"
            }));

            transferRepository.create.mockResolvedValue({ id: "transfer-x" });
            transferService.executeMovement.mockResolvedValue({ id: "transfer-x", status: "SUCCESSFUL" });

            await bulkTransferService.confirm(user, "bulk-1", "111111", fakeRequest());

            expect(repository.updateStatus).toHaveBeenCalledWith(
                "bulk-1",
                expect.objectContaining({ status: "COMPLETED" })
            );

            expect(repository.updateItem).toHaveBeenCalledTimes(2);

        });

        test("marks PARTIALLY_FAILED when some items fail", async () => {

            repository.findById.mockResolvedValue(batch);
            otpService.verifyTransferOtp.mockResolvedValue(true);
            repository.transitionStatus.mockResolvedValue({ ...batch, status: "PROCESSING" });
            repository.updateStatus.mockResolvedValue({ status: "PARTIALLY_FAILED" });

            let callCount = 0;

            accountClient.getAccount.mockImplementation(async (accountNumber) => {
                callCount++;
                return { accountNumber, clientId: "1" };
            });

            transferRepository.create.mockResolvedValue({ id: "transfer-x" });

            transferService.executeMovement
                .mockResolvedValueOnce({ id: "transfer-1", status: "SUCCESSFUL" })
                .mockRejectedValueOnce(new Error("Fineract unavailable"));

            await bulkTransferService.confirm(user, "bulk-1", "111111", fakeRequest());

            expect(repository.updateStatus).toHaveBeenCalledWith(
                "bulk-1",
                expect.objectContaining({ status: "PARTIALLY_FAILED" })
            );

        });

        test("rejects confirming someone else's batch", async () => {

            repository.findById.mockResolvedValue({
                ...batch,
                initiatorUserId: "someone-else"
            });

            await expect(
                bulkTransferService.confirm(user, "bulk-1", "111111", fakeRequest())
            ).rejects.toThrow("does not belong to you");

        });

    });

});
