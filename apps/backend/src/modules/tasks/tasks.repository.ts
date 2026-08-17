import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskFilterInput } from './dto/task.inputs';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { TaskSortField } from '../../common/enums/task-sort-field.enum';
import { SortOrder } from '../../common/enums/sort-order.enum';
import { TaskListView } from '../../common/enums/task-list-view.enum';
import { TaskPriority } from '../../common/enums/task-priority.enum';

export interface TaskQueryResult {
  items: Task[];
  total: number;
}

@Injectable()
export class TasksRepository {
  constructor(
    @InjectRepository(Task)
    private readonly repository: Repository<Task>,
  ) {}

  findByIdForUser(id: string, userId: string): Promise<Task | null> {
    return this.repository.findOne({
      where: { id, userId },
      relations: ['category'],
    });
  }

  create(data: Partial<Task>): Task {
    return this.repository.create(data);
  }

  save(task: Task): Promise<Task> {
    return this.repository.save(task);
  }

  async remove(task: Task): Promise<void> {
    await this.repository.remove(task);
  }

  async findWithFilters(
    userId: string,
    filter: TaskFilterInput,
  ): Promise<TaskQueryResult> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.category', 'category')
      .where('task.userId = :userId', { userId });

    this.applyFilters(qb, filter);

    const sortColumn = this.getSortColumn(filter.sortBy);
    const sortOrder = filter.sortOrder ?? SortOrder.DESC;
    qb.orderBy(sortColumn, sortOrder);

    if (filter.sortBy === TaskSortField.PRIORITY) {
      qb.addOrderBy('task.createdAt', 'DESC');
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { items, total };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Task>,
    filter: TaskFilterInput,
  ): void {
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('task.title ILIKE :term', { term })
            .orWhere('task.description ILIKE :term', { term });
        }),
      );
    }

    if (filter.status) {
      qb.andWhere('task.status = :status', { status: filter.status });
    }

    if (filter.priority) {
      qb.andWhere('task.priority = :priority', { priority: filter.priority });
    }

    if (filter.categoryId) {
      qb.andWhere('task.categoryId = :categoryId', {
        categoryId: filter.categoryId,
      });
    }

    if (filter.view) {
      this.applyViewFilter(qb, filter.view);
    }
  }

  private applyViewFilter(
    qb: SelectQueryBuilder<Task>,
    view: TaskListView,
  ): void {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    switch (view) {
      case TaskListView.TODAY:
        qb.andWhere('task.status IN (:...statuses)', {
          statuses: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        }).andWhere('task.dueDate BETWEEN :start AND :end', {
          start: startOfDay,
          end: endOfDay,
        });
        break;
      case TaskListView.UPCOMING:
        qb.andWhere('task.status IN (:...statuses)', {
          statuses: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        }).andWhere('task.dueDate > :end', { end: endOfDay });
        break;
      case TaskListView.OVERDUE:
        qb.andWhere('task.status IN (:...statuses)', {
          statuses: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        }).andWhere('task.dueDate < :start', { start: startOfDay });
        break;
      case TaskListView.COMPLETED:
        qb.andWhere('task.status = :status', {
          status: TaskStatus.COMPLETED,
        });
        break;
      case TaskListView.ARCHIVED:
        qb.andWhere('task.status = :status', {
          status: TaskStatus.ARCHIVED,
        });
        break;
      case TaskListView.ALL:
      default:
        qb.andWhere('task.status != :archived', {
          archived: TaskStatus.ARCHIVED,
        });
        break;
    }
  }

  private getSortColumn(sortBy?: TaskSortField): string {
    switch (sortBy) {
      case TaskSortField.DUE_DATE:
        return 'task.dueDate';
      case TaskSortField.PRIORITY:
        return `CASE task.priority WHEN '${TaskPriority.URGENT}' THEN 1 WHEN '${TaskPriority.HIGH}' THEN 2 WHEN '${TaskPriority.MEDIUM}' THEN 3 ELSE 4 END`;
      case TaskSortField.UPDATED_AT:
        return 'task.updatedAt';
      case TaskSortField.CREATED_AT:
      default:
        return 'task.createdAt';
    }
  }

  countActiveByUser(userId: string): Promise<number> {
    return this.repository.count({
      where: [
        { userId, status: TaskStatus.TODO },
        { userId, status: TaskStatus.IN_PROGRESS },
      ],
    });
  }

  countCompletedToday(userId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.repository
      .createQueryBuilder('task')
      .where('task.userId = :userId', { userId })
      .andWhere('task.status = :status', { status: TaskStatus.COMPLETED })
      .andWhere('task.completedAt BETWEEN :start AND :end', { start, end })
      .getCount();
  }
}
