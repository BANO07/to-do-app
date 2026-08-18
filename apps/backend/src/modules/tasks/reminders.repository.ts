import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';

@Injectable()
export class RemindersRepository {
  constructor(
    @InjectRepository(Reminder)
    private readonly repository: Repository<Reminder>,
  ) {}

  findByTaskForUser(taskId: string, userId: string): Promise<Reminder[]> {
    return this.repository.find({
      where: { taskId, userId },
      order: { fireAt: 'ASC' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Reminder | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  create(data: Partial<Reminder>): Reminder {
    return this.repository.create(data);
  }

  save(reminder: Reminder): Promise<Reminder> {
    return this.repository.save(reminder);
  }

  async remove(reminder: Reminder): Promise<void> {
    await this.repository.remove(reminder);
  }
}
