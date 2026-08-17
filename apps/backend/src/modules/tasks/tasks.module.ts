import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';
import { TasksResolver } from './tasks.resolver';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), CategoriesModule],
  providers: [TasksRepository, TasksService, TasksResolver],
  exports: [TasksService, TasksRepository],
})
export class TasksModule {}
