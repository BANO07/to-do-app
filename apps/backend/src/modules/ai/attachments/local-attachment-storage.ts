import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { AttachmentStorage } from './attachment-storage.interface';

@Injectable()
export class LocalAttachmentStorage implements AttachmentStorage {
  private readonly logger = new Logger(LocalAttachmentStorage.name);
  private readonly storageDir: string;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('AI_ATTACHMENT_STORAGE_DIR');
    this.storageDir = configured ?? join(process.cwd(), '../../.ai-attachments');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
      this.logger.log(`Created attachment storage dir: ${this.storageDir}`);
    }
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.keyToPath(key);
    await writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = this.keyToPath(key);
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.keyToPath(key);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist; safe to ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.keyToPath(key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private keyToPath(key: string): string {
    // Keys are safe UUIDs with an extension — no path traversal possible
    const sanitized = key.replace(/[^a-zA-Z0-9._-]/g, '');
    return join(this.storageDir, sanitized);
  }
}
