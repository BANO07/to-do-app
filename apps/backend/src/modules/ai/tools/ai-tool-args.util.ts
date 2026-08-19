import { BadRequestException } from '@nestjs/common';

const BLOCKED_KEYS = new Set(['userId', 'user_id', 'ownerId', 'owner_id']);

export function sanitizeToolArguments(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (BLOCKED_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export function requireString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function optionalNumber(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new BadRequestException(`${key} must be a number`);
  }
  return value;
}

export function optionalEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestException(`${key} is invalid`);
  }
  return value as T;
}

export function optionalStringArray(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${key} must be an array`);
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}
