import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { RoomUnitGroupController } from "../../../src/controllers/web/room-unit-group.controller";
import { RoomUnitGroupService } from "../../../src/services/room-unit-group.service";

jest.mock("../../../src/services/room-unit-group.service", () => ({
  RoomUnitGroupService: {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  },
  RoomUnitGroupServiceError: class RoomUnitGroupServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "RoomUnitGroupServiceError";
    }
  },
}));

const mockedService = jest.mocked(RoomUnitGroupService);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("RoomUnitGroupController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  it("creates a room unit group", async () => {
    req.body = {
      resourceType: "Location",
      name: "Dog ward",
      managingOrganization: { reference: "Organization/org_1" },
      partOf: { reference: "Location/room_1" },
      extension: [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-count",
          valueInteger: 2,
        },
      ],
    };
    mockedService.create.mockResolvedValue({ id: "group_1" } as never);

    await RoomUnitGroupController.create(req as any, res as any);

    expect(mockedService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        roomId: "room_1",
        name: "Dog ward",
        unitCount: 2,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("lists room unit groups", async () => {
    req.query = { organizationId: "org_1" };
    mockedService.list.mockResolvedValue([
      {
        id: "group_1",
        organisationId: "org_1",
        roomId: "room_1",
        name: "Dog ward",
        unitCount: 2,
      },
    ] as never);

    await RoomUnitGroupController.list(req as any, res as any);

    expect(mockedService.list).toHaveBeenCalledWith({
      organisationId: "org_1",
      roomId: undefined,
      isActive: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
