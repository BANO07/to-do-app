import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { Reminder } from './entities/reminder.entity';
import {
  CreateReminderInput,
  UpdateReminderInput,
} from './dto/reminder.inputs';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Reminder)
@UseGuards(GqlAuthGuard)
export class RemindersResolver {
  constructor(private readonly remindersService: RemindersService) {}

  @Query(() => [Reminder], { name: 'reminders' })
  reminders(
    @CurrentUser() user: User,
    @Args('taskId', { type: () => ID }) taskId: string,
  ): Promise<Reminder[]> {
    return this.remindersService.findByTask(user.id, taskId);
  }

  @Mutation(() => Reminder)
  createReminder(
    @CurrentUser() user: User,
    @Args('input') input: CreateReminderInput,
  ): Promise<Reminder> {
    return this.remindersService.create(user.id, input, user.ianaTimezone);
  }

  @Mutation(() => Reminder)
  updateReminder(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateReminderInput,
  ): Promise<Reminder> {
    return this.remindersService.update(
      user.id,
      id,
      input,
      user.ianaTimezone,
    );
  }

  @Mutation(() => Boolean)
  deleteReminder(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.remindersService.delete(user.id, id);
  }
}
