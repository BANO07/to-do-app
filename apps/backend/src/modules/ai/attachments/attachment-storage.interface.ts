export interface AttachmentStorage {
  /** Store raw bytes under the given key. Returns the key. */
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  /** Retrieve raw bytes for the given key. Returns null if not found. */
  get(key: string): Promise<Buffer | null>;
  /** Delete a stored file. Resolves even if the key doesn't exist. */
  delete(key: string): Promise<void>;
  /** Check whether a key exists in storage. */
  exists(key: string): Promise<boolean>;
}

export const ATTACHMENT_STORAGE = Symbol('ATTACHMENT_STORAGE');
