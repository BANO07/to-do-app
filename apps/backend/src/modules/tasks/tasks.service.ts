import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { CategoriesService } from '../categories/categories.service';
import { Task } from './entities/task.entity';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilterInput,
} from './dto/task.inputs';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { TaskConnection } from '../../common/dto/task-connection.dto';
import { PageInfo } from '../../common/dto/page-info.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(userId: string, filter: TaskFilterInput): Promise<TaskConnection> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const { items, total } = await this.tasksRepository.findWithFilters(
      userId,
      filter,
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const pageInfo: PageInfo = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return { items, pageInfo };
  }

  async findById(userId: string, id: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    if (input.categoryId) {
      await this.categoriesService.findById(userId, input.categoryId);
    }

    const task = this.tasksRepository.create({
      ...input,
      userId,
      status: TaskStatus.TODO,
    });

    return this.tasksRepository.save(task);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTaskInput,
  ): Promise<Task> {
    const task = await this.findById(userId, id);

    if (input.categoryId) {
      await this.categoriesService.findById(userId, input.categoryId);
    }

    if (input.status === TaskStatus.COMPLETED && !task.completedAt) {
      task.completedAt = new Date();
    }

    if (
      input.status &&
      input.status !== TaskStatus.COMPLETED &&
      task.status === TaskStatus.COMPLETED
    ) {
      task.completedAt = null;
    }

    Object.assign(task, input);
    return this.tasksRepository.save(task);
  }

  async complete(userId: string, id: string): Promise<Task> {
    const task = await this.findById(userId, id);
    if (task.status === TaskStatus.COMPLETED) {
      return task;
    }
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    return this.tasksRepository.save(task);
  }

  async reopen(userId: string, id: string): Promise<Task> {
    const task = await this.findById(userId, id);
    if (task.status !== TaskStatus.COMPLETED) {
      throw new BadRequestException('Only completed tasks can be reopened');
    }
    task.status = TaskStatus.TODO;
    task.completedAt = null;
    return this.tasksRepository.save(task);
  }

  async archive(userId: string, id: string): Promise<Task> {
    const task = await this.findById(userId, id);
    task.status = TaskStatus.ARCHIVED;
    return this.tasksRepository.save(task);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const task = await this.findById(userId, id);
    await this.tasksRepository.remove(task);
    return true;
  }
}
