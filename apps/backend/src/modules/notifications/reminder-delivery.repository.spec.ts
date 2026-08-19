import { ReminderDeliveryRepository } from './reminder-delivery.repository';
import { Reminder } from '../tasks/entities/reminder.entity';

describe('ReminderDeliveryRepository', () => {
  const builder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const repository = {
    createQueryBuilder: jest.fn(() => builder),
  } as any;

  const entityManager = {
    getRepository: jest.fn(() => repository),
  } as any;

  let reminderDeliveryRepository: ReminderDeliveryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    reminderDeliveryRepository = new ReminderDeliveryRepository(repository);
  });

  it('excludes currently disabled selected channels from the due batch query', async () => {
    await reminderDeliveryRepository.claimDueBatch(new Date(), 20);

    expect(builder.leftJoin).toHaveBeenCalled();
    expect(builder.andWhere).toHaveBeenCalledWith(
      'COALESCE(preferences.reminder_enabled, true) = true',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(expect.any(Object));
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(builder.setLock).not.toHaveBeenCalled();
  });

  it('locks only the reminder row for the authoritative processing check', async () => {
    await reminderDeliveryRepository.findLockedPendingById(
      entityManager,
      'rem-1',
      new Date(),
    );

    expect(entityManager.getRepository).toHaveBeenCalledWith(Reminder);
    expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(builder.setOnLocked).toHaveBeenCalledWith('skip_locked');
    expect(builder.leftJoinAndSelect).not.toHaveBeenCalled();
    expect(builder.leftJoin).not.toHaveBeenCalled();
  });

  it('loads reminder relations in a separate eligibility query without locking joined tables', async () => {
    await reminderDeliveryRepository.findEligibleById(
      entityManager,
      'rem-1',
      new Date(),
    );

    expect(entityManager.getRepository).toHaveBeenCalledWith(Reminder);
    expect(builder.leftJoinAndSelect).toHaveBeenCalledWith('reminder.task', 'task');
    expect(builder.leftJoinAndSelect).toHaveBeenCalledWith('reminder.user', 'user');
    expect(builder.leftJoin).toHaveBeenCalled();
    expect(builder.setLock).not.toHaveBeenCalled();
  });
});
