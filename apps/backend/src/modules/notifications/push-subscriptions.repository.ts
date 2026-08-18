import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';

@Injectable()
export class PushSubscriptionsRepository {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repository: Repository<PushSubscriptionEntity>,
  ) {}

  findByUserId(userId: string): Promise<PushSubscriptionEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<PushSubscriptionEntity | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  findByEndpoint(endpoint: string): Promise<PushSubscriptionEntity | null> {
    return this.repository.findOne({ where: { endpoint } });
  }

  create(data: Partial<PushSubscriptionEntity>): PushSubscriptionEntity {
    return this.repository.create(data);
  }

  save(
    subscription: PushSubscriptionEntity,
  ): Promise<PushSubscriptionEntity> {
    return this.repository.save(subscription);
  }

  async remove(subscription: PushSubscriptionEntity): Promise<void> {
    await this.repository.remove(subscription);
  }
}
