import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { TaskSortField } from '../../../common/enums/task-sort-field.enum';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { TaskListView } from '../../../common/enums/task-list-view.enum';
import { RecurrenceInput } from './recurrence.inputs';

@InputType()
export class CreateTaskInput {
  @Field(() => String)
  @IsString()
  @MaxLength(255)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  dueDate?: Date;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => RecurrenceInput, { nullable: true })
  @IsOptional()
  recurrence?: RecurrenceInput;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  subtaskTitles?: string[];
}

@InputType()
export class UpdateTaskInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => TaskStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  dueDate?: Date | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @Field(() => RecurrenceInput, { nullable: true })
  @IsOptional()
  recurrence?: RecurrenceInput | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  stopRecurrence?: boolean;
}

@InputType()
export class TaskFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => TaskStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => TaskListView, { nullable: true })
  @IsOptional()
  @IsEnum(TaskListView)
  view?: TaskListView;

  @Field(() => TaskSortField, { nullable: true })
  @IsOptional()
  @IsEnum(TaskSortField)
  sortBy?: TaskSortField;

  @Field(() => SortOrder, { nullable: true })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
