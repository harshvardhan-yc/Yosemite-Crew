import { Request, Response } from "express";
import { UserOrganizationController } from "../../../src/controllers/web/user-organization.controller";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
} from "../../../src/services/user-organization.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/utils/logger");

jest.mock("../../../src/services/user-organization.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/user-organization.service",
  );
  return {
    ...actual,
    UserOrganizationService: {
      upsert: jest.fn(),
      getById: jest.fn(),
      listAll: jest.fn(),
      deleteById: jest.fn(),
      update: jest.fn(),
      listByUserId: jest.fn(),
      listByOrganisationId: jest.fn(),
    },
  };
});

type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
};

const createMockReq = (data: Partial<any> = {}): any => ({
  params: {},
  body: {},
  ...data,
});

const createMockRes = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const allowedMapping = {
  mapping: {
    organizationReference: "Organization/org-1",
    effectivePermissions: ["teams:view:any", "teams:edit:any"],
    practitionerReference: "Practitioner/user-1",
  },
};

const viewOnlyMapping = {
  mapping: {
    organizationReference: "Organization/org-2",
    effectivePermissions: ["teams:view:any"],
    practitionerReference: "Practitioner/user-2",
  },
};

describe("UserOrganizationController", () => {
  let mockRes: MockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = createMockRes();
  });

  describe("upsertMapping", () => {
    const payload = {
      resourceType: "PractitionerRole",
      organization: { reference: "Organization/org-1" },
    };

    it("returns 401 without auth context", async () => {
      const req = createMockReq({
        body: payload,
        userId: undefined,
      });

      await UserOrganizationController.upsertMapping(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });

    it("returns 403 when user lacks edit permission in target org", async () => {
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        viewOnlyMapping,
      ]);

      const req = createMockReq({
        body: payload,
        userId: "user-1",
      });

      await UserOrganizationController.upsertMapping(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.upsert).not.toHaveBeenCalled();
    });

    it("creates mapping when requester has edit permission", async () => {
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);
      (UserOrganizationService.upsert as jest.Mock).mockResolvedValue({
        response: { ok: true },
        created: true,
      });

      const req = createMockReq({
        body: payload,
        userId: "user-1",
      });

      await UserOrganizationController.upsertMapping(req, mockRes as Response);

      expect(UserOrganizationService.listByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(UserOrganizationService.upsert).toHaveBeenCalledWith(payload);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("getMappingById", () => {
    it("returns 401 when auth context is missing", async () => {
      const req = createMockReq({ params: { id: "map-1" }, userId: undefined });

      await UserOrganizationController.getMappingById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.getById).not.toHaveBeenCalled();
    });

    it("returns 403 when requester cannot view the target mapping", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-9" },
        organization: { reference: "Organization/org-9" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        viewOnlyMapping,
      ]);

      const req = createMockReq({ params: { id: "map-1" }, userId: "user-1" });

      await UserOrganizationController.getMappingById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.getById).toHaveBeenCalledWith("map-1");
    });

    it("returns the mapping when requester can view it", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-1" },
        organization: { reference: "Organization/org-1" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);

      const req = createMockReq({ params: { id: "map-1" }, userId: "user-1" });

      await UserOrganizationController.getMappingById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        practitioner: { reference: "Practitioner/user-1" },
        organization: { reference: "Organization/org-1" },
      });
    });
  });

  describe("listMappings", () => {
    it("returns 401 when auth context is missing", async () => {
      const req = createMockReq({ userId: undefined });

      await UserOrganizationController.listMappings(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(UserOrganizationService.listByUserId).not.toHaveBeenCalled();
    });

    it("returns the current user's mappings", async () => {
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);

      const req = createMockReq({ userId: "user-1" });

      await UserOrganizationController.listMappings(req, mockRes as Response);

      expect(UserOrganizationService.listByUserId).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([allowedMapping]);
    });
  });

  describe("deleteMappingById", () => {
    it("returns 403 when requester cannot edit target org", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-9" },
        organization: { reference: "Organization/org-9" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        viewOnlyMapping,
      ]);

      const req = createMockReq({ params: { id: "map-1" }, userId: "user-1" });

      await UserOrganizationController.deleteMappingById(
        req,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.deleteById).not.toHaveBeenCalled();
    });

    it("deletes the mapping when requester can edit target org", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-1" },
        organization: { reference: "Organization/org-1" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);
      (UserOrganizationService.deleteById as jest.Mock).mockResolvedValue(true);

      const req = createMockReq({ params: { id: "map-1" }, userId: "user-1" });

      await UserOrganizationController.deleteMappingById(
        req,
        mockRes as Response,
      );

      expect(UserOrganizationService.deleteById).toHaveBeenCalledWith("map-1");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("updateMappingById", () => {
    const payload = {
      resourceType: "PractitionerRole",
      organization: { reference: "Organization/org-1" },
    };

    it("returns 403 when requester cannot edit target org", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-9" },
        organization: { reference: "Organization/org-9" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        viewOnlyMapping,
      ]);

      const req = createMockReq({
        params: { id: "map-1" },
        body: payload,
        userId: "user-1",
      });

      await UserOrganizationController.updateMappingById(
        req,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(UserOrganizationService.update).not.toHaveBeenCalled();
    });

    it("updates the mapping when requester can edit target org", async () => {
      (UserOrganizationService.getById as jest.Mock).mockResolvedValue({
        practitioner: { reference: "Practitioner/user-1" },
        organization: { reference: "Organization/org-1" },
      });
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);
      (UserOrganizationService.update as jest.Mock).mockResolvedValue({
        updated: true,
      });

      const req = createMockReq({
        params: { id: "map-1" },
        body: payload,
        userId: "user-1",
      });

      await UserOrganizationController.updateMappingById(
        req,
        mockRes as Response,
      );

      expect(UserOrganizationService.update).toHaveBeenCalledWith(
        "map-1",
        payload,
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ updated: true });
    });
  });

  describe("listByOrganisationId", () => {
    it("returns 403 when requester cannot view the organisation", async () => {
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        viewOnlyMapping,
      ]);

      const req = createMockReq({
        params: { organisationId: "org-9" },
        userId: "user-1",
      });

      await UserOrganizationController.listByOrganisationId(
        req,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(
        UserOrganizationService.listByOrganisationId,
      ).not.toHaveBeenCalled();
    });

    it("returns the organisation team when requester has access", async () => {
      (UserOrganizationService.listByUserId as jest.Mock).mockResolvedValue([
        allowedMapping,
      ]);
      (
        UserOrganizationService.listByOrganisationId as jest.Mock
      ).mockResolvedValue([{ ok: true }]);

      const req = createMockReq({
        params: { organisationId: "org-1" },
        userId: "user-1",
      });

      await UserOrganizationController.listByOrganisationId(
        req,
        mockRes as Response,
      );

      expect(UserOrganizationService.listByOrganisationId).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([{ ok: true }]);
    });
  });

  it("handles service errors without leaking internals", async () => {
    (UserOrganizationService.listByUserId as jest.Mock).mockRejectedValue(
      new UserOrganizationServiceError("Boom", 418),
    );

    const req = createMockReq({
      params: { organisationId: "org-1" },
      userId: "user-1",
    });

    await UserOrganizationController.listByOrganisationId(
      req,
      mockRes as Response,
    );

    expect(mockRes.status).toHaveBeenCalledWith(418);
    expect(mockRes.json).toHaveBeenCalledWith({ message: "Boom" });
  });
});
