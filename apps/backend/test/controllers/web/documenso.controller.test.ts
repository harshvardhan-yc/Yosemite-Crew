import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Request, Response } from "express";
import { DocumensoWebhookController } from "../../../src/controllers/web/documenso.controller";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/utils/logger");

const mockedLogger = jest.mocked(logger);

describe("DocumensoWebhookController", () => {
  const originalSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let endMock: jest.Mock;

  beforeAll(() => {
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.DOCUMENSO_WEBHOOK_SECRET;
      return;
    }

    process.env.DOCUMENSO_WEBHOOK_SECRET = originalSecret;
  });

  beforeEach(() => {
    jsonMock = jest.fn();
    endMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, end: endMock });

    req = {
      body: Buffer.from(
        JSON.stringify({
          event: undefined,
          payload: { id: 'doc-123"}\n{"level":"error"' },
        }),
      ),
      headers: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      end: endMock,
    } as unknown as Response;

    jest.clearAllMocks();
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  it("logs a static message for invalid payloads without including request data", async () => {
    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Invalid payload",
    );
    expect(mockedLogger.error).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid payload" });
  });
});
