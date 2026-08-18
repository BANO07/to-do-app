import { Inject, Injectable } from '@nestjs/common';
import { PUSH_PROVIDER } from '../notification.tokens';
import { PushProvider } from '../providers/push-provider.interface';
import { Notification } from '../entities/notification.entity';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';

@Injectable()
export class PushNotificationChannel {
  constructor(
    @Inject(PUSH_PROVIDER)
    private readonly pushProvider: PushProvider,
  ) {}

  isAvailable(): boolean {
    return this.pushProvider.isAvailable();
  }

  getPublicKey(): string | null {
    return this.pushProvider.getPublicKey();
  }

  async deliver(
    notification: Notification,
    subscription: PushSubscriptionEntity,
    url?: string,
  ): Promise<void> {
    await this.pushProvider.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      {
        title: notification.title,
        body: notification.message,
        url,
      },
    );
  }
}
