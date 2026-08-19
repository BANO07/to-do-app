const optionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  return String(value);
};

const parsePositiveInt = (
  value: unknown,
  key: string,
  defaultValue: number,
): number => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
};

export const validateEnv = (config: Record<string, unknown>) => {
  const required = [
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'JWT_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL',
  ] as const;

  for (const key of required) {
    if (!config[key] || String(config[key]).trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  return {
    NODE_ENV: (config.NODE_ENV as string) ?? 'development',
    PORT: Number(config.PORT ?? 3000),
    DATABASE_URL: String(config.DATABASE_URL),
    GOOGLE_CLIENT_ID: String(config.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: String(config.GOOGLE_CLIENT_SECRET),
    GOOGLE_CALLBACK_URL: String(config.GOOGLE_CALLBACK_URL),
    JWT_SECRET: String(config.JWT_SECRET),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? '7d'),
    FRONTEND_URL: String(config.FRONTEND_URL),
    BACKEND_URL: String(config.BACKEND_URL),
    EMAIL_PROVIDER: config.EMAIL_PROVIDER
      ? String(config.EMAIL_PROVIDER)
      : undefined,
    EMAIL_FROM: config.EMAIL_FROM ? String(config.EMAIL_FROM) : undefined,
    EMAIL_API_KEY: config.EMAIL_API_KEY
      ? String(config.EMAIL_API_KEY)
      : undefined,
    PUSH_VAPID_PUBLIC_KEY: config.PUSH_VAPID_PUBLIC_KEY
      ? String(config.PUSH_VAPID_PUBLIC_KEY)
      : undefined,
    PUSH_VAPID_PRIVATE_KEY: config.PUSH_VAPID_PRIVATE_KEY
      ? String(config.PUSH_VAPID_PRIVATE_KEY)
      : undefined,
    PUSH_VAPID_SUBJECT: config.PUSH_VAPID_SUBJECT
      ? String(config.PUSH_VAPID_SUBJECT)
      : undefined,
    GEMINI_API_KEY: optionalString(config.GEMINI_API_KEY),
    AI_PROVIDER: optionalString(config.AI_PROVIDER) ?? 'gemini',
    AI_MODEL: optionalString(config.AI_MODEL),
    AI_FREE_DAILY_LIMIT: parsePositiveInt(
      config.AI_FREE_DAILY_LIMIT,
      'AI_FREE_DAILY_LIMIT',
      20,
    ),
    AI_RATE_LIMIT_PER_MINUTE: parsePositiveInt(
      config.AI_RATE_LIMIT_PER_MINUTE,
      'AI_RATE_LIMIT_PER_MINUTE',
      10,
    ),
  };
};

export type AppConfig = ReturnType<typeof validateEnv>;
