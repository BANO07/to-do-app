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
  const configGet = jest.fn();
  const configGetOrThrow = jest.fn();

  beforeEach(async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'development';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '7d';
      }
      return undefined;
    });
    configGetOrThrow.mockImplementation((key: string) => {
      if (key === 'FRONTEND_URL') {
        return 'http://localhost:4200';
      }
      if (key === 'BACKEND_URL') {
        return 'http://localhost:3000';
      }
      throw new Error(`missing ${key}`);
    });

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
            get: configGet,
            getOrThrow: configGetOrThrow,
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService.upsertFromGoogle.mockReset();
    usersService.findById.mockReset();
    categoriesService.seedDefaultsForUser.mockReset();
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

  it('sets a lax cookie for same-site local development', () => {
    const res = { cookie: jest.fn() };
    service.setAuthCookie(res as never, 'token');
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it('sets a host-only lax secure cookie in production', () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'production';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '7d';
      }
      return undefined;
    });
    configGetOrThrow.mockImplementation((key: string) => {
      if (key === 'FRONTEND_URL') {
        return 'https://to-do-app-frontend-flame.vercel.app';
      }
      if (key === 'BACKEND_URL') {
        return 'https://todo-app-api-kcr1.onrender.com';
      }
      throw new Error(`missing ${key}`);
    });

    const res = { cookie: jest.fn() };
    service.setAuthCookie(res as never, 'token');
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    const options = res.cookie.mock.calls[0][2];
    expect(options).not.toHaveProperty('domain');
  });

  it('redirects to the frontend dashboard after OAuth', () => {
    const res = { redirect: jest.fn() };
    service.redirectToApp(res as never);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:4200/dashboard');
  });
});
