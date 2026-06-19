import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "../../src/services/account-withdrawal.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    accountWithdrawal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("AccountWithdrawalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("throws when required fields are missing", async () => {
      await expect(
        AccountWithdrawalService.create({
          fullName: "",
          email: "",
          checkboxConfirmed: true,
        }),
      ).rejects.toBeInstanceOf(AccountWithdrawalServiceError);
    });

    it("throws when checkbox is not confirmed", async () => {
      await expect(
        AccountWithdrawalService.create({
          fullName: "John Doe",
          email: "john@example.com",
          checkboxConfirmed: false,
        }),
      ).rejects.toThrow("Checkbox confirmation is required");
    });

    it("creates a withdrawal request with RECEIVED status", async () => {
      mockedPrisma.accountWithdrawal.create.mockResolvedValueOnce({
        id: "req-1",
      });

      const result = await AccountWithdrawalService.create({
        userId: "user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        message: "Please remove my account",
        checkboxConfirmed: true,
      });

      expect(mockedPrisma.accountWithdrawal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          fullName: "Jane Doe",
          email: "jane@example.com",
          message: "Please remove my account",
          status: "RECEIVED",
        }),
      });
      expect(result).toEqual({ id: "req-1" });
    });
  });

  describe("listAll", () => {
    it("returns sorted withdrawal requests", async () => {
      mockedPrisma.accountWithdrawal.findMany.mockResolvedValueOnce([
        { id: "req-1" },
      ]);

      const result = await AccountWithdrawalService.listAll();

      expect(mockedPrisma.accountWithdrawal.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([{ id: "req-1" }]);
    });
  });

  describe("updateStatus", () => {
    it("updates status and processed metadata", async () => {
      mockedPrisma.accountWithdrawal.findUnique.mockResolvedValueOnce({
        id: "req-1",
      });
      mockedPrisma.accountWithdrawal.update.mockResolvedValueOnce({
        id: "req-1",
        status: "COMPLETED",
      });

      const result = await AccountWithdrawalService.updateStatus(
        "req-1",
        "COMPLETED",
        "admin-1",
      );

      expect(mockedPrisma.accountWithdrawal.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: {
          status: "COMPLETED",
          processedByUserId: "admin-1",
          processedAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ id: "req-1", status: "COMPLETED" });
    });

    it("throws when request is not found", async () => {
      mockedPrisma.accountWithdrawal.findUnique.mockResolvedValueOnce(null);

      await expect(
        AccountWithdrawalService.updateStatus("missing", "REJECTED", "admin"),
      ).rejects.toBeInstanceOf(AccountWithdrawalServiceError);
    });
  });
});
