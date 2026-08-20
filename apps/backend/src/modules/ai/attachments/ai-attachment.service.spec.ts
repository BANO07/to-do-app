import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAttachmentService } from './ai-attachment.service';
import { AiAttachmentRepository } from './ai-attachment.repository';
import { AiConversationRepository } from '../ai-conversation.repository';
import { ATTACHMENT_STORAGE } from './attachment-storage.interface';
import { AiAttachmentStatus } from '../../../common/enums/ai-attachment-status.enum';

const mockConversationRepo = () => ({
  findConversationForUser: jest.fn(),
});

const mockAttachmentRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findForConversation: jest.fn(),
  findReadyForConversation: jest.fn(),
  updateStatus: jest.fn(),
  deleteRecord: jest.fn(),
});

const mockStorage = () => ({
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(null),
});

const VALID_MIME = 'text/plain';
const VALID_EXT_NAME = 'notes.txt';
const USER_ID = 'user-uuid';
const CONV_ID = 'conv-uuid';
const ATTACH_ID = 'attach-uuid';

describe('AiAttachmentService', () => {
  let service: AiAttachmentService;
  let attachmentRepo: ReturnType<typeof mockAttachmentRepo>;
  let conversationRepo: ReturnType<typeof mockConversationRepo>;
  let storage: ReturnType<typeof mockStorage>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAttachmentService,
        { provide: AiAttachmentRepository, useFactory: mockAttachmentRepo },
        { provide: AiConversationRepository, useFactory: mockConversationRepo },
        { provide: ATTACHMENT_STORAGE, useFactory: mockStorage },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(AiAttachmentService);
    attachmentRepo = module.get(AiAttachmentRepository);
    conversationRepo = module.get(AiConversationRepository);
    storage = module.get(ATTACHMENT_STORAGE);
  });

  describe('uploadAttachment', () => {
    const base64 = Buffer.from('hello world').toString('base64');
    const conversation = { id: CONV_ID, userId: USER_ID };

    beforeEach(() => {
      conversationRepo.findConversationForUser.mockResolvedValue(conversation);
      attachmentRepo.create.mockResolvedValue({
        id: ATTACH_ID,
        status: AiAttachmentStatus.UPLOADING,
        storageKey: 'key.txt',
      });
      attachmentRepo.updateStatus.mockResolvedValue({
        id: ATTACH_ID,
        status: AiAttachmentStatus.READY,
        storageKey: 'key.txt',
      });
      storage.put.mockResolvedValue(undefined);
    });

    it('should upload and return READY attachment', async () => {
      const result = await service.uploadAttachment(
        USER_ID,
        CONV_ID,
        VALID_EXT_NAME,
        VALID_MIME,
        base64,
      );
      expect(result.status).toBe(AiAttachmentStatus.READY);
      expect(storage.put).toHaveBeenCalled();
    });

    it('should verify conversation ownership before upload', async () => {
      conversationRepo.findConversationForUser.mockResolvedValue(null);
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, VALID_EXT_NAME, VALID_MIME, base64),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject unsupported MIME type', async () => {
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, 'file.exe', 'application/octet-stream', base64),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported extension', async () => {
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, 'file.exe', 'text/plain', base64),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject mismatched MIME and extension', async () => {
      // .csv with image/png mimeType
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, 'file.csv', 'image/png', base64),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject oversized files', async () => {
      const bigData = Buffer.alloc(11 * 1024 * 1024).toString('base64');
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, VALID_EXT_NAME, VALID_MIME, bigData),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject path traversal filenames', async () => {
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, '../etc/passwd', VALID_MIME, base64),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject null bytes in filenames', async () => {
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, 'file\0.txt', VALID_MIME, base64),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate a storage key independent of original filename', async () => {
      await service.uploadAttachment(USER_ID, CONV_ID, VALID_EXT_NAME, VALID_MIME, base64);
      const createCall = attachmentRepo.create.mock.calls[0][0] as { storageKey: string };
      expect(createCall.storageKey).not.toContain(VALID_EXT_NAME);
      expect(createCall.storageKey).toMatch(/^[a-f0-9-]+\.txt$/i);
    });

    it('should mark attachment FAILED if storage fails', async () => {
      storage.put.mockRejectedValue(new Error('disk full'));
      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, VALID_EXT_NAME, VALID_MIME, base64),
      ).rejects.toThrow(BadRequestException);
      expect(attachmentRepo.updateStatus).toHaveBeenCalledWith(
        ATTACH_ID,
        AiAttachmentStatus.FAILED,
      );
    });
  });

  describe('listAttachments', () => {
    it('should verify conversation ownership', async () => {
      conversationRepo.findConversationForUser.mockResolvedValue(null);
      await expect(service.listAttachments(USER_ID, CONV_ID)).rejects.toThrow(NotFoundException);
    });

    it('should return attachments for owned conversation', async () => {
      conversationRepo.findConversationForUser.mockResolvedValue({ id: CONV_ID });
      attachmentRepo.findForConversation.mockResolvedValue([{ id: ATTACH_ID }]);
      const result = await service.listAttachments(USER_ID, CONV_ID);
      expect(result).toHaveLength(1);
      expect(attachmentRepo.findForConversation).toHaveBeenCalledWith(CONV_ID, USER_ID);
    });
  });

  describe('deleteAttachment', () => {
    it('should delete owned attachment', async () => {
      attachmentRepo.findById.mockResolvedValue({
        id: ATTACH_ID,
        userId: USER_ID,
        storageKey: 'key.txt',
      });
      attachmentRepo.updateStatus.mockResolvedValue({});
      storage.delete.mockResolvedValue(undefined);
      attachmentRepo.deleteRecord.mockResolvedValue(undefined);
      const result = await service.deleteAttachment(USER_ID, ATTACH_ID);
      expect(result).toBe(true);
      expect(storage.delete).toHaveBeenCalledWith('key.txt');
    });

    it('should reject deletion by non-owner', async () => {
      attachmentRepo.findById.mockResolvedValue({
        id: ATTACH_ID,
        userId: 'other-user',
        storageKey: 'key.txt',
      });
      await expect(
        service.deleteAttachment(USER_ID, ATTACH_ID),
      ).rejects.toBeDefined();
    });

    it('should throw not found for missing attachment', async () => {
      attachmentRepo.findById.mockResolvedValue(null);
      await expect(
        service.deleteAttachment(USER_ID, ATTACH_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReadyAttachmentsForConversation', () => {
    it('should return only READY attachments belonging to user', async () => {
      attachmentRepo.findReadyForConversation.mockResolvedValue([
        { id: ATTACH_ID, status: AiAttachmentStatus.READY },
      ]);
      const result = await service.getReadyAttachmentsForConversation(CONV_ID, USER_ID);
      expect(result).toHaveLength(1);
      expect(attachmentRepo.findReadyForConversation).toHaveBeenCalledWith(CONV_ID, USER_ID);
    });
  });

  describe('body-parser / attachment size limit independence', () => {
    it('should reject a file that exceeds AI_ATTACHMENT_MAX_SIZE_MB even when the body-parser limit is higher', async () => {
      // This test documents that AI_GRAPHQL_BODY_LIMIT_MB (default 15 MB) and
      // AI_ATTACHMENT_MAX_SIZE_MB (default 10 MB) are independent controls.
      // The body-parser accepts the request; AiAttachmentService rejects the decoded payload.
      conversationRepo.findConversationForUser.mockResolvedValue({
        id: CONV_ID,
        userId: USER_ID,
      });

      // Simulate a file that is 11 MB — within the 15 MB body-parser limit but over the 10 MB attachment limit
      const elevenMbData = Buffer.alloc(11 * 1024 * 1024).toString('base64');

      await expect(
        service.uploadAttachment(USER_ID, CONV_ID, VALID_EXT_NAME, VALID_MIME, elevenMbData),
      ).rejects.toThrow(BadRequestException);

      // Storage must NOT have been called — validation must happen before writing
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('should accept a file just below AI_ATTACHMENT_MAX_SIZE_MB', async () => {
      conversationRepo.findConversationForUser.mockResolvedValue({
        id: CONV_ID,
        userId: USER_ID,
      });
      attachmentRepo.create.mockResolvedValue({
        id: ATTACH_ID,
        status: AiAttachmentStatus.UPLOADING,
        storageKey: 'key.txt',
      });
      attachmentRepo.updateStatus.mockResolvedValue({
        id: ATTACH_ID,
        status: AiAttachmentStatus.READY,
        storageKey: 'key.txt',
      });
      storage.put.mockResolvedValue(undefined);

      // 9 MB — under the 10 MB limit
      const nineMbData = Buffer.alloc(9 * 1024 * 1024).toString('base64');

      const result = await service.uploadAttachment(
        USER_ID,
        CONV_ID,
        VALID_EXT_NAME,
        VALID_MIME,
        nineMbData,
      );
      expect(result.status).toBe(AiAttachmentStatus.READY);
      expect(storage.put).toHaveBeenCalled();
    });
  });
});
