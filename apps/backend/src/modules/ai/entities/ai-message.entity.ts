import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AiMessageRole } from '../../../common/enums/ai-message-role.enum';
import { User } from '../../users/entities/user.entity';
import { AiConversation } from './ai-conversation.entity';

@ObjectType()
@Entity('ai_messages')
export class AiMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => AiMessageRole)
  @Column({ type: 'enum', enum: AiMessageRole })
  role!: AiMessageRole;

  @Field(() => String)
  @Column({ type: 'text' })
  content!: string;

  @Field(() => String, { nullable: true })
  @Column({ name: 'tool_name', type: 'varchar', length: 128, nullable: true })
  toolName?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'tool_call_id', type: 'varchar', length: 128, nullable: true })
  toolCallId?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'tool_status', type: 'varchar', length: 64, nullable: true })
  toolStatus?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => AiConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
