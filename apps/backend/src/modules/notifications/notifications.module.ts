import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { Reminder } from '../tasks/entities/reminder.entity';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationsRepository } from './notifications.repository';
import { PushSubscriptionsRepository } from './push-subscriptions.repository';
import { ReminderDeliveryRepository } from './reminder-delivery.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { EMAIL_PROVIDER, PUSH_PROVIDER } from './notification.tokens';
import { NoopEmailProvider } from './providers/noop-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { NoopPushProvider } from './providers/noop-push.provider';
import { WebPushProvider } from './providers/web-push.provider';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { EmailNotificationChannel } from './channels/email-notification.channel';
import { PushNotificationChannel } from './channels/push-notification.channel';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      PushSubscriptionEntity,
      Reminder,
    ]),
  ],
  providers: [
    NotificationPreferencesRepository,
    NotificationsRepository,
    PushSubscriptionsRepository,
    ReminderDeliveryRepository,
    NotificationPreferencesService,
    PushSubscriptionsService,
    NotificationsService,
    NotificationsResolver,
    ReminderSchedulerService,
    InAppNotificationChannel,
    EmailNotificationChannel,
    PushNotificationChannel,
    NoopEmailProvider,
    ResendEmailProvider,
    NoopPushProvider,
    WebPushProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, ResendEmailProvider, NoopEmailProvider],
      useFactory: (
        configService: ConfigService,
        resendProvider: ResendEmailProvider,
        noopProvider: NoopEmailProvider,
      ) => {
        const provider = configService.get<string>('EMAIL_PROVIDER') ?? 'noop';
        return provider === 'resend' ? resendProvider : noopProvider;
      },
    },
    {
      provide: PUSH_PROVIDER,
      inject: [WebPushProvider, NoopPushProvider],
      useFactory: (
        webPushProvider: WebPushProvider,
        noopProvider: NoopPushProvider,
      ) => (webPushProvider.isAvailable() ? webPushProvider : noopProvider),
    },
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
