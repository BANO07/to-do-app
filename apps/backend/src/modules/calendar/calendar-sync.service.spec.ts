import { Test, TestingModule } from '@nestjs/testing';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarConnectionRepository } from './calendar-connection.repository';
import { CalendarEventRepository } from './calendar-event.repository';

const mockConnectionService = {
  getReadyClient: jest.fn(),
};

const mockConnectionRepo = {
  findActiveByUserId: jest.fn(),
  findAllActive: jest.fn(),
};

const mockEventRepo = {
  upsertEvent: jest.fn(),
  markCancelledByConnectionId: jest.fn(),
};

const mockOAuth2Client = {
  getAccessToken: jest.fn().mockResolvedValue({ token: 'test-access-token' }),
};

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: CalendarConnectionService, useValue: mockConnectionService },
        { provide: CalendarConnectionRepository, useValue: mockConnectionRepo },
        { provide: CalendarEventRepository, useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
  });

  describe('syncForUser', () => {
    it('should return failure when calendar not connected', async () => {
      mockConnectionService.getReadyClient.mockResolvedValue(null);

      const result = await service.syncForUser('user-1');
      expect(result.success).toBe(false);
      expect(result.eventsUpserted).toBe(0);
    });

    it('should return failure when no active connection found', async () => {
      mockConnectionService.getReadyClient.mockResolvedValue(mockOAuth2Client);
      mockConnectionRepo.findActiveByUserId.mockResolvedValue(null);

      const result = await service.syncForUser('user-1');
      expect(result.success).toBe(false);
    });

    it('should return failure gracefully when Google API call fails', async () => {
      mockConnectionService.getReadyClient.mockResolvedValue(mockOAuth2Client);
      mockConnectionRepo.findActiveByUserId.mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      });

      // Simulate fetch error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.syncForUser('user-1');
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it('should upsert events and return count on success', async () => {
      mockConnectionService.getReadyClient.mockResolvedValue(mockOAuth2Client);
      mockConnectionRepo.findActiveByUserId.mockResolvedValue({
        id: 'conn-1',
        userId: 'user-1',
      });
      mockEventRepo.upsertEvent.mockResolvedValue(undefined);
      mockEventRepo.markCancelledByConnectionId.mockResolvedValue(undefined);

      const googleEventsResponse = {
        items: [
          {
            id: 'evt-1',
            summary: 'Team Meeting',
            start: { dateTime: '2026-08-19T10:00:00Z', timeZone: 'UTC' },
            end: { dateTime: '2026-08-19T11:00:00Z', timeZone: 'UTC' },
            status: 'confirmed',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(googleEventsResponse),
      } as unknown as Response);

      const result = await service.syncForUser('user-1');
      expect(result.success).toBe(true);
      expect(result.eventsUpserted).toBe(1);
      expect(mockEventRepo.upsertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          connectionId: 'conn-1',
          providerEventId: 'evt-1',
          title: 'Team Meeting',
        }),
      );
    });

    it('should handle all-day events correctly', async () => {
      mockConnectionService.getReadyClient.mockResolvedValue(mockOAuth2Client);
      mockConnectionRepo.findActiveByUserId.mockResolvedValue({ id: 'conn-1', userId: 'user-1' });
      mockEventRepo.upsertEvent.mockResolvedValue(undefined);
      mockEventRepo.markCancelledByConnectionId.mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [
            {
              id: 'all-day-1',
              summary: 'Holiday',
              start: { date: '2026-08-19' },
              end: { date: '2026-08-20' },
              status: 'confirmed',
            },
          ],
        }),
      } as unknown as Response);

      await service.syncForUser('user-1');
      expect(mockEventRepo.upsertEvent).toHaveBeenCalledWith(
        expect.objectContaining({ isAllDay: true }),
      );
    });
  });
});
