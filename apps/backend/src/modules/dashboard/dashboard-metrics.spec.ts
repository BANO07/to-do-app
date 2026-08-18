import { TaskStatus } from '../../common/enums/task-status.enum';
import {
  COMPLETION_RATE_DENOMINATOR_STATUSES,
  computeCompletionPercentage,
  DUE_TODAY_COMPLETED_STATUSES,
  DUE_TODAY_IN_PROGRESS_STATUSES,
  DUE_TODAY_OPEN_STATUSES,
} from './dashboard-metrics';

describe('computeCompletionPercentage', () => {
  it('returns 0% for one OPEN task due today', () => {
    expect(computeCompletionPercentage(0, 1)).toBe(0);
  });

  it('returns 0% for one IN_PROGRESS task due today', () => {
    expect(computeCompletionPercentage(0, 1)).toBe(0);
  });

  it('returns 100% for one COMPLETED task due today', () => {
    expect(computeCompletionPercentage(1, 1)).toBe(100);
  });

  it('returns 33% for 1 OPEN + 1 IN_PROGRESS + 1 COMPLETED', () => {
    expect(computeCompletionPercentage(1, 3)).toBe(33);
  });

  it('returns 50% for 1 COMPLETED + 1 IN_PROGRESS', () => {
    expect(computeCompletionPercentage(1, 2)).toBe(50);
  });

  it('excludes ARCHIVED from the denominator (1 COMPLETED + 1 ARCHIVED → 100%)', () => {
    expect(computeCompletionPercentage(1, 1)).toBe(100);
  });

  it('returns 0 as an API placeholder when there are no eligible tasks', () => {
    expect(computeCompletionPercentage(0, 0)).toBe(0);
  });

  it('does not treat IN_PROGRESS as completed', () => {
    expect(DUE_TODAY_COMPLETED_STATUSES).toEqual([TaskStatus.COMPLETED]);
    expect(DUE_TODAY_IN_PROGRESS_STATUSES).toEqual([TaskStatus.IN_PROGRESS]);
    expect(COMPLETION_RATE_DENOMINATOR_STATUSES).toEqual([
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
    ]);
    expect(COMPLETION_RATE_DENOMINATOR_STATUSES).not.toContain(
      TaskStatus.ARCHIVED,
    );
    expect(DUE_TODAY_OPEN_STATUSES).toEqual([TaskStatus.TODO]);
  });
});
