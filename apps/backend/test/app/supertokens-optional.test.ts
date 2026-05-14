jest.mock(
  "@yosemite-crew/auth",
  () => ({
    initSuperTokens: jest.fn(),
    registerSuperTokensBeforeRoutes: jest.fn(),
    registerSuperTokensErrorHandler: jest.fn(),
    requireAuth: () => (_req: unknown, _res: unknown, next: () => void) =>
      next(),
    getSessionUserId: () => "test-user-id",
  }),
  { virtual: true },
);

import { createApp } from "../../src/app";

function unsetEnv(keys: string[]) {
  for (const key of keys) {
    // eslint-disable-next-line no-process-env
    delete process.env[key];
  }
}

describe("createApp SuperTokens optional", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not throw when SuperTokens env is missing", () => {
    unsetEnv([
      "SUPERTOKENS_DISABLED",
      "SUPERTOKENS_CONNECTION_URI",
      "AUTH_API_DOMAIN",
      "AUTH_WEBSITE_DOMAIN",
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL",
    ]);

    expect(() => createApp()).not.toThrow();
  });

  it("does not throw when SuperTokens is explicitly disabled", () => {
    unsetEnv([
      "SUPERTOKENS_CONNECTION_URI",
      "AUTH_API_DOMAIN",
      "AUTH_WEBSITE_DOMAIN",
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL",
    ]);

    process.env.SUPERTOKENS_DISABLED = "true";

    expect(() => createApp()).not.toThrow();
  });
});
