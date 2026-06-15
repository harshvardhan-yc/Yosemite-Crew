import {
  CompanionService,
  CompanionServiceError,
} from "../../src/services/companion.service";
import { ParentService } from "../../src/services/parent.service";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentPatient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    patientOrganisation: {
      findMany: jest.fn(),
    },
    codeEntry: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/parent.service", () => ({
  ParentService: {
    findByLinkedUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/parent-companion.service", () => {
  const actual = jest.requireActual(
    "../../src/services/parent-companion.service",
  );
  return {
    ...actual,
    ParentCompanionService: {
      linkParent: jest.fn(),
      getActiveCompanionIdsForParent: jest.fn(),
      ensurePrimaryOwnership: jest.fn(),
      deleteLinksForCompanion: jest.fn(),
    },
  };
});

jest.mock("@yosemite-crew/types", () => ({
  fromCompanionRequestDTO: jest.fn((dto) => dto),
  toCompanionResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

jest.mock("src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "patient/image-key"),
  moveFile: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../src/services/taskLibrary.service", () => ({
  TaskLibraryService: {
    listForSpecies: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createFromLibrary: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  patient: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentPatient: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
  };
  patientOrganisation: {
    findMany: jest.Mock;
  };
  codeEntry: {
    findFirst: jest.Mock;
  };
  parent: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
  };
};

describe("CompanionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const companionPayload: any = {
    resourceType: "Patient",
    name: "Buddy",
    type: "dog",
    breed: "Labrador",
    dateOfBirth: new Date("2026-01-01"),
    gender: "male",
    isInsured: false,
    status: "active",
  };

  const createdPatient = {
    id: "patient-1",
    name: "Buddy",
    type: "dog",
    breed: "Labrador",
    speciesCode: null,
    breedCode: null,
    dateOfBirth: new Date("2026-01-01"),
    gender: "male",
    photoUrl: null,
    currentWeight: null,
    colour: null,
    allergy: null,
    bloodGroup: null,
    isNeutered: null,
    ageWhenNeutered: null,
    microchipNumber: null,
    passportNumber: null,
    isInsured: false,
    insurance: null,
    countryOfOrigin: null,
    source: null,
    status: "active",
    physicalAttribute: null,
    breedingInfo: null,
    medicalRecords: null,
    alerts: [],
    isProfileComplete: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("creates a companion and links it to the parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.create.mockResolvedValueOnce(createdPatient);
    mockedPrisma.patient.update.mockResolvedValueOnce(createdPatient);
    (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValueOnce({
      id: "parent-1",
    });
    (ParentCompanionService.linkParent as jest.Mock).mockResolvedValueOnce({
      parentId: "parent-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: {},
    });

    const result = await CompanionService.create(companionPayload, {
      authUserId: "provider-1",
      organisationId: "org-1",
    });

    expect(ParentCompanionService.linkParent).toHaveBeenCalledWith({
      parentId: "parent-1",
      patientId: "patient-1",
      role: "PRIMARY",
    });
    expect((result.response as any).mapped).toBe(true);
  });

  it("returns companions linked to a parent", async () => {
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockResolvedValueOnce(["patient-1"]);
    mockedPrisma.patient.findMany.mockResolvedValueOnce([createdPatient]);

    const result = await CompanionService.listByParent("parent-1");

    expect(result.responses).toHaveLength(1);
    expect((result.responses[0] as any).id).toBe("patient-1");
  });

  it("returns companions not linked to an organisation", async () => {
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockResolvedValueOnce(["patient-1", "patient-2"]);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValueOnce([
      { patientId: "patient-2" },
    ]);
    mockedPrisma.patient.findMany.mockResolvedValueOnce([createdPatient]);

    const result = await CompanionService.listByParentNotInOrganisation(
      "parent-1",
      "org-1",
    );

    expect(result.responses).toHaveLength(1);
  });

  it("updates a companion", async () => {
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.update.mockResolvedValueOnce(createdPatient);

    const result = await CompanionService.update("patient-1", companionPayload);

    expect(mockedPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "patient-1" },
      }),
    );
    expect(result.response.id).toBe("patient-1");
  });

  it("deletes a companion after ownership check", async () => {
    (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValueOnce({
      id: "parent-1",
    });
    (
      ParentCompanionService.ensurePrimaryOwnership as jest.Mock
    ).mockResolvedValueOnce(undefined);
    (
      ParentCompanionService.deleteLinksForCompanion as jest.Mock
    ).mockResolvedValueOnce(1);

    await CompanionService.delete("patient-1", { authUserId: "provider-1" });

    expect(ParentCompanionService.ensurePrimaryOwnership).toHaveBeenCalledWith(
      "parent-1",
      "patient-1",
    );
    expect(mockedPrisma.patient.deleteMany).toHaveBeenCalledWith({
      where: { id: "patient-1" },
    });
  });

  it("throws when a companion lacks a valid parent context", async () => {
    await expect(
      CompanionService.create(companionPayload, undefined),
    ).rejects.toBeInstanceOf(CompanionServiceError);
  });
});
