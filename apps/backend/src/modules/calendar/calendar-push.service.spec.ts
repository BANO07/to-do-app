import { Test, TestingModule } from '@nestjs/testing';
import { CalendarPushService } from './calendar-push.service';
import { CalendarConnectionService } from './calendar-connection.service';
import { Task } from '../tasks/entities/task.entity';
import { TaskPriority } from '../../common/enums/task-priority.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';

describe('CalendarPushService', () => {
  let service: CalendarPushService;
  let fetchMock: jest.Mock;

  const connectionService = {
    getConnectionStatus: jest.fn(),
    getReadyClient: jest.fn(),
  };

  const baseTask = (overrides: Partial<Task> = {}): Task =>
    ({
      id: 'task-1',
      userId: 'user-1',
      title: 'RMQ migration',
      description: 'Migrate queues',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2026-08-25T11:30:00.000Z'),
      googleEventId: null,
      ...overrides,
    }) as Task;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarPushService,
        { provide: CalendarConnectionService, useValue: connectionService },
      ],
    }).compile();

    service = module.get(CalendarPushService);
  });

  const mockWritableClient = () => {
    connectionService.getConnectionStatus.mockResolvedValue({
      connected: true,
      canWrite: true,
      needsReconnect: false,
    });
    connectionService.getReadyClient.mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token' }),
      credentials: { access_token: 'access-token' },
    });
  };

  it('skips create when task has no due date', async () => {
    const id = await service.createEventForTask(
      'user-1',
      baseTask({ dueDate: null }),
      'UTC',
    );
    expect(id).toBeNull();
    expect(connectionService.getConnectionStatus).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips create when calendar cannot write', async () => {
    connectionService.getConnectionStatus.mockResolvedValue({
      connected: true,
      canWrite: false,
      needsReconnect: true,
    });
    const id = await service.createEventForTask('user-1', baseTask(), 'UTC');
    expect(id).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent when googleEventId already set', async () => {
    const id = await service.createEventForTask(
      'user-1',
      baseTask({ googleEventId: 'existing-event' }),
      'UTC',
    );
    expect(id).toBe('existing-event');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a Google event and returns its id', async () => {
    mockWritableClient();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gcal-1' }),
    });

    const id = await service.createEventForTask('user-1', baseTask(), 'Asia/Kolkata');
    expect(id).toBe('gcal-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/calendars/primary/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as {
      summary: string;
      description: string;
      start: { timeZone: string };
    };
    expect(body.summary).toBe('RMQ migration');
    expect(body.description).toBe('Migrate queues');
    expect(body.start.timeZone).toBe('Asia/Kolkata');
  });

  it('returns null when Google create fails', async () => {
    mockWritableClient();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'insufficient permissions',
    });
    const id = await service.createEventForTask('user-1', baseTask(), 'UTC');
    expect(id).toBeNull();
  });

  it('updates an existing Google event', async () => {
    mockWritableClient();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const ok = await service.updateEventForTask(
      'user-1',
      baseTask({ googleEventId: 'gcal-1' }),
      'UTC',
    );
    expect(ok).toBe(true);
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('deletes an existing Google event', async () => {
    mockWritableClient();
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    const ok = await service.deleteEventForTask(
      'user-1',
      baseTask({ googleEventId: 'gcal-1' }),
    );
    expect(ok).toBe(true);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('treats 404 on delete as success', async () => {
    mockWritableClient();
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'gone' });
    const ok = await service.deleteEventForTask(
      'user-1',
      baseTask({ googleEventId: 'gcal-missing' }),
    );
    expect(ok).toBe(true);
  });
});
