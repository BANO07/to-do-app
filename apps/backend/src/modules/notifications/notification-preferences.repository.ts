import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';

@Injectable()
export class NotificationPreferencesRepository {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repository: Repository<NotificationPreference>,
  ) {}

  findByUserId(userId: string): Promise<NotificationPreference | null> {
    return this.repository.findOne({ where: { userId } });
  }

  create(data: Partial<NotificationPreference>): NotificationPreference {
    return this.repository.create(data);
  }

  save(preferences: NotificationPreference): Promise<NotificationPreference> {
    return this.repository.save(preferences);
  }
}
