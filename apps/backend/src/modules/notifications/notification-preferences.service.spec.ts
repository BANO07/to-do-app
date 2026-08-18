import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationPreferencesService } from './notification-preferences.service';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  const repository = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: NotificationPreferencesRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(NotificationPreferencesService);
    jest.clearAllMocks();
  });

  it('creates safe defaults when preferences do not exist', async () => {
    repository.findByUserId.mockResolvedValue(null);
    repository.create.mockImplementation((value) => value);
    repository.save.mockImplementation(async (value) => ({
      id: 'pref-1',
      ...value,
    }));

    const result = await service.getForUser('user-1');

    expect(repository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      reminderEnabled: true,
    });
    expect(result.pushEnabled).toBe(false);
  });

  it('updates only the authenticated users preference record', async () => {
    repository.findByUserId.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      reminderEnabled: true,
    });
    repository.save.mockImplementation(async (value) => value);

    const result = await service.updateForUser('user-1', {
      emailEnabled: false,
      pushEnabled: true,
    });

    expect(result.userId).toBe('user-1');
    expect(result.emailEnabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
    expect(result.inAppEnabled).toBe(true);
  });
});
