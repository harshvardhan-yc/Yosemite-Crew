import { Types } from "mongoose";
import {
  ServiceService,
  ServiceServiceError,
} from "../../src/services/service.service";
import { prisma } from "src/config/prisma";
import { AvailabilityService } from "../../src/services/availability.service";
import helpers from "src/utils/helper";

jest.mock("src/config/prisma", () => ({
  prisma: {
    service: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    speciality: {
      findFirst: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/availability.service", () => ({
  AvailabilityService: {
    getBookableSlotsForDate: jest.fn(),
  },
}));

jest.mock("src/utils/helper", () => ({
  __esModule: true,
  default: {
    getGeoLocation: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  service: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  speciality: {
    findFirst: jest.Mock;
  };
  organization: {
    findMany: jest.Mock;
  };
  userProfile: {
    findFirst: jest.Mock;
  };
};

describe("ServiceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the custom error shape", () => {
    const err = new ServiceServiceError("Test message", 400);
    expect(err.message).toBe("Test message");
    expect(err.statusCode).toBe(400);
  });

  it("uses postgres for getById", async () => {
    mockedPrisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      organisationId: "org-1",
      name: "Service",
      description: null,
      durationMinutes: 30,
      cost: 10,
      maxDiscount: null,
      specialityId: null,
      serviceType: "STANDARD",
      observationToolId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(ServiceService.getById("svc-1")).resolves.toMatchObject({
      id: "svc-1",
    });
  });

  it("returns postgres lists for organisation and speciality", async () => {
    mockedPrisma.service.findMany.mockResolvedValue([
      {
        id: "svc-1",
        organisationId: "org-1",
        name: "Service",
        description: null,
        durationMinutes: 30,
        cost: 10,
        maxDiscount: null,
        specialityId: null,
        serviceType: "STANDARD",
        observationToolId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      ServiceService.listByOrganisation("org-1"),
    ).resolves.toHaveLength(1);
    await expect(
      ServiceService.listBySpeciality("spec-1"),
    ).resolves.toHaveLength(1);
  });

  it("uses postgres search", async () => {
    mockedPrisma.service.findMany.mockResolvedValue([]);
    await expect(ServiceService.search("vet", "org-1")).resolves.toEqual([]);
  });

  it("uses postgres organisation lookup", async () => {
    mockedPrisma.service.findMany.mockResolvedValue([]);
    await expect(
      ServiceService.listOrganisationsProvidingService("Dentistry"),
    ).resolves.toEqual([]);
  });

  it("returns empty bookable slots when no vets are configured", async () => {
    const referenceDate = new Date("2026-06-21T00:00:00.000Z");
    mockedPrisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      organisationId: "org-1",
      specialityId: "spec-1",
      durationMinutes: 30,
    });
    mockedPrisma.speciality.findFirst.mockResolvedValue({
      memberUserIds: [],
    });

    await expect(
      ServiceService.getBookableSlotsService("svc-1", "org-1", referenceDate),
    ).resolves.toEqual({
      date: "2026-06-21",
      dayOfWeek: "SUNDAY",
      windows: [],
    });
  });

  it("uses postgres nearby search", async () => {
    mockedPrisma.service.findMany.mockResolvedValue([]);
    (helpers.getGeoLocation as jest.Mock).mockResolvedValue({
      lat: 1,
      lng: 2,
    });

    await expect(
      ServiceService.listOrganisationsProvidingServiceNearby(
        "Dentistry",
        0,
        0,
        "Dentistry",
      ),
    ).resolves.toEqual([]);
  });
});
