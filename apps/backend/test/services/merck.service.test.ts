jest.mock("src/integrations/merck/merck.client", () => {
  const __searchMock = jest.fn();
  return {
    MerckHealthlinkClient: jest.fn().mockImplementation(() => ({
      search: __searchMock,
    })),
    __searchMock,
  };
});

jest.mock("src/services/integration.service", () => ({
  IntegrationService: {
    ensureMerckAccount: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { MerckService } from "src/services/merck.service";
import { IntegrationService } from "src/services/integration.service";
import logger from "src/utils/logger";

const mockedLogger = jest.mocked(logger);

describe("MerckService", () => {
  const originalEnv = process.env;
  const mockedIntegrationService = IntegrationService as unknown as {
    ensureMerckAccount: jest.Mock;
  };
  const getSearchMock = () =>
    // jest.mock factory adds this field at runtime
    (jest.requireMock("src/integrations/merck/merck.client") as any)
      .__searchMock as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
      "https://merckvetmanual.com/infobutton/searchjson";
    process.env.MERCK_HEALTHLINK_USERNAME = "test-user";
    process.env.MERCK_HEALTHLINK_PASSWORD = "test-pass";
    mockedIntegrationService.ensureMerckAccount.mockResolvedValue({
      status: "enabled",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not leak Healthlink credentials when logging Axios search failures", async () => {
    const LEAK_USER = "LEAK_USER_123";
    const LEAK_PASS = "LEAK_PASS_456";

    const axiosError = Object.assign(new Error("boom"), {
      isAxiosError: true,
      code: "ECONNABORTED",
      config: {
        baseURL: "https://merckvetmanual.com/infobutton/searchjson",
        url: "/infobutton/searchjson?holder.assignedEntity.n=" + LEAK_USER,
        method: "get",
        timeout: 1000,
        params: {
          "holder.assignedEntity.n": LEAK_USER,
          "holder.assignedEntity.certificateText": LEAK_PASS,
        },
      },
      response: { status: 401 },
    });

    getSearchMock().mockRejectedValueOnce(axiosError);

    await expect(
      MerckService.searchConsumer({
        query: "canine diabetes",
        requestId: "req-1",
        timezone: "America/New_York",
      }),
    ).rejects.toBe(axiosError);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Merck search failed",
      expect.any(Object),
    );

    const meta = mockedLogger.error.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;

    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(LEAK_USER);
    expect(serialized).not.toContain(LEAK_PASS);
    expect(serialized).not.toContain("holder.assignedEntity");
  });

  it("validates required fields before searching", async () => {
    await expect(
      MerckService.searchConsumer({
        query: "   ",
        requestId: "req-2",
      }),
    ).rejects.toThrow("q is required.");
  });

  it("normalizes JSON feed payloads", async () => {
    getSearchMock().mockResolvedValueOnce({
      data: JSON.stringify({
        feed: {
          id: "feed-1",
          updated: "2026-01-01T00:00:00Z",
          category: [{ "@scheme": "informationrecipient", "@term": "PAT" }],
          entry: [
            {
              id: "topic-1",
              title: { "#text": "  Feline  Diabetes " },
              summary: {
                "#text":
                  '<p>One <a href="https://merckvetmanual.com/topic-a">A</a> and <a href="https://merckvetmanual.com/topic-a/">dup</a></p>',
              },
              updated: "2026-01-02T00:00:00Z",
              link: { "@href": "https://merckvetmanual.com/topic-a/" },
            },
          ],
        },
      }),
      contentType: "application/json",
      status: 200,
      finalUrl: null,
    });

    const response = await MerckService.searchConsumer({
      query: "feline diabetes",
      requestId: "req-json",
      timezone: "America/New_York",
      media: "full",
      code: "1234",
      codeSystem: "ICD10CM",
      displayName: "  custom name  ",
      originalText: "  original text  ",
      subTopicCode: "M01",
      subTopicDisplay: "sub topic",
    });

    expect(response.meta).toMatchObject({
      requestId: "feed-1",
      source: "merck-live-feed",
      audience: "PAT",
      language: "en",
      totalResults: 1,
    });
    expect(response.entries[0]).toMatchObject({
      id: "topic-1",
      title: "Feline  Diabetes",
      summaryText: "One A and dup",
      audience: "PAT",
      primaryUrl:
        "https://merckvetmanual.com/topic-a/?utm_source=yosemitecrew&utm_medium=Partner",
    });
    expect(response.entries[0].subLinks).toEqual([
      {
        label: "Full Summary",
        url: "https://merckvetmanual.com/topic-a/?utm_source=yosemitecrew&utm_medium=Partner",
      },
    ]);
    expect(getSearchMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        "mainSearchCriteria.v.c": "1234",
        "mainSearchCriteria.v.csn": "ICD10CM",
        "mainSearchCriteria.v.dn": "custom name",
        "mainSearchCriteria.v.ot": "original text",
        "subTopic.v.cs": "2.16.840.1.113883.6.177",
        "subTopic.v.c": "M01",
        "subTopic.v.dn": "sub topic",
      }),
      expect.any(Object),
    );
  });

  it("normalizes XML payloads and retries on HTML", async () => {
    getSearchMock()
      .mockResolvedValueOnce({
        data: "<html>blocked</html>",
        contentType: "text/html",
        status: 200,
        finalUrl: null,
      })
      .mockResolvedValueOnce({
        data: `<?xml version="1.0"?><feed><id>xml-feed</id><updated>2026-01-01</updated><category scheme="informationrecipient" term="PROV"/><entry><id>xml-1</id><title>Canine topic</title><summary><![CDATA[<p><a href="https://msdvetmanual.com/topic-b">Topic B</a></p>]]></summary><link href="https://msdvetmanual.com/topic-b"/></entry></feed>`,
        contentType: "application/atom+xml",
        status: 200,
        finalUrl: null,
      });

    const response = await MerckService.searchConsumer({
      query: "canine topic",
      requestId: "req-xml",
      timezone: "UTC+01:00",
    });

    expect(response.meta).toMatchObject({
      requestId: "xml-feed",
      source: "merck-live-atom",
      audience: "PROV",
      totalResults: 1,
    });
    expect(response.entries[0]).toMatchObject({
      id: "xml-1",
      title: "Canine topic",
      summaryText: "Topic B",
      primaryUrl:
        "https://msdvetmanual.com/topic-b?media=hybrid&utm_source=yosemitecrew&utm_medium=Partner",
    });
    expect(getSearchMock()).toHaveBeenCalledTimes(2);
    expect(mockedLogger.info).toHaveBeenCalledWith(
      "Merck search completed",
      expect.objectContaining({
        requestId: "req-xml",
      }),
    );
  });

  it("throws when Merck integration is disabled for the organisation", async () => {
    mockedIntegrationService.ensureMerckAccount.mockResolvedValueOnce({
      status: "disabled",
    });

    await expect(
      MerckService.search({
        query: "canine topic",
        organisationId: "org-1",
        requestId: "req-disabled",
        timezone: "America/New_York",
      }),
    ).rejects.toThrow("Merck Manuals is disabled for this organization.");
  });

  it("rejects invalid Merck timeout configuration", async () => {
    process.env.MERCK_HEALTHLINK_TIMEOUT_MS = "0";
    await expect(
      MerckService.searchConsumer({
        query: "canine topic",
        requestId: "req-timeout",
      }),
    ).rejects.toThrow("Invalid Merck timeout configuration.");
  });
});
