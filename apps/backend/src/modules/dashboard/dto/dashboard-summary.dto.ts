import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class DashboardSummary {
  @Field(() => Int)
  todayTotal!: number;

  @Field(() => Int)
  todayCompleted!: number;

  @Field(() => Int)
  todayOpen!: number;

  @Field(() => Int)
  todayInProgress!: number;

  @Field(() => Int)
  todayPending!: number;

  @Field(() => Int)
  todayHighPriority!: number;

  @Field(() => Int)
  overdueCount!: number;

  @Field(() => Int)
  upcomingCount!: number;

  @Field(() => Int)
  completedTodayCount!: number;

  @Field(() => Int)
  totalActiveTasks!: number;

  @Field(() => Int)
  completionPercentage!: number;
}
