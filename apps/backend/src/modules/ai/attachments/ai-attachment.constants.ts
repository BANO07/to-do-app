export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.docx',
  '.txt',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export const IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const DEFAULT_MAX_SIZE_MB = 10;
export const DEFAULT_MAX_TEXT_CHARS = 50_000;
