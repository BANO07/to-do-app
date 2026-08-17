import { Category, CreateTaskInput, TaskPriority } from '../models/app.models';

export interface ParsedQuickAdd {
  title: string;
  priority?: TaskPriority;
  categoryId?: string;
  dueDate?: string;
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  low: 'LOW',
  medium: 'MEDIUM',
  med: 'MEDIUM',
  high: 'HIGH',
  urgent: 'URGENT',
};

export function parseQuickAdd(input: string, categories: Category[]): ParsedQuickAdd {
  let text = input.trim();
  if (!text) {
    return { title: '' };
  }

  let priority: TaskPriority | undefined;
  let categoryId: string | undefined;
  let dueDate: string | undefined;

  const priorityMatch = text.match(/!(low|medium|med|high|urgent)\b/i);
  if (priorityMatch) {
    priority = PRIORITY_MAP[priorityMatch[1].toLowerCase()];
    text = text.replace(priorityMatch[0], '').trim();
  }

  const categoryMatch = text.match(/@([\w\s-]+)/);
  if (categoryMatch) {
    const name = categoryMatch[1].trim().toLowerCase();
    const category = categories.find((c) => c.name.toLowerCase() === name);
    if (category) {
      categoryId = category.id;
    }
    text = text.replace(categoryMatch[0], '').trim();
  }

  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) {
    dueDate = endOfDay(new Date()).toISOString();
    text = text.replace(/\btoday\b/i, '').trim();
  } else if (/\btomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    dueDate = endOfDay(d).toISOString();
    text = text.replace(/\btomorrow\b/i, '').trim();
  }

  text = text.replace(/\s{2,}/g, ' ').trim();

  const result: ParsedQuickAdd = { title: text };
  if (priority) result.priority = priority;
  if (categoryId) result.categoryId = categoryId;
  if (dueDate) result.dueDate = dueDate;
  return result;
}

export function toCreateTaskInput(parsed: ParsedQuickAdd): CreateTaskInput {
  return {
    title: parsed.title,
    priority: parsed.priority ?? 'MEDIUM',
    categoryId: parsed.categoryId,
    dueDate: parsed.dueDate,
  };
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}
