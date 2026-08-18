import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { User } from '../users/entities/user.entity';
import {
  NotificationConnection,
  NotificationsInput,
  RemovePushSubscriptionInput,
  SavePushSubscriptionInput,
  UpdateNotificationPreferencesInput,
} from './dto/notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Resolver()
@UseGuards(GqlAuthGuard)
export class NotificationsResolver {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  @Query(() => NotificationConnection, { name: 'notifications' })
  notifications(
    @CurrentUser() user: User,
    @Args('filter', { nullable: true }) filter?: NotificationsInput,
  ): Promise<NotificationConnection> {
    return this.notificationsService.getNotificationsForUser(user.id, filter);
  }

  @Query(() => Int, { name: 'unreadNotificationCount' })
  unreadNotificationCount(@CurrentUser() user: User): Promise<number> {
    return this.notificationsService.getUnreadCountForUser(user.id);
  }

  @Query(() => NotificationPreference, { name: 'notificationPreferences' })
  notificationPreferences(
    @CurrentUser() user: User,
  ): Promise<NotificationPreference> {
    return this.notificationsService.getPreferencesForUser(user.id);
  }

  @Query(() => [PushSubscriptionEntity], { name: 'pushSubscriptions' })
  pushSubscriptions(
    @CurrentUser() user: User,
  ): Promise<PushSubscriptionEntity[]> {
    return this.pushSubscriptionsService.findForUser(user.id);
  }

  @Mutation(() => Notification)
  markNotificationRead(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Notification> {
    return this.notificationsService.markRead(user.id, id);
  }

  @Mutation(() => Boolean)
  markAllNotificationsRead(@CurrentUser() user: User): Promise<boolean> {
    return this.notificationsService.markAllRead(user.id);
  }

  @Mutation(() => NotificationPreference)
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Args('input') input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreference> {
    await this.preferencesService.updateForUser(user.id, input);
    return this.notificationsService.getPreferencesForUser(user.id);
  }

  @Mutation(() => PushSubscriptionEntity)
  savePushSubscription(
    @CurrentUser() user: User,
    @Args('input') input: SavePushSubscriptionInput,
  ): Promise<PushSubscriptionEntity> {
    return this.pushSubscriptionsService.saveForUser(user.id, input);
  }

  @Mutation(() => Boolean)
  removePushSubscription(
    @CurrentUser() user: User,
    @Args('input') input: RemovePushSubscriptionInput,
  ): Promise<boolean> {
    return this.pushSubscriptionsService.removeForUser(user.id, input);
  }
}
