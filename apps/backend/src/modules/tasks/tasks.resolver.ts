import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilterInput,
} from './dto/task.inputs';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TaskConnection } from '../../common/dto/task-connection.dto';

@Resolver(() => Task)
@UseGuards(GqlAuthGuard)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

  @Query(() => TaskConnection, { name: 'tasks' })
  tasks(
    @CurrentUser() user: User,
    @Args('filter', { nullable: true }) filter?: TaskFilterInput,
  ): Promise<TaskConnection> {
    return this.tasksService.findAll(
      user.id,
      filter ?? {},
      user.ianaTimezone,
    );
  }

  @Query(() => Task, { name: 'task' })
  task(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Task> {
    return this.tasksService.findById(user.id, id);
  }

  @Mutation(() => Task)
  createTask(
    @CurrentUser() user: User,
    @Args('input') input: CreateTaskInput,
  ): Promise<Task> {
    return this.tasksService.create(user.id, input, user.ianaTimezone);
  }

  @Mutation(() => Task)
  updateTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTaskInput,
  ): Promise<Task> {
    return this.tasksService.update(user.id, id, input, user.ianaTimezone);
  }

  @Mutation(() => Task)
  completeTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Task> {
    return this.tasksService.complete(user.id, id, user.ianaTimezone);
  }

  @Mutation(() => Task)
  reopenTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Task> {
    return this.tasksService.reopen(user.id, id);
  }

  @Mutation(() => Task)
  archiveTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Task> {
    return this.tasksService.archive(user.id, id);
  }

  @Mutation(() => Task)
  restoreTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Task> {
    return this.tasksService.restore(user.id, id);
  }

  @Mutation(() => Boolean)
  deleteTask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.tasksService.delete(user.id, id);
  }

  @Mutation(() => Task)
  stopRecurrence(
    @CurrentUser() user: User,
    @Args('taskId', { type: () => ID }) taskId: string,
  ): Promise<Task> {
    return this.tasksService.stopRecurrence(user.id, taskId);
  }
}
