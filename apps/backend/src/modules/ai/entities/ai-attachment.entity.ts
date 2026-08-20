import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { AiAttachmentStatus } from '../../../common/enums/ai-attachment-status.enum';
import { AiConversation } from './ai-conversation.entity';
import { User } from '../../users/entities/user.entity';

@ObjectType()
@Entity('ai_attachments')
export class AiAttachment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => String)
  @Column({ name: 'original_filename', type: 'varchar', length: 512 })
  originalFilename!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 1024, unique: true })
  storageKey!: string;

  @Field(() => String)
  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Field(() => Int)
  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: number;

  @Field(() => AiAttachmentStatus)
  @Column({
    type: 'enum',
    enum: AiAttachmentStatus,
    default: AiAttachmentStatus.UPLOADING,
  })
  status!: AiAttachmentStatus;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => AiConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
