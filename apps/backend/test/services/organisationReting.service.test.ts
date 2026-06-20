import { OrganizationRatingService } from "src/services/organisationReting.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organisationRating: {
      upsert: jest.fn(),
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
    organization: {
      updateMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  organisationRating: {
    upsert: jest.Mock;
    aggregate: jest.Mock;
    findFirst: jest.Mock;
  };
  organization: {
    updateMany: jest.Mock;
  };
};

describe("OrganizationRatingService", () => {
  const orgId = "507f1f77bcf86cd799439021";
  const userId = "507f1f77bcf86cd799439023";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("upserts a rating and recalculates averages", async () => {
    mockedPrisma.organisationRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
      _count: { rating: 2 },
    });

    const result = await OrganizationRatingService.rateOrganisation(
      orgId,
      userId,
      5,
      "great",
    );

    expect(mockedPrisma.organisationRating.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      create: {
        organizationId: orgId,
        userId,
        rating: 5,
        review: "great",
      },
      update: {
        rating: 5,
        review: "great",
      },
    });
    expect(mockedPrisma.organisationRating.aggregate).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    expect(mockedPrisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: orgId },
      data: { averageRating: 4.2, ratingCount: 2 },
    });
    expect(result).toEqual({ success: true });
  });

  it("throws on invalid ids", async () => {
    await expect(
      OrganizationRatingService.rateOrganisation(" ", userId, 5),
    ).rejects.toThrow("Invalid organizationId");
    await expect(
      OrganizationRatingService.rateOrganisation(orgId, "", 5),
    ).rejects.toThrow("Invalid userId");
  });

  it("resets averages when no ratings exist", async () => {
    mockedPrisma.organisationRating.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    await OrganizationRatingService.recalculateAverageRating(orgId);

    expect(mockedPrisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: orgId },
      data: { averageRating: 0, ratingCount: 0 },
    });
  });

  it("returns user rating from postgres", async () => {
    mockedPrisma.organisationRating.findFirst.mockResolvedValue({
      rating: 3,
      review: null,
    });

    const result = await OrganizationRatingService.isUserRatedOrganisation(
      orgId,
      userId,
    );

    expect(result).toEqual({ isRated: true, rating: 3, review: null });
  });
});
