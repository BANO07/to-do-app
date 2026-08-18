import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';
import { NotificationsRepository } from './notifications.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { EmailNotificationChannel } from './channels/email-notification.channel';
import { PushNotificationChannel } from './channels/push-notification.channel';
import { ReminderDeliveryRepository } from './reminder-delivery.repository';
import { EMAIL_PROVIDER, PUSH_PROVIDER } from './notification.tokens';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const notificationsRepository = {
    findInboxForUser: jest.fn(),
    countUnreadInbox: jest.fn(),
    findInboxNotificationForUser: jest.fn(),
    save: jest.fn(),
  };
  const preferencesService = {
    getForUser: jest.fn(),
  };
  const subscriptionsService = {
    findForUser: jest.fn(),
  };
  const reminderDeliveryRepository = {
    claimDueBatch: jest.fn(),
    findEligibleLockedById: jest.fn(),
  };
  const inAppChannel = {};
  const emailChannel = {
    isAvailable: jest.fn(),
    deliver: jest.fn(),
  };
  const pushChannel = {
    isAvailable: jest.fn(),
    deliver: jest.fn(),
    getPublicKey: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('https://frontend.example'),
  };
  const emailProvider = {
    isAvailable: jest.fn().mockReturnValue(true),
  };
  const pushProvider = {
    isAvailable: jest.fn().mockReturnValue(true),
    getPublicKey: jest.fn().mockReturnValue('public-key'),
  };

  let queryRunner: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn(),
        getRepository: jest.fn(),
        save: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: notificationsRepository },
        {
          provide: NotificationPreferencesService,
          useValue: preferencesService,
        },
        { provide: PushSubscriptionsService, useValue: subscriptionsService },
        {
          provide: ReminderDeliveryRepository,
          useValue: reminderDeliveryRepository,
        },
        { provide: InAppNotificationChannel, useValue: inAppChannel },
        { provide: EmailNotificationChannel, useValue: emailChannel },
        { provide: PushNotificationChannel, useValue: pushChannel },
        { provide: ConfigService, useValue: configService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => queryRunner),
          },
        },
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
        { provide: PUSH_PROVIDER, useValue: pushProvider },
      ],
    }).compile();

    service = module.get(NotificationsService);
    jest.clearAllMocks();
  });

  it('does not let user A mark user B notification as read', async () => {
    notificationsRepository.findInboxNotificationForUser.mockResolvedValue(null);

    await expect(service.markRead('user-a', 'notif-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns unread count for the authenticated user inbox', async () => {
    notificationsRepository.countUnreadInbox.mockResolvedValue(3);

    await expect(service.getUnreadCountForUser('user-a')).resolves.toBe(3);
  });

  it('decorates notification preferences with channel availability', async () => {
    preferencesService.getForUser.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-a',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      reminderEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getPreferencesForUser('user-a');

    expect(result.pushAvailable).toBe(true);
    expect(result.emailAvailable).toBe(true);
    expect(result.pushPublicKey).toBe('public-key');
  });

  it('processes each due reminder and continues when one fails', async () => {
    reminderDeliveryRepository.claimDueBatch.mockResolvedValue([
      { id: 'rem-1' },
      { id: 'rem-2' },
    ]);
    const processReminder = jest
      .spyOn<any, any>(service as any, 'processReminder')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));

    await service.processDueReminders();

    expect(processReminder).toHaveBeenCalledTimes(2);
  });

  it('creates an in-app notification and sets sentAt on success', async () => {
    const reminder = buildReminder(ReminderChannel.IN_APP);
    setupReminderProcessing(
      queryRunner,
      reminderDeliveryRepository,
      reminder,
      null,
    );

    await (service as any).processReminder(reminder.id);

    const savedNotification = queryRunner.manager.getRepository().save.mock.calls[1][0];
    expect(savedNotification.status).toBe(NotificationStatus.SENT);
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: reminder.id, sentAt: expect.any(Date) }),
    );
  });

  it('does not process a stale or ineligible reminder after the locked recheck', async () => {
    reminderDeliveryRepository.findEligibleLockedById.mockResolvedValue(null);

    await (service as any).processReminder('rem-stale');

    expect(queryRunner.manager.getRepository).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
  });

  it('marks failed email delivery as retryable and leaves sentAt null', async () => {
    const reminder = buildReminder(ReminderChannel.EMAIL);
    setupReminderProcessing(
      queryRunner,
      reminderDeliveryRepository,
      reminder,
      null,
    );
    emailChannel.isAvailable.mockReturnValue(true);
    emailChannel.deliver.mockRejectedValue(new Error('smtp down'));

    await (service as any).processReminder(reminder.id);

    const savedNotification = queryRunner.manager.getRepository().save.mock.calls.at(-1)[0];
    expect(savedNotification.status).toBe(NotificationStatus.FAILED);
    expect(savedNotification.lastError).toContain('smtp down');
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: reminder.id, sentAt: null }),
    );
  });

  it('does not duplicate a previously sent notification', async () => {
    const reminder = buildReminder(ReminderChannel.EMAIL);
    setupReminderProcessing(queryRunner, reminderDeliveryRepository, reminder, {
      id: 'notif-1',
      idempotencyKey: `reminder:${reminder.id}:${reminder.channel}`,
      status: NotificationStatus.SENT,
      deliveredAt: new Date('2026-08-18T10:00:00.000Z'),
    });

    await (service as any).processReminder(reminder.id);

    expect(emailChannel.deliver).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: reminder.id,
        sentAt: new Date('2026-08-18T10:00:00.000Z'),
      }),
    );
  });

  it('uses the users timezone in reminder messaging', async () => {
    const reminder = buildReminder(ReminderChannel.EMAIL, 'Asia/Kolkata');
    const message = (service as any).buildReminderMessage(reminder);

    expect(message).toContain('15 Aug 2026');
    expect(message).toContain('3:30 pm');
  });

  it('only processes newer eligible reminders returned by claimDueBatch', async () => {
    reminderDeliveryRepository.claimDueBatch.mockResolvedValue([{ id: 'rem-new' }]);
    const processReminder = jest
      .spyOn<any, any>(service as any, 'processReminder')
      .mockResolvedValue(undefined);

    await service.processDueReminders();

    expect(processReminder).toHaveBeenCalledWith('rem-new');
  });
});

function buildReminder(channel: ReminderChannel, timezone = 'UTC') {
  return {
    id: 'rem-1',
    userId: 'user-a',
    taskId: 'task-1',
    fireAt: new Date('2026-08-15T10:00:00.000Z'),
    sentAt: null,
    channel,
    user: {
      id: 'user-a',
      email: 'user@example.com',
      ianaTimezone: timezone,
      isActive: true,
    },
    task: {
      id: 'task-1',
      title: 'Finish Phase C',
    },
  };
}

function setupReminderProcessing(
  queryRunner: any,
  reminderDeliveryRepository: any,
  reminder: any,
  existingNotification: any,
) {
  const notificationRepo = {
    findOne: jest.fn().mockResolvedValue(existingNotification),
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
  };

  queryRunner.manager.getRepository.mockReturnValue(notificationRepo);
  queryRunner.manager.save.mockImplementation(async (value: any) => value);
  reminderDeliveryRepository.findEligibleLockedById.mockResolvedValue(reminder);
}
