export const COMPLETION_RATE_HELP =
  'Completion rate = completed tasks due today ÷ total active tasks due today.';

export function formatCompletionRate(
  todayTotal: number,
  completionPercentage: number,
): { value: string; hint: string } {
  if (todayTotal === 0) {
    return { value: '—', hint: 'No tasks due today' };
  }
  return {
    value: `${completionPercentage}%`,
    hint: 'completed due today / total active due today',
  };
}
