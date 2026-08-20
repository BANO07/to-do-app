import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsBase64,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

@InputType()
export class UploadAiAttachmentInput {
  @Field(() => ID)
  @IsUUID()
  conversationId!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(255)
  filename!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(128)
  mimeType!: string;

  @Field(() => String, { description: 'Base64-encoded file content' })
  @IsString()
  base64Data!: string;
}

@InputType()
export class DeleteAiAttachmentInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
