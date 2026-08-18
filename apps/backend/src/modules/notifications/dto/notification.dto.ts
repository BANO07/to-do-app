import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Notification } from '../entities/notification.entity';
import { PageInfo } from '../../../common/dto/page-info.dto';

@InputType()
export class NotificationsInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

@ObjectType()
export class NotificationConnection {
  @Field(() => [Notification])
  items!: Notification[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}

@InputType()
export class UpdateNotificationPreferencesInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}

@InputType()
export class SavePushSubscriptionInput {
  @Field(() => String)
  endpoint!: string;

  @Field(() => String)
  p256dh!: string;

  @Field(() => String)
  auth!: string;
}

@InputType()
export class RemovePushSubscriptionInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
