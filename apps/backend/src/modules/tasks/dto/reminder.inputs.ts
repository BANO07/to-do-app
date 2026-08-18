import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ReminderChannel } from '../../../common/enums/reminder-channel.enum';

@InputType()
export class CreateReminderInput {
  @Field(() => String)
  @IsUUID()
  taskId!: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  offsetMinutes?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  localDateTime?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fireAt?: Date;

  @Field(() => ReminderChannel, { nullable: true })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;
}

@InputType()
export class UpdateReminderInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  offsetMinutes?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  localDateTime?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fireAt?: Date;

  @Field(() => ReminderChannel, { nullable: true })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;
}
