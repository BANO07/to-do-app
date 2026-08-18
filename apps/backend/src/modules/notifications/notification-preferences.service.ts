import { Injectable } from '@nestjs/common';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { UpdateNotificationPreferencesInput } from './dto/notification.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly preferencesRepository: NotificationPreferencesRepository,
  ) {}

  async getForUser(userId: string): Promise<NotificationPreference> {
    const existing = await this.preferencesRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const created = this.preferencesRepository.create({
      userId,
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      reminderEnabled: true,
    });

    return this.preferencesRepository.save(created);
  }

  async updateForUser(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreference> {
    const preferences = await this.getForUser(userId);

    if (input.inAppEnabled != null) {
      preferences.inAppEnabled = input.inAppEnabled;
    }
    if (input.emailEnabled != null) {
      preferences.emailEnabled = input.emailEnabled;
    }
    if (input.pushEnabled != null) {
      preferences.pushEnabled = input.pushEnabled;
    }
    if (input.reminderEnabled != null) {
      preferences.reminderEnabled = input.reminderEnabled;
    }

    return this.preferencesRepository.save(preferences);
  }
}
