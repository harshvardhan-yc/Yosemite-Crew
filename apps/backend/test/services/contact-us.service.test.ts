import {
  ContactService,
  ContactServiceError,
} from "../../src/services/contact-us.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("ContactService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createRequest", () => {
    const baseInput = {
      type: "GENERAL_ENQUIRY" as const,
      source: "MOBILE_APP" as const,
      subject: "Help",
      message: "I need help",
    };

    it("throws when subject or message is missing", async () => {
      await expect(
        ContactService.createRequest({ ...baseInput, subject: "" }),
      ).rejects.toThrow("subject and message are required");

      await expect(
        ContactService.createRequest({ ...baseInput, message: "" }),
      ).rejects.toThrow("subject and message are required");
    });

    it("creates a request in postgres", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValueOnce({
        id: "contact-1",
      });

      const result = await ContactService.createRequest({
        ...baseInput,
        email: "user@example.com",
        organisationId: "org-1",
      });

      expect(prisma.contactRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "GENERAL_ENQUIRY",
          source: "MOBILE_APP",
          subject: "Help",
          message: "I need help",
          email: "user@example.com",
          organisationId: "org-1",
          status: "OPEN",
        }),
      });
      expect(result).toEqual({ id: "contact-1" });
    });

    it("validates DSAR payloads", async () => {
      const dsarInput = {
        ...baseInput,
        type: "DSAR" as const,
        dsarDetails: {
          requesterType: "SELF" as const,
          declarationAccepted: true,
        },
      };

      await expect(
        ContactService.createRequest({
          ...dsarInput,
          dsarDetails: { declarationAccepted: true } as any,
        }),
      ).rejects.toThrow("DSAR requests must include dsarDetails.requesterType");

      await expect(
        ContactService.createRequest({
          ...dsarInput,
          dsarDetails: {
            requesterType: "SELF",
            declarationAccepted: false,
          },
        }),
      ).rejects.toThrow("DSAR declaration must be accepted");
    });

    it("fills declarationAcceptedAt when missing", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValueOnce({
        id: "contact-2",
      });

      await ContactService.createRequest({
        ...baseInput,
        type: "DSAR",
        dsarDetails: {
          requesterType: "SELF",
          declarationAccepted: true,
        },
      });

      expect(prisma.contactRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dsarDetails: expect.objectContaining({
            declarationAcceptedAt: expect.any(Date),
          }),
        }),
      });
    });
  });

  describe("createWebRequest", () => {
    const baseInput = {
      type: "GENERAL_ENQUIRY" as const,
      source: "PMS_WEB" as const,
      message: "Need help",
      fullName: "Web User",
      email: "web@user.com",
    };

    it("throws when required fields are missing", async () => {
      await expect(
        ContactService.createWebRequest({ ...baseInput, message: "" }),
      ).rejects.toThrow("message is required");
      await expect(
        ContactService.createWebRequest({ ...baseInput, fullName: "" }),
      ).rejects.toThrow("fullName is required");
      await expect(
        ContactService.createWebRequest({ ...baseInput, email: "" }),
      ).rejects.toThrow("email is required");
    });

    it("creates a trimmed web request in postgres", async () => {
      (prisma.contactRequest.create as jest.Mock).mockResolvedValueOnce({
        id: "contact-web-1",
      });

      const result = await ContactService.createWebRequest({
        ...baseInput,
        message: " Need help ",
        email: " web@user.com ",
        phone: "1234567890",
      });

      expect(prisma.contactRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "GENERAL_ENQUIRY",
          source: "PMS_WEB",
          subject: "GENERAL_ENQUIRY",
          message: "Need help",
          email: "web@user.com",
          status: "OPEN",
        }),
      });
      expect(result).toEqual({ id: "contact-web-1" });
    });
  });

  describe("listRequests", () => {
    it("passes filter values to prisma", async () => {
      (prisma.contactRequest.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "1" },
      ]);

      const result = await ContactService.listRequests({
        status: "OPEN",
        type: "DSAR",
        organisationId: "org-1",
      });

      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          type: "DSAR",
          organisationId: "org-1",
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      expect(result).toEqual([{ id: "1" }]);
    });

    it("handles empty filters", async () => {
      (prisma.contactRequest.findMany as jest.Mock).mockResolvedValueOnce([]);

      await ContactService.listRequests({});

      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: undefined,
          type: undefined,
          organisationId: undefined,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
  });

  describe("getById", () => {
    it("queries prisma by id", async () => {
      (prisma.contactRequest.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "contact-1",
      });

      const result = await ContactService.getById("contact-1");

      expect(prisma.contactRequest.findUnique).toHaveBeenCalledWith({
        where: { id: "contact-1" },
      });
      expect(result).toEqual({ id: "contact-1" });
    });
  });

  describe("updateStatus", () => {
    it("updates the status in prisma", async () => {
      (prisma.contactRequest.update as jest.Mock).mockResolvedValueOnce({
        id: "contact-1",
        status: "CLOSED",
      });

      const result = await ContactService.updateStatus("contact-1", "CLOSED");

      expect(prisma.contactRequest.update).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        data: { status: "CLOSED" },
      });
      expect(result).toEqual({ id: "contact-1", status: "CLOSED" });
    });
  });

  describe("ContactServiceError", () => {
    it("defaults to status code 400", () => {
      const err = new ContactServiceError("msg");

      expect(err.name).toBe("ContactServiceError");
      expect(err.statusCode).toBe(400);
    });
  });
});
