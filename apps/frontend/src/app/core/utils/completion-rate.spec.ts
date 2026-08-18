import { formatCompletionRate } from './completion-rate';

describe('formatCompletionRate', () => {
  it('shows 0% when one in-progress task is due today', () => {
    expect(formatCompletionRate(1, 0)).toEqual({
      value: '0%',
      hint: 'completed due today / total active due today',
    });
  });

  it('shows 50% when one completed and one in-progress task are due today', () => {
    expect(formatCompletionRate(2, 50).value).toBe('50%');
  });

  it('shows 100% when all eligible tasks due today are completed', () => {
    expect(formatCompletionRate(1, 100).value).toBe('100%');
  });

  it('shows an em dash when there are no eligible tasks due today', () => {
    expect(formatCompletionRate(0, 0)).toEqual({
      value: '—',
      hint: 'No tasks due today',
    });
  });
});
