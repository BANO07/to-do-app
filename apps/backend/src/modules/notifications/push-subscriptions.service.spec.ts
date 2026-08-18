import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PushSubscriptionsRepository } from './push-subscriptions.repository';
import { PushSubscriptionsService } from './push-subscriptions.service';

describe('PushSubscriptionsService', () => {
  let service: PushSubscriptionsService;

  const repository = {
    findByUserId: jest.fn(),
    findByIdForUser: jest.fn(),
    findByEndpoint: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSubscriptionsService,
        {
          provide: PushSubscriptionsRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PushSubscriptionsService);
    jest.clearAllMocks();
  });

  it('stores a new push subscription for the authenticated user', async () => {
    repository.findByEndpoint.mockResolvedValue(null);
    repository.create.mockImplementation((value) => value);
    repository.save.mockImplementation(async (value) => ({
      id: 'sub-1',
      ...value,
    }));

    const result = await service.saveForUser('user-a', {
      endpoint: 'https://example.test/sub',
      p256dh: 'p256dh',
      auth: 'auth',
    });

    expect(result.userId).toBe('user-a');
    expect(result.endpoint).toContain('example.test');
  });

  it('reuses the same users endpoint without creating a duplicate', async () => {
    repository.findByEndpoint.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-a',
      endpoint: 'https://example.test/sub',
      p256dh: 'old',
      auth: 'old',
    });
    repository.save.mockImplementation(async (value) => value);

    const result = await service.saveForUser('user-a', {
      endpoint: 'https://example.test/sub',
      p256dh: 'new-key',
      auth: 'new-auth',
    });

    expect(result.p256dh).toBe('new-key');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects cross-user endpoint reuse', async () => {
    repository.findByEndpoint.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-a',
      endpoint: 'https://example.test/sub',
      p256dh: 'old',
      auth: 'old',
    });

    await expect(
      service.saveForUser('user-b', {
        endpoint: 'https://example.test/sub',
        p256dh: 'new-key',
        auth: 'new-auth',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('does not let user A remove user B subscription', async () => {
    repository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.removeForUser('user-a', { id: 'sub-b' }),
    ).rejects.toThrow(NotFoundException);
  });
});
