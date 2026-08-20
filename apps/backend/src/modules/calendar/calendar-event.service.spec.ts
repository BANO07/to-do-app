import { Test, TestingModule } from '@nestjs/testing';
import { CalendarEventService } from './calendar-event.service';
import { CalendarEventRepository } from './calendar-event.repository';
import { CalendarEventStatus } from '../../common/enums/calendar-event-status.enum';

const mockRepo = {
  findByDateRange: jest.fn(),
  findUpcoming: jest.fn(),
  countInRange: jest.fn(),
};

const makeEvent = (id: string, start: Date, end: Date) => ({
  id,
  userId: 'user-1',
  connectionId: 'conn-1',
  providerEventId: `evt-${id}`,
  calendarId: 'primary',
  title: `Event ${id}`,
  description: null,
  startAt: start,
  endAt: end,
  isAllDay: false,
  timezone: 'America/New_York',
  location: null,
  status: CalendarEventStatus.CONFIRMED,
  recurrenceId: null,
  syncedAt: new Date(),
});

describe('CalendarEventService', () => {
  let service: CalendarEventService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarEventService,
        { provide: CalendarEventRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CalendarEventService>(CalendarEventService);
  });

  describe('getEvents', () => {
    it('should return events filtered by date range for the authenticated user', async () => {
      const now = new Date();
      const event = makeEvent('1', now, new Date(now.getTime() + 3600_000));
      mockRepo.findByDateRange.mockResolvedValue([event]);

      const result = await service.getEvents('user-1', '2026-08-01', '2026-08-31');
      expect(result).toHaveLength(1);
      expect(mockRepo.findByDateRange).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should pass userId from service to repository (ownership enforced)', async () => {
      mockRepo.findByDateRange.mockResolvedValue([]);
      await service.getEvents('user-42', '2026-01-01', '2026-12-31');
      const [calledUserId] = mockRepo.findByDateRange.mock.calls[0];
      expect(calledUserId).toBe('user-42');
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return events in the next 24 hours by default', async () => {
      mockRepo.findUpcoming.mockResolvedValue([]);
      await service.getUpcomingEvents('user-1');
      const [userId, from, to] = mockRepo.findUpcoming.mock.calls[0];
      expect(userId).toBe('user-1');
      const diffHours = (to.getTime() - from.getTime()) / 3600_000;
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('should respect custom hours parameter', async () => {
      mockRepo.findUpcoming.mockResolvedValue([]);
      await service.getUpcomingEvents('user-1', 48);
      const [, from, to] = mockRepo.findUpcoming.mock.calls[0];
      const diffHours = (to.getTime() - from.getTime()) / 3600_000;
      expect(diffHours).toBeCloseTo(48, 0);
    });
  });

  describe('countEventsInWeek', () => {
    it('should delegate to repository with correct user and dates', async () => {
      mockRepo.countInRange.mockResolvedValue(7);
      const weekStart = new Date('2026-08-17T00:00:00Z');
      const weekEnd = new Date('2026-08-23T23:59:59Z');
      const count = await service.countEventsInWeek('user-1', weekStart, weekEnd);
      expect(count).toBe(7);
      expect(mockRepo.countInRange).toHaveBeenCalledWith('user-1', weekStart, weekEnd);
    });
  });
});
