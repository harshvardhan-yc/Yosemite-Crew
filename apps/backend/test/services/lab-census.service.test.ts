import { LabCensusService } from "../../src/services/lab-census.service";
import { prisma } from "../../src/config/prisma";
import { IntegrationService } from "../../src/services/integration.service";
import { IdexxClient } from "../../src/integrations/idexx/idexx.client";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeMapping: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
  },
}));

jest.mock("../../src/services/integration.service", () => ({
  IntegrationService: {
    requireAccount: jest.fn(),
  },
}));

jest.mock("../../src/integrations/idexx/idexx.client", () => ({
  IdexxClient: jest.fn(),
}));

describe("LabCensusService", () => {
  const organisationId = "507f1f77bcf86cd799439011";
  const patientId = "507f191e810c19729de860ea";
  const parentId = "507f191e810c19729de860eb";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "pims-version";
  });

  describe("addCensusPatient", () => {
    it("rejects when companion is not linked to organisation", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId: patientId,
          parentId,
        }),
      ).rejects.toThrow("Companion not found.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
      expect(IdexxClient).not.toHaveBeenCalled();
    });

    it("rejects when parent is not linked to companion", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId: patientId,
          parentId,
        }),
      ).rejects.toThrow("Parent not found.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
      expect(IdexxClient).not.toHaveBeenCalled();
    });

    it("builds census payload and submits to IDEXX", async () => {
      (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });
      (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
        id: "link-2",
      });

      (prisma.patient.findUnique as jest.Mock).mockResolvedValue({
        id: patientId,
        name: "Buddy",
        gender: "male",
        isNeutered: true,
        dateOfBirth: new Date("2020-01-01T00:00:00.000Z"),
        microchipNumber: "mc-1",
        speciesCode: "DOG",
        breedCode: "LAB",
      });

      (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
        id: parentId,
        firstName: "Pat",
        lastName: "Doe",
        email: "pat@example.com",
        phoneNumber: "123",
        address: {
          addressLine: "123 Street",
          city: "City",
          state: "ST",
          postalCode: "12345",
          country: "US",
        },
      });

      (prisma.codeMapping.findFirst as jest.Mock).mockResolvedValue({
        targetCode: "MAPPED",
      });

      (IntegrationService.requireAccount as jest.Mock).mockResolvedValue({
        credentials: {
          username: "u",
          password: "p",
          labAccountId: "lab-1",
        },
      });

      const addCensusPatient = jest.fn().mockResolvedValue({ ok: true });
      (IdexxClient as unknown as jest.Mock).mockImplementation(() => ({
        addCensusPatient,
      }));

      const result = await LabCensusService.addCensusPatient(
        "IDEXX",
        organisationId,
        {
          patientId: patientId,
          parentId,
          veterinarian: "Dr Vet",
          ivls: ["SN-1"],
        },
      );

      expect(result).toEqual({ ok: true });
      expect(addCensusPatient).toHaveBeenCalledTimes(1);
      expect(IntegrationService.requireAccount).toHaveBeenCalledWith(
        organisationId,
        "IDEXX",
      );
    });
  });
});
