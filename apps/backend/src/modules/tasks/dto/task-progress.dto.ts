import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class TaskProgress {
  @Field(() => Int)
  completed!: number;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  percentage!: number;
}
