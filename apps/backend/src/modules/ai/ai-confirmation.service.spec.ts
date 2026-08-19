import { NotFoundException } from '@nestjs/common';
import { AiConfirmationService } from './ai-confirmation.service';

describe('AiConfirmationService', () => {
  let service: AiConfirmationService;

  beforeEach(() => {
    service = new AiConfirmationService();
  });

  it('creates and consumes a confirmation for the same user', () => {
    const pending = service.create({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
    });

    const consumed = service.consume(pending.id, 'user-1');
    expect(consumed.toolName).toBe('deleteTask');
    expect(consumed.arguments).toEqual({ taskId: 'task-1' });
  });

  it('rejects confirmation for another user', () => {
    const pending = service.create({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
    });

    expect(() => service.consume(pending.id, 'user-2')).toThrow(
      NotFoundException,
    );
  });

  it('rejects duplicate confirmation consumption', () => {
    const pending = service.create({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
    });

    service.consume(pending.id, 'user-1');
    expect(() => service.consume(pending.id, 'user-1')).toThrow(
      NotFoundException,
    );
  });

  it('rejects expired confirmation', () => {
    jest.useFakeTimers();
    const pending = service.create({
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
    });

    jest.advanceTimersByTime(16 * 60_000);
    expect(() => service.consume(pending.id, 'user-1')).toThrow(
      NotFoundException,
    );
    jest.useRealTimers();
  });
});
