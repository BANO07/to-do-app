import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAttachment } from '../entities/ai-attachment.entity';
import { AiAttachmentStatus } from '../../../common/enums/ai-attachment-status.enum';

@Injectable()
export class AiAttachmentRepository {
  constructor(
    @InjectRepository(AiAttachment)
    private readonly repo: Repository<AiAttachment>,
  ) {}

  create(data: {
    conversationId: string;
    userId: string;
    originalFilename: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    status: AiAttachmentStatus;
  }): Promise<AiAttachment> {
    const attachment = this.repo.create(data);
    return this.repo.save(attachment);
  }

  findById(id: string): Promise<AiAttachment | null> {
    return this.repo.findOne({ where: { id } });
  }

  findForConversation(
    conversationId: string,
    userId: string,
  ): Promise<AiAttachment[]> {
    return this.repo.find({
      where: { conversationId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  findReadyForConversation(
    conversationId: string,
    userId: string,
  ): Promise<AiAttachment[]> {
    return this.repo.find({
      where: {
        conversationId,
        userId,
        status: AiAttachmentStatus.READY,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(
    id: string,
    status: AiAttachmentStatus,
  ): Promise<AiAttachment | null> {
    await this.repo.update({ id }, { status });
    return this.findById(id);
  }

  async deleteRecord(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
