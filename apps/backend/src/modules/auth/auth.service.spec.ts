import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    upsertFromGoogle: jest.fn(),
    findById: jest.fn(),
  };
  const categoriesService = {
    seedDefaultsForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: CategoriesService,
          useValue: categoriesService,
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('should create user from google profile and seed categories', async () => {
    usersService.upsertFromGoogle.mockResolvedValue({ id: 'user-1' });

    const user = await service.validateGoogleUser({
      googleId: 'google-1',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(user.id).toBe('user-1');
    expect(categoriesService.seedDefaultsForUser).toHaveBeenCalledWith('user-1');
  });

  it('should reject inactive users', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1', isActive: false });

    await expect(
      service.getUserFromPayload({ sub: 'user-1', email: 'test@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
