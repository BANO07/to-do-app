import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PushSubscriptionsRepository } from './push-subscriptions.repository';
import {
  RemovePushSubscriptionInput,
  SavePushSubscriptionInput,
} from './dto/notification.dto';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';

@Injectable()
export class PushSubscriptionsService {
  constructor(
    private readonly subscriptionsRepository: PushSubscriptionsRepository,
  ) {}

  findForUser(userId: string): Promise<PushSubscriptionEntity[]> {
    return this.subscriptionsRepository.findByUserId(userId);
  }

  async saveForUser(
    userId: string,
    input: SavePushSubscriptionInput,
  ): Promise<PushSubscriptionEntity> {
    const existing = await this.subscriptionsRepository.findByEndpoint(
      input.endpoint,
    );

    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'Push subscription endpoint is already registered to another user',
      );
    }

    const subscription = existing
      ? Object.assign(existing, {
          p256dh: input.p256dh,
          auth: input.auth,
        })
      : this.subscriptionsRepository.create({
          userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        });

    return this.subscriptionsRepository.save(subscription);
  }

  async removeForUser(
    userId: string,
    input: RemovePushSubscriptionInput,
  ): Promise<boolean> {
    const subscription = await this.subscriptionsRepository.findByIdForUser(
      input.id,
      userId,
    );
    if (!subscription) {
      throw new NotFoundException('Push subscription not found');
    }

    await this.subscriptionsRepository.remove(subscription);
    return true;
  }
}
