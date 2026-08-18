import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Subtask } from './entities/subtask.entity';
import { Reminder } from './entities/reminder.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { TasksRepository } from './tasks.repository';
import { SubtasksRepository } from './subtasks.repository';
import { RemindersRepository } from './reminders.repository';
import { RecurrenceRulesRepository } from './recurrence-rules.repository';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { RemindersService } from './reminders.service';
import { TasksResolver } from './tasks.resolver';
import { SubtasksResolver } from './subtasks.resolver';
import { RemindersResolver } from './reminders.resolver';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Subtask, Reminder, RecurrenceRule]),
    CategoriesModule,
  ],
  providers: [
    TasksRepository,
    SubtasksRepository,
    RemindersRepository,
    RecurrenceRulesRepository,
    TasksService,
    SubtasksService,
    RemindersService,
    TasksResolver,
    SubtasksResolver,
    RemindersResolver,
  ],
  exports: [TasksService, TasksRepository],
})
export class TasksModule {}
