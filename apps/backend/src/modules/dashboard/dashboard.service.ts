import { Injectable } from '@nestjs/common';
import { TasksRepository } from '../tasks/tasks.repository';
import { TasksService } from '../tasks/tasks.service';
import { DashboardSummary } from './dto/dashboard-summary.dto';
import { TaskListView } from '../../common/enums/task-list-view.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { TaskPriority } from '../../common/enums/task-priority.enum';

@Injectable()
export class DashboardService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly tasksService: TasksService,
  ) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const [todayResult, overdueResult, upcomingResult, completedToday, totalActive] =
      await Promise.all([
        this.tasksService.findAll(userId, {
          view: TaskListView.TODAY,
          limit: 100,
          page: 1,
        }),
        this.tasksService.findAll(userId, {
          view: TaskListView.OVERDUE,
          limit: 1,
          page: 1,
        }),
        this.tasksService.findAll(userId, {
          view: TaskListView.UPCOMING,
          limit: 1,
          page: 1,
        }),
        this.tasksRepository.countCompletedToday(userId),
        this.tasksRepository.countActiveByUser(userId),
      ]);

    const todayItems = todayResult.items;
    const todayCompleted = todayItems.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const todayPending = todayItems.filter(
      (t) =>
        t.status === TaskStatus.TODO || t.status === TaskStatus.IN_PROGRESS,
    ).length;
    const todayHighPriority = todayItems.filter(
      (t) =>
        (t.priority === TaskPriority.HIGH ||
          t.priority === TaskPriority.URGENT) &&
        t.status !== TaskStatus.COMPLETED,
    ).length;

    const totalToday = todayItems.length;
    const completionPercentage =
      totalToday === 0
        ? 0
        : Math.round((todayCompleted / totalToday) * 100);

    return {
      todayTotal: totalToday,
      todayCompleted,
      todayPending,
      todayHighPriority,
      overdueCount: overdueResult.pageInfo.total,
      upcomingCount: upcomingResult.pageInfo.total,
      completedTodayCount: completedToday,
      totalActiveTasks: totalActive,
      completionPercentage,
    };
  }
}
