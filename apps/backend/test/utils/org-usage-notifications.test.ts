import { Types } from "mongoose";
import { sendEmailTemplate } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import * as SutModule from "../../src/utils/org-usage-notifications";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: { findFirst: jest.fn() },
    userOrganization: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

const mockedPrisma = prisma as any;

describe("Org Usage Notifications Utils", () => {
  const mockOrgId = new Types.ObjectId();

  const safeUsage = {
    appointmentsUsed: 1,
    freeAppointmentsLimit: 10,
    toolsUsed: 1,
    freeToolsLimit: 10,
    usersActiveCount: 1,
    freeUsersLimit: 10,
  };

  const breachedUsage = {
    appointmentsUsed: 10,
    freeAppointmentsLimit: 5,
    toolsUsed: 1,
    freeToolsLimit: 10,
    usersActiveCount: 5,
    freeUsersLimit: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Business Logic", () => {
    it("should return early if organization is not found", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValueOnce(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(mockedPrisma.organization.findFirst).toHaveBeenCalled();
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if owner mapping is not found", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValueOnce({
        id: "org-1",
        name: "Org",
        fhirId: null,
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValueOnce(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(mockedPrisma.userOrganization.findFirst).toHaveBeenCalled();
      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("should return early if owner user is not found", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValueOnce({
        id: "org-1",
        name: "Org",
        fhirId: null,
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValueOnce({
        practitionerReference: "Practitioner/123",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce(null);

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should return early if usage limits are not reached", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValueOnce({
        id: "org-1",
        name: "Org",
        fhirId: null,
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValueOnce({
        practitionerReference: "Practitioner/123",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      });

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: safeUsage,
      });

      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should send email when limits are reached", async () => {
      mockedPrisma.organization.findFirst.mockResolvedValueOnce({
        id: "org-1",
        name: "Test Org",
        fhirId: "fhir-123",
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValueOnce({
        practitionerReference: "Practitioner/999",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        email: "owner@test.com",
        firstName: "John",
        lastName: "Doe",
      });

      await SutModule.sendFreePlanLimitReachedEmail({
        orgId: mockOrgId,
        usage: breachedUsage,
      });

      expect(mockedPrisma.userOrganization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationReference: expect.objectContaining({
              in: expect.arrayContaining([
                "org-1",
                "Organization/org-1",
                "fhir-123",
                "Organization/fhir-123",
              ]),
            }),
          }),
        }),
      );
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { userId: "999" },
        select: { email: true, firstName: true, lastName: true },
      });
      expect(sendEmailTemplate).toHaveBeenCalledWith({
        to: "owner@test.com",
        templateId: "freePlanLimitReached",
        templateData: expect.objectContaining({
          ownerName: "John Doe",
          organisationName: "Test Org",
          limitItems: [
            { label: "Appointments", used: 10, limit: 5 },
            { label: "Users", used: 5, limit: 1 },
          ],
          ctaUrl: expect.stringContaining("settings/billing"),
        }),
      });
    });
  });
});
