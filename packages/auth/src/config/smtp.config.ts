function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSmtpSettings() {
  const SMTP_PASSWORD_FIELD = 'password' as const;

  return {
    host: requireEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    authUsername: requireEnv('SMTP_USER'),
    [SMTP_PASSWORD_FIELD]: requireEnv('SMTP_PASSWORD'),
    from: {
      name: process.env.SMTP_FROM_NAME ?? 'Yosemite Crew',
      email: requireEnv('SMTP_FROM_EMAIL'),
    },
  };
}
