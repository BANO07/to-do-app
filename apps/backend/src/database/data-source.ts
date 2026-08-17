import { DataSource, DataSourceOptions } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

const loadEnv = (): void => {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
    join(__dirname, '../../../../.env'),
    join(__dirname, '../../.env'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      dotenvConfig({ path, override: false });
    }
  }
};

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create todo-app/.env from .env.example (or apps/backend/.env).',
  );
}

export const getDatabaseConfig = (): DataSourceOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export default new DataSource(getDatabaseConfig());
