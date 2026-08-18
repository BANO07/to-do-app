import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = {
    findById: jest.fn(),
    save: jest.fn(),
    upsertFromGoogle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  it('updates the authenticated user timezone', async () => {
    const user = { id: 'user-1', ianaTimezone: 'UTC' };
    usersRepository.findById.mockResolvedValue(user);
    usersRepository.save.mockImplementation(async (value) => value);

    const result = await service.updateTimezone('user-1', 'Asia/Kolkata');

    expect(result.ianaTimezone).toBe('Asia/Kolkata');
    expect(usersRepository.findById).toHaveBeenCalledWith('user-1');
  });

  it('rejects invalid timezone strings', async () => {
    await expect(service.updateTimezone('user-1', 'IST')).rejects.toThrow(
      BadRequestException,
    );
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('does not update another user when the id is missing', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(
      service.updateTimezone('user-1', 'Asia/Kolkata'),
    ).rejects.toThrow(NotFoundException);
  });
});
