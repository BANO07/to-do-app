import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SubtasksService } from './subtasks.service';
import { Subtask } from './entities/subtask.entity';
import {
  CreateSubtaskInput,
  UpdateSubtaskInput,
} from './dto/subtask.inputs';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Subtask)
@UseGuards(GqlAuthGuard)
export class SubtasksResolver {
  constructor(private readonly subtasksService: SubtasksService) {}

  @Query(() => [Subtask], { name: 'subtasks' })
  subtasks(
    @CurrentUser() user: User,
    @Args('taskId', { type: () => ID }) taskId: string,
  ): Promise<Subtask[]> {
    return this.subtasksService.findByTask(user.id, taskId);
  }

  @Mutation(() => Subtask)
  createSubtask(
    @CurrentUser() user: User,
    @Args('input') input: CreateSubtaskInput,
  ): Promise<Subtask> {
    return this.subtasksService.create(user.id, input);
  }

  @Mutation(() => Subtask)
  updateSubtask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubtaskInput,
  ): Promise<Subtask> {
    return this.subtasksService.update(user.id, id, input);
  }

  @Mutation(() => Subtask)
  completeSubtask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Subtask> {
    return this.subtasksService.complete(user.id, id);
  }

  @Mutation(() => Subtask)
  reopenSubtask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Subtask> {
    return this.subtasksService.reopen(user.id, id);
  }

  @Mutation(() => Boolean)
  deleteSubtask(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.subtasksService.delete(user.id, id);
  }
}
