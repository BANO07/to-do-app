import { Injectable } from '@nestjs/common';
import { NotificationStatus } from '../../../common/enums/notification-status.enum';
import { NotificationsRepository } from '../notifications.repository';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class InAppNotificationChannel {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async deliver(notification: Notification): Promise<void> {
    if (notification.status !== NotificationStatus.SENT) {
      await this.notificationsRepository.markDeliveryResult(
        notification.id,
        NotificationStatus.SENT,
        new Date(),
        null,
      );
    }
  }
}
