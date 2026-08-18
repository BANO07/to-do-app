import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, map, of, switchMap } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationPreferences, PushSubscriptionRecord } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly notificationService = inject(NotificationService);

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  permissionState(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  enablePush(
    preferences: NotificationPreferences,
  ): Observable<PushSubscriptionRecord> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (!preferences.pushAvailable || !preferences.pushPublicKey) {
      throw new Error('Push notifications are not configured on the server');
    }

    return from(Notification.requestPermission()).pipe(
      switchMap((permission) => {
        if (permission !== 'granted') {
          throw new Error('Push permission was not granted');
        }

        return from(navigator.serviceWorker.register('/push-sw.js')).pipe(
          switchMap((registration) =>
            from(registration.pushManager.getSubscription()).pipe(
              switchMap((existing) =>
                existing
                  ? of(existing)
                  : from(
                      registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(
                          preferences.pushPublicKey!,
                        ),
                      }),
                    ),
              ),
            ),
          ),
          switchMap((subscription) =>
            this.notificationService.savePushSubscription({
              endpoint: subscription.endpoint,
              p256dh: subscription.toJSON().keys?.['p256dh'] ?? '',
              auth: subscription.toJSON().keys?.['auth'] ?? '',
            }),
          ),
          switchMap((record) =>
            this.notificationService
              .updateNotificationPreferences({ pushEnabled: true })
              .pipe(map(() => record)),
          ),
        );
      }),
    );
  }

  disablePush(existingSubscriptions: PushSubscriptionRecord[]): Observable<boolean> {
    if (!this.isSupported()) {
      return of(false);
    }

    return from(navigator.serviceWorker.getRegistration()).pipe(
      switchMap((registration) =>
        registration
          ? from(registration.pushManager.getSubscription()).pipe(
              switchMap((subscription) =>
                subscription ? from(subscription.unsubscribe()) : of(true),
              ),
            )
          : of(true),
      ),
      switchMap(() => navigator.serviceWorker.getRegistration()),
      switchMap((registration) =>
        registration ? from(registration.unregister()).pipe(map(() => true)) : of(true),
      ),
      switchMap(() => {
        if (existingSubscriptions.length === 0) {
          return this.notificationService.updateNotificationPreferences({
            pushEnabled: false,
          });
        }

        return forkJoin(
          existingSubscriptions.map((subscription) =>
            this.notificationService.removePushSubscription(subscription.id),
          ),
        ).pipe(
          switchMap(() =>
            this.notificationService.updateNotificationPreferences({
              pushEnabled: false,
            }),
          ),
        );
      }),
      map(() => true),
    );
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}
