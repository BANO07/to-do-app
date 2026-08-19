import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiUsageStatus } from './ai-usage.dto';

@InputType()
export class AiChatInput {
  @Field(() => ID)
  @IsUUID()
  conversationId!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(4000)
  message!: string;
}

@InputType()
export class ConfirmAiActionInput {
  @Field(() => ID)
  @IsUUID()
  confirmationId!: string;
}

@ObjectType()
export class AiToolCallResult {
  @Field(() => String)
  toolName!: string;

  @Field(() => String, { nullable: true })
  toolCallId?: string;

  @Field(() => String)
  summary!: string;

  @Field(() => Boolean)
  success!: boolean;
}

@ObjectType()
export class AiPendingConfirmation {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  action!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => String)
  toolName!: string;
}

@ObjectType()
export class AiChatResponse {
  @Field(() => AiConversation)
  conversation!: AiConversation;

  @Field(() => AiMessage, { nullable: true })
  assistantMessage?: AiMessage | null;

  @Field(() => [AiToolCallResult])
  toolCalls!: AiToolCallResult[];

  @Field(() => AiPendingConfirmation, { nullable: true })
  pendingConfirmation?: AiPendingConfirmation | null;

  @Field(() => Boolean)
  completed!: boolean;

  @Field(() => AiUsageStatus, { nullable: true })
  usage?: AiUsageStatus | null;
}

@ObjectType()
export class AiConfirmActionResponse {
  @Field(() => AiConversation)
  conversation!: AiConversation;

  @Field(() => AiMessage, { nullable: true })
  assistantMessage?: AiMessage | null;

  @Field(() => AiToolCallResult)
  toolResult!: AiToolCallResult;

  @Field(() => Boolean)
  completed!: boolean;
}

@ObjectType()
export class AiMessagesPage {
  @Field(() => [AiMessage])
  items!: AiMessage[];

  @Field(() => Int)
  limit!: number;
}
