import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Task } from '../../modules/tasks/entities/task.entity';
import { PageInfo } from './page-info.dto';

@ObjectType()
export class TaskConnection {
  @Field(() => [Task])
  items!: Task[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}
