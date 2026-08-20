import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AiAttachment } from '../entities/ai-attachment.entity';
import { AiAttachmentRepository } from './ai-attachment.repository';
import { AiConversationRepository } from '../ai-conversation.repository';
import {
  ATTACHMENT_STORAGE,
  AttachmentStorage,
} from './attachment-storage.interface';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_SIZE_MB,
} from './ai-attachment.constants';
import { AiAttachmentStatus } from '../../../common/enums/ai-attachment-status.enum';

@Injectable()
export class AiAttachmentService {
  private readonly logger = new Logger(AiAttachmentService.name);
  private readonly maxSizeBytes: number;

  constructor(
    private readonly attachmentRepo: AiAttachmentRepository,
    private readonly conversationRepo: AiConversationRepository,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
    private readonly configService: ConfigService,
  ) {
    const mb = this.configService.get<number>('AI_ATTACHMENT_MAX_SIZE_MB');
    this.maxSizeBytes = (mb && mb > 0 ? mb : DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
  }

  async uploadAttachment(
    userId: string,
    conversationId: string,
    originalFilename: string,
    mimeType: string,
    base64Data: string,
  ): Promise<AiAttachment> {
    // Verify conversation ownership
    const conversation = await this.conversationRepo.findConversationForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new NotFoundException('AI conversation not found.');
    }

    // Sanitize and validate filename
    const safeName = this.sanitizeFilename(originalFilename);
    if (!safeName) {
      throw new BadRequestException('Invalid filename.');
    }

    const ext = extname(safeName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Unsupported file type.');
    }

    // Validate MIME type independently of browser-supplied value
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      throw new BadRequestException('Unsupported file type.');
    }

    // Ensure extension and MIME type are consistent
    if (!this.mimeMatchesExtension(normalizedMime, ext)) {
      throw new BadRequestException('Unsupported file type.');
    }

    // Decode and validate size
    let fileData: Buffer;
    try {
      fileData = Buffer.from(base64Data, 'base64');
    } catch {
      throw new BadRequestException('Invalid file data.');
    }

    if (fileData.length === 0) {
      throw new BadRequestException('File is empty.');
    }

    if (fileData.length > this.maxSizeBytes) {
      throw new BadRequestException('File is too large.');
    }

    // Generate a safe, unique storage key
    const storageKey = `${randomUUID()}${ext}`;

    // Create DB record in UPLOADING state
    const attachment = await this.attachmentRepo.create({
      conversationId,
      userId,
      originalFilename: safeName,
      storageKey,
      mimeType: normalizedMime,
      sizeBytes: fileData.length,
      status: AiAttachmentStatus.UPLOADING,
    });

    // Write to storage; update status accordingly
    try {
      await this.storage.put(storageKey, fileData, normalizedMime);
      const ready = await this.attachmentRepo.updateStatus(
        attachment.id,
        AiAttachmentStatus.READY,
      );
      return ready ?? attachment;
    } catch (error) {
      this.logger.error(
        `Storage write failed for attachment ${attachment.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      await this.attachmentRepo.updateStatus(
        attachment.id,
        AiAttachmentStatus.FAILED,
      );
      throw new BadRequestException('Unable to store file. Please try again.');
    }
  }

  async listAttachments(
    userId: string,
    conversationId: string,
  ): Promise<AiAttachment[]> {
    const conversation = await this.conversationRepo.findConversationForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new NotFoundException('AI conversation not found.');
    }
    return this.attachmentRepo.findForConversation(conversationId, userId);
  }

  async deleteAttachment(userId: string, attachmentId: string): Promise<boolean> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundException('AI conversation not found.');
    }
    if (attachment.userId !== userId) {
      throw new ForbiddenException('AI conversation not found.');
    }

    // Mark deleted in DB first, then remove from storage
    await this.attachmentRepo.updateStatus(attachmentId, AiAttachmentStatus.DELETED);
    try {
      await this.storage.delete(attachment.storageKey);
    } catch (error) {
      this.logger.warn(
        `Storage delete failed for key ${attachment.storageKey}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    await this.attachmentRepo.deleteRecord(attachmentId);
    return true;
  }

  async getReadyAttachmentsForConversation(
    conversationId: string,
    userId: string,
  ): Promise<AiAttachment[]> {
    return this.attachmentRepo.findReadyForConversation(conversationId, userId);
  }

  async getAttachmentData(
    userId: string,
    attachmentId: string,
  ): Promise<{ data: Buffer; mimeType: string; filename: string } | null> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment || attachment.userId !== userId) {
      return null;
    }
    if (attachment.status !== AiAttachmentStatus.READY) {
      return null;
    }
    const data = await this.storage.get(attachment.storageKey);
    if (!data) {
      return null;
    }
    return {
      data,
      mimeType: attachment.mimeType,
      filename: attachment.originalFilename,
    };
  }

  private sanitizeFilename(name: string): string | null {
    if (!name || typeof name !== 'string') {
      return null;
    }
    // Reject null bytes, path traversal, absolute paths
    if (
      name.includes('\0') ||
      name.includes('..') ||
      name.startsWith('/') ||
      name.startsWith('\\')
    ) {
      return null;
    }
    // Keep only the basename
    const base = name.replace(/[/\\]/g, '_').trim();
    if (!base || base.length > 255) {
      return null;
    }
    return base;
  }

  private mimeMatchesExtension(mime: string, ext: string): boolean {
    const map: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
      ],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    };
    return (map[mime] ?? []).includes(ext);
  }
}
