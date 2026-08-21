import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class ConnectCalendarInput {
  @Field()
  @IsString()
  code!: string;

  @Field()
  @IsString()
  state!: string;
}

@InputType()
export class CalendarEventsInput {
  @Field()
  @IsDateString()
  from!: string;

  @Field()
  @IsDateString()
  to!: string;
}

@InputType()
export class GetUpcomingCalendarInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number;
}

@ObjectType()
export class CalendarConnectionStatus {
  @Field()
  connected!: boolean;

  @Field({ nullable: true })
  providerAccountId?: string;

  @Field({ nullable: true })
  connectedAt?: Date;

  @Field({ nullable: true })
  lastSyncedAt?: Date;

  /** True when the stored OAuth grant can create/update/delete events. */
  @Field()
  canWrite!: boolean;

  /**
   * True when connected but missing write scope (legacy calendar.readonly grant).
   * Frontend should prompt the user to reconnect.
   */
  @Field()
  needsReconnect!: boolean;
}

@ObjectType()
export class SyncCalendarResult {
  @Field()
  success!: boolean;

  @Field()
  eventsUpserted!: number;

  @Field({ nullable: true })
  message?: string;
}
