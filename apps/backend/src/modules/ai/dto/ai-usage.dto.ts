import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiUsageStatus {
  @Field(() => Int)
  dailyLimit!: number;

  @Field(() => Int)
  used!: number;

  @Field(() => Int)
  remaining!: number;

  @Field(() => Date)
  resetAt!: Date;

  @Field(() => Boolean)
  providerConfigured!: boolean;
}
