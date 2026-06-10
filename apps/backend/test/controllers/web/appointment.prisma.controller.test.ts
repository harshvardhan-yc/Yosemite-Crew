import { beforeEach, describe, expect, jest, it } from "@jest/globals";
import { Request, Response } from "express";
import { AppointmentController } from "../../../src/controllers/web/appointment.prisma.controller";
import { AppointmentPrismaService } from "../../../src/services/appointment.prisma.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import { generatePresignedUrl } from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/appointment.prisma.service");
jest.mock("../../../src/services/authUserMobile.service");
jest.mock("../../../src/middlewares/upload");
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockedService = jest.mocked(AppointmentPrismaService);
const mockedAuth = jest.mocked(AuthUserMobileService);
const mockedUpload = jest.mocked(generatePresignedUrl);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("AppointmentPrismaController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, params: {}, body: {}, query: {} };
    res = buildResponse();
  });

  it("creates a requested appointment", async () => {
    mockedService.createRequestedFromMobile.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedService.createRequestedFromMobile).toHaveBeenCalledWith(
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment created",
      data: { id: "appt_1" },
    });
  });

  it("reschedules mobile appointments after auth lookup", async () => {
    (req as any).userId = "user_1";
    req.params = { appointmentId: "appt_1" };
    req.body = {
      startTime: "2026-06-10T11:00:00.000Z",
      endTime: "2026-06-10T11:30:00.000Z",
    };
    mockedAuth.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as any);
    mockedService.rescheduleFromParent.mockResolvedValue({
      id: "appt_1",
    } as any);

    await AppointmentController.rescheduleFromMobile(req as any, res as any);

    expect(mockedService.rescheduleFromParent).toHaveBeenCalledWith(
      "appt_1",
      "parent_1",
      expect.objectContaining({
        startTime: "2026-06-10T11:00:00.000Z",
        endTime: "2026-06-10T11:30:00.000Z",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 401 when mobile user is missing", async () => {
    await AppointmentController.rescheduleFromMobile(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("lists appointments for organisation", async () => {
    req.params = { organisationId: "org_1" };
    req.query = { status: "REQUESTED" };
    mockedService.getAppointmentsForOrganisation.mockResolvedValue([
      { id: "appt_1" },
    ] as any);

    await AppointmentController.listByOrganisation(req as any, res as any);

    expect(mockedService.getAppointmentsForOrganisation).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ status: ["REQUESTED"] }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("creates document upload urls", async () => {
    (req as any).userId = "user_1";
    req.body = { companionId: "comp_1", mimeType: "image/png" };
    mockedUpload.mockResolvedValue({
      url: "https://upload-url",
      key: "appointments/comp_1/file",
    } as any);

    await AppointmentController.getDocumentUplaodURL(req as any, res as any);

    expect(mockedUpload).toHaveBeenCalledWith(
      "image/png",
      "custom",
      "appointments/comp_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("logs and surfaces service errors", async () => {
    mockedService.createRequestedFromMobile.mockRejectedValue(
      Object.assign(new Error("Bad"), { statusCode: 400 }),
    );

    await AppointmentController.createRequestedFromMobile(
      req as any,
      res as any,
    );

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Bad" });
  });
});
