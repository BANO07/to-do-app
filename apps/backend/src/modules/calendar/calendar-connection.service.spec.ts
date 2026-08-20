import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarConnectionRepository } from './calendar-connection.repository';
import { CalendarConnectionStatus } from '../../common/enums/calendar-connection-status.enum';

const mockRepo = {
  findByUserId: jest.fn(),
  findActiveByUserId: jest.fn(),
  upsert: jest.fn(),
  updateTokens: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      BACKEND_URL: 'http://localhost:3000',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-aes',
    };
    return map[key];
  }),
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      BACKEND_URL: 'http://localhost:3000',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-aes',
    };
    if (!map[key]) throw new Error(`Missing ${key}`);
    return map[key];
  }),
};

describe('CalendarConnectionService', () => {
  let service: CalendarConnectionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarConnectionService,
        { provide: CalendarConnectionRepository, useValue: mockRepo },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<CalendarConnectionService>(CalendarConnectionService);
  });

  describe('getConnectionStatus', () => {
    it('should return connected=false when no connection exists', async () => {
      mockRepo.findByUserId.mockResolvedValue(null);
      const result = await service.getConnectionStatus('user-1');
      expect(result.connected).toBe(false);
    });

    it('should return connected=false when connection is REVOKED', async () => {
      mockRepo.findByUserId.mockResolvedValue({
        status: CalendarConnectionStatus.REVOKED,
        providerAccountId: 'test@example.com',
        connectedAt: new Date(),
      });
      const result = await service.getConnectionStatus('user-1');
      expect(result.connected).toBe(false);
    });

    it('should return connected=true with providerAccountId when ACTIVE', async () => {
      mockRepo.findByUserId.mockResolvedValue({
        status: CalendarConnectionStatus.ACTIVE,
        providerAccountId: 'user@example.com',
        connectedAt: new Date(),
      });
      const result = await service.getConnectionStatus('user-1');
      expect(result.connected).toBe(true);
      expect(result.providerAccountId).toBe('user@example.com');
    });
  });

  describe('disconnect', () => {
    it('should delete connection when it exists', async () => {
      // Stub a connection with encrypted token
      // We build a valid encrypted blob to avoid decryption failure
      const encService = service as unknown as {
        encrypt: (s: string) => string;
        decrypt: (s: string) => string;
      };
      const fakeToken = encService.encrypt('access-token-value');

      mockRepo.findByUserId.mockResolvedValue({
        id: 'conn-1',
        accessToken: fakeToken,
        userId: 'user-1',
      });

      // Mock fetch for revoke (global)
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await service.disconnect('user-1');
      expect(mockRepo.delete).toHaveBeenCalledWith('user-1');
    });

    it('should be a no-op when no connection exists', async () => {
      mockRepo.findByUserId.mockResolvedValue(null);
      await service.disconnect('user-1');
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('token encryption/decryption', () => {
    it('should encrypt and decrypt tokens correctly (round-trip)', () => {
      const encService = service as unknown as {
        encrypt: (s: string) => string;
        decrypt: (s: string) => string;
      };
      const original = 'my-secret-access-token-123';
      const encrypted = encService.encrypt(original);
      const decrypted = encService.decrypt(encrypted);
      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext each call (IV randomness)', () => {
      const encService = service as unknown as { encrypt: (s: string) => string };
      const t1 = encService.encrypt('same-token');
      const t2 = encService.encrypt('same-token');
      expect(t1).not.toBe(t2);
    });
  });

  describe('getAuthUrl', () => {
    it('should return a Google OAuth URL', () => {
      const url = service.getAuthUrl('test-state');
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('test-state');
      expect(url).toContain('calendar.readonly');
    });
  });
});
