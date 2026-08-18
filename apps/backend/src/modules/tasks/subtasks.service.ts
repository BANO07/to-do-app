import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubtasksRepository } from './subtasks.repository';
import { TasksRepository } from './tasks.repository';
import { Subtask } from './entities/subtask.entity';
import {
  CreateSubtaskInput,
  UpdateSubtaskInput,
} from './dto/subtask.inputs';
import { SubtaskStatus } from '../../common/enums/subtask-status.enum';

@Injectable()
export class SubtasksService {
  constructor(
    private readonly subtasksRepository: SubtasksRepository,
    private readonly tasksRepository: TasksRepository,
  ) {}

  async findByTask(userId: string, taskId: string): Promise<Subtask[]> {
    await this.requireOwnedTask(userId, taskId);
    return this.subtasksRepository.findByTaskForUser(taskId, userId);
  }

  async create(userId: string, input: CreateSubtaskInput): Promise<Subtask> {
    await this.requireOwnedTask(userId, input.taskId);
    const position =
      input.position ??
      (await this.subtasksRepository.nextPosition(input.taskId, userId));

    const subtask = this.subtasksRepository.create({
      taskId: input.taskId,
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: SubtaskStatus.TODO,
      position,
    });

    return this.subtasksRepository.save(subtask);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateSubtaskInput,
  ): Promise<Subtask> {
    const subtask = await this.requireOwnedSubtask(userId, id);

    if (input.title !== undefined) {
      subtask.title = input.title.trim();
    }
    if (input.description !== undefined) {
      subtask.description = input.description?.trim() || null;
    }
    if (input.position !== undefined) {
      subtask.position = input.position;
    }

    return this.subtasksRepository.save(subtask);
  }

  async complete(userId: string, id: string): Promise<Subtask> {
    const subtask = await this.requireOwnedSubtask(userId, id);
    if (subtask.status === SubtaskStatus.COMPLETED) {
      return subtask;
    }
    subtask.status = SubtaskStatus.COMPLETED;
    subtask.completedAt = new Date();
    return this.subtasksRepository.save(subtask);
  }

  async reopen(userId: string, id: string): Promise<Subtask> {
    const subtask = await this.requireOwnedSubtask(userId, id);
    if (subtask.status !== SubtaskStatus.COMPLETED) {
      throw new BadRequestException('Only completed subtasks can be reopened');
    }
    subtask.status = SubtaskStatus.TODO;
    subtask.completedAt = null;
    return this.subtasksRepository.save(subtask);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const subtask = await this.requireOwnedSubtask(userId, id);
    await this.subtasksRepository.remove(subtask);
    return true;
  }

  private async requireOwnedTask(userId: string, taskId: string): Promise<void> {
    const task = await this.tasksRepository.findByIdForUser(taskId, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private async requireOwnedSubtask(
    userId: string,
    id: string,
  ): Promise<Subtask> {
    const subtask = await this.subtasksRepository.findByIdForUser(id, userId);
    if (!subtask) {
      throw new NotFoundException('Subtask not found');
    }
    return subtask;
  }
}
