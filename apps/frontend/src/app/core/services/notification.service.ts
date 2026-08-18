import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import {
  Notification,
  NotificationConnection,
  NotificationPreferences,
  NotificationsFilterInput,
  PushSubscriptionRecord,
  SavePushSubscriptionInput,
  UpdateNotificationPreferencesInput,
} from '../models/app.models';
import {
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_QUERY,
  NOTIFICATION_PREFERENCES_QUERY,
  PUSH_SUBSCRIPTIONS_QUERY,
  REMOVE_PUSH_SUBSCRIPTION_MUTATION,
  SAVE_PUSH_SUBSCRIPTION_MUTATION,
  UNREAD_NOTIFICATION_COUNT_QUERY,
  UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
} from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apollo = inject(Apollo);
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);

  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  getNotifications(
    filter: NotificationsFilterInput = { page: 1, limit: 10 },
  ): Observable<NotificationConnection> {
    return this.apollo
      .query<{ notifications: NotificationConnection }>({
        query: NOTIFICATIONS_QUERY,
        variables: { filter },
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.notifications));
  }

  refreshUnreadCount(): Observable<number> {
    return this.apollo
      .query<{ unreadNotificationCount: number }>({
        query: UNREAD_NOTIFICATION_COUNT_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map(({ data }) => data.unreadNotificationCount),
        tap((count) => this.unreadCountSubject.next(count)),
      );
  }

  markNotificationRead(id: string): Observable<Notification> {
    return this.apollo
      .mutate<{ markNotificationRead: Notification }>({
        mutation: MARK_NOTIFICATION_READ_MUTATION,
        variables: { id },
      })
      .pipe(
        map(({ data }) => data!.markNotificationRead),
        tap(() =>
          this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1)),
        ),
      );
  }

  markAllNotificationsRead(): Observable<boolean> {
    return this.apollo
      .mutate<{ markAllNotificationsRead: boolean }>({
        mutation: MARK_ALL_NOTIFICATIONS_READ_MUTATION,
      })
      .pipe(
        map(({ data }) => data!.markAllNotificationsRead),
        tap(() => this.unreadCountSubject.next(0)),
      );
  }

  getNotificationPreferences(): Observable<NotificationPreferences> {
    return this.apollo
      .query<{ notificationPreferences: NotificationPreferences }>({
        query: NOTIFICATION_PREFERENCES_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.notificationPreferences));
  }

  updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Observable<NotificationPreferences> {
    return this.apollo
      .mutate<{ updateNotificationPreferences: NotificationPreferences }>({
        mutation: UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.updateNotificationPreferences));
  }

  getPushSubscriptions(): Observable<PushSubscriptionRecord[]> {
    return this.apollo
      .query<{ pushSubscriptions: PushSubscriptionRecord[] }>({
        query: PUSH_SUBSCRIPTIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(map(({ data }) => data.pushSubscriptions));
  }

  savePushSubscription(
    input: SavePushSubscriptionInput,
  ): Observable<PushSubscriptionRecord> {
    return this.apollo
      .mutate<{ savePushSubscription: PushSubscriptionRecord }>({
        mutation: SAVE_PUSH_SUBSCRIPTION_MUTATION,
        variables: { input },
      })
      .pipe(map(({ data }) => data!.savePushSubscription));
  }

  removePushSubscription(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ removePushSubscription: boolean }>({
        mutation: REMOVE_PUSH_SUBSCRIPTION_MUTATION,
        variables: { input: { id } },
      })
      .pipe(map(({ data }) => data!.removePushSubscription));
  }
}
