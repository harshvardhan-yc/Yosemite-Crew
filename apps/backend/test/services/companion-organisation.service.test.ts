import { Types } from "mongoose";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { prisma } from "src/config/prisma";

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

jest.mock("../../src/utils/sanitize", () => ({
  assertSafeString: jest.fn((value) => value),
}));

jest.mock("../../src/services/companion.service", () => ({
  toFHIRFromPrisma: jest.fn((value) => ({
    id: value.id,
    resourceType: "Patient",
    name: value.name,
  })),
}));

jest.mock("../../src/services/parent.service", () => ({
  toFHIRFromPrisma: jest.fn((value) => ({
    id: value.id,
    resourceType: "RelatedPerson",
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phoneNumber: value.phoneNumber,
  })),
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    parentPatient: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("CompanionOrganisationService", () => {
  const patientId = new Types.ObjectId().toHexString();
  const organisationId = new Types.ObjectId().toHexString();
  const parentId = new Types.ObjectId().toHexString();
  const linkId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CompanionOrganisationServiceError", () => {
    it("keeps message and status code", () => {
      const err = new CompanionOrganisationServiceError("Test", 418);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(418);
      expect(err.name).toBe("CompanionOrganisationServiceError");
    });
  });

  describe("linking", () => {
    it("returns an existing active link without creating a new one", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId,
          organisationType: "HOSPITAL",
          status: "ACTIVE",
        },
      );

      const result = await CompanionOrganisationService.linkByParent({
        parentId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(result._id).toBe(linkId);
      expect(prisma.patientOrganisation.create).not.toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    });

    it("creates a parent link and records audit", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.patientOrganisation.create as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      const result = await CompanionOrganisationService.linkByParent({
        parentId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(prisma.patientOrganisation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId,
            organisationId,
            linkedByParentId: parentId,
            status: "ACTIVE",
          }),
        }),
      );
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_CREATED" }),
      );
      expect(result._id).toBe(linkId);
    });

    it("creates a PMS invite request", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.patientOrganisation.create as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "PENDING",
      });

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "pms-1",
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
      });

      expect(result.status).toBe("PENDING");
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REQUESTED" }),
      );
    });
  });

  describe("invites", () => {
    it("rejects invite creation without email or name", async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId,
          patientId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Email required or Name", 400),
      );
    });

    it("validates and accepts an invite", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
          inviteToken: "token-1",
        })
        .mockResolvedValueOnce({
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
          inviteToken: "token-1",
        });
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      const validated =
        await CompanionOrganisationService.validateInvite("token-1");
      expect(validated._id).toBe(linkId);

      const accepted = await CompanionOrganisationService.acceptInvite({
        token: "token-1",
        organisationId,
      });

      expect(prisma.patientOrganisation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: linkId },
          data: expect.objectContaining({
            organisationId,
            status: "ACTIVE",
            inviteToken: null,
          }),
        }),
      );
      expect(accepted.status).toBe("ACTIVE");
    });

    it("rejects invalid invite tokens", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        CompanionOrganisationService.validateInvite("missing"),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid or expired invite", 404),
      );
    });
  });

  describe("link lifecycle", () => {
    it("revokes, approves, and rejects links", async () => {
      (
        prisma.patientOrganisation.findUnique as jest.Mock
      ).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });
      await CompanionOrganisationService.revokeLink(linkId);
      expect(prisma.patientOrganisation.delete).toHaveBeenCalledWith({
        where: { id: linkId },
      });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REVOKED" }),
      );

      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });

      await CompanionOrganisationService.parentApproveLink(parentId, linkId);
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_APPROVED" }),
      );

      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
        {
          id: linkId,
          patientId,
          organisationId: null,
          organisationType: "HOSPITAL",
          status: "PENDING",
        },
      );
      (prisma.patientOrganisation.update as jest.Mock).mockResolvedValueOnce({
        id: linkId,
        patientId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "REVOKED",
      });

      await CompanionOrganisationService.parentRejectLink(parentId, linkId);
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PATIENT_ORG_LINK_REJECTED" }),
      );
    });
  });

  describe("listing", () => {
    it("maps companion links and organisation links from prisma", async () => {
      (prisma.patientOrganisation.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: linkId,
            patientId,
            organisationId,
            organisationType: "HOSPITAL",
            status: "ACTIVE",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: linkId,
            patientId,
            organisationId,
            organisationType: "HOSPITAL",
            status: "ACTIVE",
          },
        ]);

      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce({
        parentId,
      });
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Buddy",
      });
      (prisma.patient.findMany as jest.Mock).mockResolvedValueOnce([
        { id: patientId, name: "Buddy" },
      ]);
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        id: parentId,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123",
      });
      (prisma.parentPatient.findMany as jest.Mock).mockResolvedValueOnce([
        { patientId, parentId, role: "PRIMARY", status: "ACTIVE" },
      ]);
      (prisma.parent.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: parentId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phoneNumber: "123",
        },
      ]);

      const companionView =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          patientId,
          "HOSPITAL",
        );
      expect(companionView.parentName).toBe("Jane Doe");
      expect(companionView.email).toBe("jane@example.com");
      expect(companionView.companionName).toBe("Buddy");

      const orgView =
        await CompanionOrganisationService.getLinksForOrganisation(
          organisationId,
        );
      expect(orgView).toHaveLength(1);
      expect(orgView[0]).toMatchObject({
        linkId,
        organisationId,
        organisationType: "HOSPITAL",
        status: "ACTIVE",
      });
    });
  });
});
