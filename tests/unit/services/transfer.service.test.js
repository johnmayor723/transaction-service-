jest.mock("../../../src/modules/transfer/transfer.repository");
jest.mock("../../../src/modules/otp/otp.service");
jest.mock("../../../src/modules/fraud/fraud.service");
jest.mock("../../../src/modules/limits/limits.service");
jest.mock("../../../src/integrations/account/account.client");
jest.mock("../../../src/integrations/fineract/fineract.client");
jest.mock("../../../src/integrations/nibss/dummy.adapter");

const repository = require("../../../src/modules/transfer/transfer.repository");
const otpService = require("../../../src/modules/otp/otp.service");
const fraudService = require("../../../src/modules/fraud/fraud.service");
const limitsService = require("../../../src/modules/limits/limits.service");
const accountClient = require("../../../src/integrations/account/account.client");
const fineractClient = require("../../../src/integrations/fineract/fineract.client");
const nibssAdapter = require("../../../src/integrations/nibss/dummy.adapter");

const transferService = require("../../../src/modules/transfer/transfer.service");

const fakeRequest = () => ({
    correlationId: "corr-1",
    headers: { "idempotency-key": "idem-1" }
});

const user = {
    userId: "user-1",
    accountNumber: "1111111111"
};

describe("Transfer Service", () => {

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("initiate", () => {

        const sourceAccount = {
            accountNumber: "1111111111",
            status: "ACTIVE",
            clientId: "1",
            fineractAccountId: "10",
            email: "jane@example.com",
            phoneNumber: "08000000000"
        };

        test("creates a PENDING_OTP transfer and sends the OTP", async () => {

            accountClient.getAccount.mockImplementation(async (accountNumber) => {
                if (accountNumber === "1111111111") return sourceAccount;
                return {
                    accountNumber: "2222222222",
                    clientId: "1",
                    status: "ACTIVE"
                };
            });

            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });

            repository.create.mockResolvedValue({
                id: "transfer-1"
            });

            otpService.sendTransferOtp.mockResolvedValue({
                expiresAt: new Date(),
                code: "123456",
                channel: "EMAIL"
            });

            repository.updateStatus.mockResolvedValue({});

            const result = await transferService.initiate(
                user,
                { destinationAccountNumber: "2222222222", amount: 5000, narration: "test" },
                fakeRequest()
            );

            expect(result.transferId).toBe("transfer-1");
            expect(result.status).toBe("PENDING_OTP");
            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "OWN_ACCOUNT", amount: 5000 })
            );

        });

        test("rejects source and destination being the same account", async () => {

            accountClient.getAccount.mockResolvedValue(sourceAccount);

            await expect(
                transferService.initiate(
                    user,
                    { destinationAccountNumber: "1111111111", amount: 5000 },
                    fakeRequest()
                )
            ).rejects.toThrow("must be different");

        });

        test("rejects an inactive source account", async () => {

            accountClient.getAccount.mockResolvedValue({
                ...sourceAccount,
                status: "INACTIVE"
            });

            await expect(
                transferService.initiate(
                    user,
                    { destinationAccountNumber: "2222222222", amount: 5000 },
                    fakeRequest()
                )
            ).rejects.toThrow("not active");

        });

        test("rejects a BLOCK fraud decision", async () => {

            accountClient.getAccount.mockResolvedValue(sourceAccount);
            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "BLOCK", reasons: ["blocklisted"] });

            await expect(
                transferService.initiate(
                    user,
                    { destinationAccountNumber: "2222222222", amount: 5000 },
                    fakeRequest()
                )
            ).rejects.toThrow("cannot be processed");

        });

        test("marks NIP type when a destination bank code is supplied", async () => {

            accountClient.getAccount.mockResolvedValue(sourceAccount);
            limitsService.check.mockResolvedValue(undefined);
            fraudService.assess.mockResolvedValue({ decision: "ALLOW", reasons: [] });
            repository.create.mockResolvedValue({ id: "transfer-2" });
            otpService.sendTransferOtp.mockResolvedValue({ expiresAt: new Date(), code: "111111", channel: "SMS" });
            repository.updateStatus.mockResolvedValue({});

            await transferService.initiate(
                user,
                { destinationAccountNumber: "3333333333", destinationBankCode: "058", amount: 5000 },
                fakeRequest()
            );

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "NIP", destinationBankCode: "058" })
            );

            /**
             * NIP transfers must not attempt to resolve the
             * destination via Account Service (it's another bank).
             */
            expect(accountClient.getAccount).toHaveBeenCalledTimes(1);

        });

    });

    describe("confirm", () => {

        const pendingTransfer = {
            id: "transfer-1",
            initiatorUserId: "user-1",
            status: "PENDING_OTP",
            otpChannel: "EMAIL",
            type: "OWN_ACCOUNT",
            sourceAccountNumber: "1111111111",
            destinationAccountNumber: "2222222222",
            amount: 5000
        };

        test("posts withdrawal + deposit and marks SUCCESSFUL for internal transfers", async () => {

            repository.findById.mockResolvedValue(pendingTransfer);
            otpService.verifyTransferOtp.mockResolvedValue(true);
            repository.updateStatus.mockResolvedValue({
                id: "transfer-1",
                reference: "TXN123",
                status: "SUCCESSFUL"
            });

            accountClient.getAccount.mockImplementation(async (accountNumber) => ({
                accountNumber,
                fineractAccountId: accountNumber === "1111111111" ? "10" : "20"
            }));

            fineractClient.postWithdrawal.mockResolvedValue({});
            fineractClient.postDeposit.mockResolvedValue({});
            limitsService.recordUsage.mockResolvedValue(undefined);

            const result = await transferService.confirm(
                user,
                "transfer-1",
                "123456",
                fakeRequest()
            );

            expect(fineractClient.postWithdrawal).toHaveBeenCalledWith("10", expect.objectContaining({ amount: 5000 }));
            expect(fineractClient.postDeposit).toHaveBeenCalledWith("20", expect.objectContaining({ amount: 5000 }));
            expect(result.status).toBe("SUCCESSFUL");

        });

        test("uses the NIBSS adapter for NIP transfers", async () => {

            repository.findById.mockResolvedValue({
                ...pendingTransfer,
                type: "NIP",
                destinationBankCode: "058"
            });

            otpService.verifyTransferOtp.mockResolvedValue(true);
            nibssAdapter.initiateNip.mockResolvedValue({ status: "SUCCESSFUL" });
            limitsService.recordUsage.mockResolvedValue(undefined);
            repository.updateStatus.mockResolvedValue({
                id: "transfer-1",
                reference: "TXN123",
                status: "SUCCESSFUL"
            });

            await transferService.confirm(user, "transfer-1", "123456", fakeRequest());

            expect(nibssAdapter.initiateNip).toHaveBeenCalled();
            expect(fineractClient.postWithdrawal).not.toHaveBeenCalled();

        });

        test("rejects confirming someone else's transfer", async () => {

            repository.findById.mockResolvedValue({
                ...pendingTransfer,
                initiatorUserId: "someone-else"
            });

            await expect(
                transferService.confirm(user, "transfer-1", "123456", fakeRequest())
            ).rejects.toThrow("does not belong to you");

        });

        test("rejects confirming an already-processed transfer", async () => {

            repository.findById.mockResolvedValue({
                ...pendingTransfer,
                status: "SUCCESSFUL"
            });

            await expect(
                transferService.confirm(user, "transfer-1", "123456", fakeRequest())
            ).rejects.toThrow("already successful");

        });

        test("marks FAILED and rethrows when the downstream posting fails", async () => {

            repository.findById.mockResolvedValue(pendingTransfer);
            otpService.verifyTransferOtp.mockResolvedValue(true);

            accountClient.getAccount.mockResolvedValue({
                accountNumber: "1111111111",
                fineractAccountId: "10"
            });

            fineractClient.postWithdrawal.mockRejectedValue(new Error("Fineract unavailable"));
            repository.updateStatus.mockResolvedValue({});

            await expect(
                transferService.confirm(user, "transfer-1", "123456", fakeRequest())
            ).rejects.toThrow("Fineract unavailable");

            expect(repository.updateStatus).toHaveBeenCalledWith(
                "transfer-1",
                expect.objectContaining({ status: "FAILED" })
            );

        });

    });

});
