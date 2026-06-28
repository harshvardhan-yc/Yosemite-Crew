const ORIGINAL_ENV = {
  AUTH_API_DOMAIN: process.env.AUTH_API_DOMAIN,
  AUTH_WEBSITE_DOMAIN: process.env.AUTH_WEBSITE_DOMAIN,
  SUPERTOKENS_CONNECTION_URI: process.env.SUPERTOKENS_CONNECTION_URI,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
};

const restoreEnv = () => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("@yosemite-crew/auth supertokens config", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_API_DOMAIN = "https://api.example.com";
    process.env.AUTH_WEBSITE_DOMAIN = "https://app.example.com";
    process.env.SUPERTOKENS_CONNECTION_URI = "http://localhost:3567";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM_NAME;
    delete process.env.SMTP_FROM_EMAIL;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("can be imported without SMTP env vars present", () => {
    expect(() => {
      require("@yosemite-crew/auth");
    }).not.toThrow();
  });

  it("throws when SMTP env vars are missing at config build time", () => {
    const { getSuperTokensConfig } = require("@yosemite-crew/auth");

    expect(() => getSuperTokensConfig()).toThrow(
      "[auth] Missing required environment variable: SMTP_HOST",
    );
  });
});
