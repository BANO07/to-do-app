import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subtask } from './entities/subtask.entity';
import { SubtaskStatus } from '../../common/enums/subtask-status.enum';
import { TaskProgress } from './dto/task-progress.dto';

@Injectable()
export class SubtasksRepository {
  constructor(
    @InjectRepository(Subtask)
    private readonly repository: Repository<Subtask>,
  ) {}

  findByTaskForUser(taskId: string, userId: string): Promise<Subtask[]> {
    return this.repository.find({
      where: { taskId, userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Subtask | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  create(data: Partial<Subtask>): Subtask {
    return this.repository.create(data);
  }

  save(subtask: Subtask): Promise<Subtask> {
    return this.repository.save(subtask);
  }

  async remove(subtask: Subtask): Promise<void> {
    await this.repository.remove(subtask);
  }

  async nextPosition(taskId: string, userId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('subtask')
      .select('MAX(subtask.position)', 'max')
      .where('subtask.taskId = :taskId', { taskId })
      .andWhere('subtask.userId = :userId', { userId })
      .getRawOne<{ max: number | string | null }>();

    return Number(result?.max ?? -1) + 1;
  }

  async aggregateProgress(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, TaskProgress>> {
    const progress = new Map<string, TaskProgress>();
    if (taskIds.length === 0) {
      return progress;
    }

    const rows = await this.repository
      .createQueryBuilder('subtask')
      .select('subtask.taskId', 'taskId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN subtask.status = :completed THEN 1 ELSE 0 END)`,
        'completed',
      )
      .where('subtask.userId = :userId', { userId })
      .andWhere('subtask.taskId IN (:...taskIds)', { taskIds })
      .setParameter('completed', SubtaskStatus.COMPLETED)
      .groupBy('subtask.taskId')
      .getRawMany<{ taskId: string; total: string; completed: string }>();

    for (const row of rows) {
      const total = Number(row.total);
      const completed = Number(row.completed);
      progress.set(row.taskId, {
        total,
        completed,
        percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      });
    }

    return progress;
  }
}
