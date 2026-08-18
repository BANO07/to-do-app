import { RecurrenceFrequency } from '../enums/recurrence-frequency.enum';
import { addDaysYmd, compareYmd } from './date-time.util';

export interface RecurrenceSpec {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  endDate?: string | null;
}

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

function weekdayOfYmd(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addMonthsYmd(ymd: string, months: number, dayOfMonth?: number | null): string {
  const { year, month, day } = parseYmd(ymd);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const desiredDay = dayOfMonth ?? day;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clamped = Math.min(desiredDay, lastDay);
  const utc = new Date(Date.UTC(targetYear, normalizedMonth, clamped));
  return utc.toISOString().slice(0, 10);
}

function addYearsYmd(ymd: string, years: number): string {
  return addMonthsYmd(ymd, years * 12);
}

function nextWeekdayFrom(ymd: string, allowed: number[]): string {
  const unique = [...new Set(allowed)].sort((a, b) => a - b);
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = addDaysYmd(ymd, offset);
    if (unique.includes(weekdayOfYmd(candidate))) {
      return candidate;
    }
  }
  return addDaysYmd(ymd, 1);
}

/**
 * Returns the next occurrence date strictly after `fromYmd`, or null if past endDate.
 * Dates are calendar YYYY-MM-DD strings (timezone-independent civil dates).
 */
export function nextOccurrenceDate(fromYmd: string, spec: RecurrenceSpec): string | null {
  const interval = Math.max(1, spec.interval || 1);
  let next: string;

  switch (spec.frequency) {
    case RecurrenceFrequency.DAILY:
      next = addDaysYmd(fromYmd, interval);
      break;
    case RecurrenceFrequency.WEEKDAYS:
      next = nextWeekdayFrom(fromYmd, [1, 2, 3, 4, 5]);
      break;
    case RecurrenceFrequency.WEEKLY:
      next = addDaysYmd(fromYmd, 7 * interval);
      break;
    case RecurrenceFrequency.BIWEEKLY:
      next = addDaysYmd(fromYmd, 14);
      break;
    case RecurrenceFrequency.MONTHLY:
      next = addMonthsYmd(fromYmd, interval, spec.dayOfMonth);
      break;
    case RecurrenceFrequency.YEARLY:
      next = addYearsYmd(fromYmd, interval);
      break;
    case RecurrenceFrequency.CUSTOM:
      if (spec.daysOfWeek && spec.daysOfWeek.length > 0) {
        next = nextWeekdayFrom(fromYmd, spec.daysOfWeek);
        if (interval > 1 && weekdayOfYmd(next) <= weekdayOfYmd(fromYmd)) {
          next = addDaysYmd(next, 7 * (interval - 1));
        }
      } else {
        next = addDaysYmd(fromYmd, interval);
      }
      break;
    default:
      next = addDaysYmd(fromYmd, interval);
  }

  if (spec.endDate && compareYmd(next, spec.endDate) > 0) {
    return null;
  }

  return next;
}
