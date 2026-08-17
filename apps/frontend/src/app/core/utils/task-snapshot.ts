import { CreateTaskInput, Task, TaskPriority } from '../models/app.models';

export interface TaskSnapshot {
  title: string;
  description?: string;
  priority: TaskPriority;
  categoryId?: string;
  dueDate?: string;
}

export function snapshotFromTask(task: Task): TaskSnapshot {
  return {
    title: task.title,
    description: task.description ?? undefined,
    priority: task.priority,
    categoryId: task.category?.id,
    dueDate: task.dueDate ?? undefined,
  };
}

export function snapshotToCreateInput(snapshot: TaskSnapshot): CreateTaskInput {
  return {
    title: snapshot.title,
    description: snapshot.description,
    priority: snapshot.priority,
    categoryId: snapshot.categoryId,
    dueDate: snapshot.dueDate,
  };
}
