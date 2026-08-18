import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  CreateSubtaskInput,
  Subtask,
  UpdateSubtaskInput,
} from '../models/app.models';
import {
  COMPLETE_SUBTASK_MUTATION,
  CREATE_SUBTASK_MUTATION,
  DELETE_SUBTASK_MUTATION,
  REOPEN_SUBTASK_MUTATION,
  SUBTASKS_QUERY,
  UPDATE_SUBTASK_MUTATION,
} from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class SubtaskService {
  private readonly apollo = inject(Apollo);

  getSubtasks(taskId: string): Observable<Subtask[]> {
    return this.apollo
      .query<{ subtasks: Subtask[] }>({
        query: SUBTASKS_QUERY,
        variables: { taskId },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.subtasks));
  }

  createSubtask(input: CreateSubtaskInput): Observable<Subtask> {
    return this.apollo
      .mutate<{ createSubtask: Subtask }>({
        mutation: CREATE_SUBTASK_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.createSubtask));
  }

  updateSubtask(id: string, input: UpdateSubtaskInput): Observable<Subtask> {
    return this.apollo
      .mutate<{ updateSubtask: Subtask }>({
        mutation: UPDATE_SUBTASK_MUTATION,
        variables: { id, input },
      })
      .pipe(map(({ data }) => data!.updateSubtask));
  }

  completeSubtask(id: string): Observable<Subtask> {
    return this.apollo
      .mutate<{ completeSubtask: Subtask }>({
        mutation: COMPLETE_SUBTASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.completeSubtask));
  }

  reopenSubtask(id: string): Observable<Subtask> {
    return this.apollo
      .mutate<{ reopenSubtask: Subtask }>({
        mutation: REOPEN_SUBTASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.reopenSubtask));
  }

  deleteSubtask(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteSubtask: boolean }>({
        mutation: DELETE_SUBTASK_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.deleteSubtask));
  }
}
