import { Injectable } from '@nestjs/common';
import { TasksRepository } from '../tasks/tasks.repository';
import { TasksService } from '../tasks/tasks.service';
import { DashboardSummary } from './dto/dashboard-summary.dto';
import { TaskListView } from '../../common/enums/task-list-view.enum';
import {
  computeCompletionPercentage,
  DUE_TODAY_COMPLETED_STATUSES,
  DUE_TODAY_IN_PROGRESS_STATUSES,
  DUE_TODAY_OPEN_STATUSES,
} from './dashboard-metrics';

@Injectable()
export class DashboardService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly tasksService: TasksService,
  ) {}

  async getSummary(
    userId: string,
    timeZone?: string,
  ): Promise<DashboardSummary> {
    const tz = timeZone ?? 'UTC';
    const [
      todayOpen,
      todayInProgress,
      todayCompleted,
      todayHighPriority,
      overdueResult,
      upcomingResult,
      completedToday,
      totalActive,
    ] = await Promise.all([
      this.tasksRepository.countDueToday(userId, tz, DUE_TODAY_OPEN_STATUSES),
      this.tasksRepository.countDueToday(
        userId,
        tz,
        DUE_TODAY_IN_PROGRESS_STATUSES,
      ),
      this.tasksRepository.countDueToday(
        userId,
        tz,
        DUE_TODAY_COMPLETED_STATUSES,
      ),
      this.tasksRepository.countHighPriorityDueToday(userId, tz),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.OVERDUE, limit: 1, page: 1 },
        tz,
      ),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.UPCOMING, limit: 1, page: 1 },
        tz,
      ),
      this.tasksRepository.countCompletedToday(userId, tz),
      this.tasksRepository.countActiveByUser(userId),
    ]);

    const todayPending = todayOpen + todayInProgress;
    const todayTotal = todayOpen + todayInProgress + todayCompleted;
    const completionPercentage = computeCompletionPercentage(
      todayCompleted,
      todayTotal,
    );

    return {
      todayTotal,
      todayOpen,
      todayInProgress,
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
