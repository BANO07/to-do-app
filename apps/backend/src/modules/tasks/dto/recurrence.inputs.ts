import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RecurrenceFrequency } from '../../../common/enums/recurrence-frequency.enum';

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

@InputType()
export class RecurrenceInput {
  @Field(() => RecurrenceFrequency)
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;

  @Field(() => [Int], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_YMD, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;
}
