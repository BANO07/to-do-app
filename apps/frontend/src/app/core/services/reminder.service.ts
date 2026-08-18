import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  CreateReminderInput,
  Reminder,
  UpdateReminderInput,
} from '../models/app.models';
import {
  CREATE_REMINDER_MUTATION,
  DELETE_REMINDER_MUTATION,
  REMINDERS_QUERY,
  UPDATE_REMINDER_MUTATION,
} from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly apollo = inject(Apollo);

  getReminders(taskId: string): Observable<Reminder[]> {
    return this.apollo
      .query<{ reminders: Reminder[] }>({
        query: REMINDERS_QUERY,
        variables: { taskId },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.reminders));
  }

  createReminder(input: CreateReminderInput): Observable<Reminder> {
    return this.apollo
      .mutate<{ createReminder: Reminder }>({
        mutation: CREATE_REMINDER_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.createReminder));
  }

  updateReminder(id: string, input: UpdateReminderInput): Observable<Reminder> {
    return this.apollo
      .mutate<{ updateReminder: Reminder }>({
        mutation: UPDATE_REMINDER_MUTATION,
        variables: { id, input },
      })
      .pipe(map(({ data }) => data!.updateReminder));
  }

  deleteReminder(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteReminder: boolean }>({
        mutation: DELETE_REMINDER_MUTATION,
        variables: { id },
      })
      .pipe(map(({ data }) => data!.deleteReminder));
  }
}
