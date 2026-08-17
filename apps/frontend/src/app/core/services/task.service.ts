import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  CreateTaskInput,
  DashboardSummary,
  Task,
  TaskConnection,
  TaskFilterInput,
  UpdateTaskInput,
} from '../models/app.models';
import {
  ARCHIVE_TASK_MUTATION,
  COMPLETE_TASK_MUTATION,
  CREATE_TASK_MUTATION,
  DASHBOARD_SUMMARY_QUERY,
  DELETE_TASK_MUTATION,
  REOPEN_TASK_MUTATION,
  TASKS_QUERY,
  UPDATE_TASK_MUTATION,
} from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly apollo = inject(Apollo);

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.apollo
      .query<{ dashboardSummary: DashboardSummary }>({
        query: DASHBOARD_SUMMARY_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.dashboardSummary));
  }

  getTasks(filter: TaskFilterInput = {}): Observable<TaskConnection> {
    return this.apollo
      .query<{ tasks: TaskConnection }>({
        query: TASKS_QUERY,
        variables: { filter },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.tasks));
  }

  createTask(input: CreateTaskInput): Observable<Task> {
    return this.apollo
      .mutate<{ createTask: Task }>({
        mutation: CREATE_TASK_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.createTask));
  }

  updateTask(id: string, input: UpdateTaskInput): Observable<Task> {
    return this.apollo
      .mutate<{ updateTask: Task }>({
        mutation: UPDATE_TASK_MUTATION,
        variables: { id, input },
      })
      .pipe(map(({ data }) => data!.updateTask));
  }

  completeTask(id: string): Observable<Task> {
    return this.apollo
      .mutate<{ completeTask: Task }>({
        mutation: COMPLETE_TASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.completeTask));
  }

  reopenTask(id: string): Observable<Task> {
    return this.apollo
      .mutate<{ reopenTask: Task }>({
        mutation: REOPEN_TASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.reopenTask));
  }

  archiveTask(id: string): Observable<Task> {
    return this.apollo
      .mutate<{ archiveTask: Task }>({
        mutation: ARCHIVE_TASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.archiveTask));
  }

  deleteTask(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteTask: boolean }>({
        mutation: DELETE_TASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.deleteTask));
  }
}
