import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarConnection } from './entities/calendar-connection.entity';
import { CalendarConnectionStatus } from '../../common/enums/calendar-connection-status.enum';

@Injectable()
export class CalendarConnectionRepository {
  constructor(
    @InjectRepository(CalendarConnection)
    private readonly repo: Repository<CalendarConnection>,
  ) {}

  findByUserId(userId: string): Promise<CalendarConnection | null> {
    return this.repo.findOne({ where: { userId, provider: 'google' } });
  }

  findActiveByUserId(userId: string): Promise<CalendarConnection | null> {
    return this.repo.findOne({
      where: { userId, provider: 'google', status: CalendarConnectionStatus.ACTIVE },
    });
  }

  findAllActive(): Promise<CalendarConnection[]> {
    return this.repo.find({
      where: { provider: 'google', status: CalendarConnectionStatus.ACTIVE },
    });
  }

  async upsert(data: {
    userId: string;
    provider: string;
    providerAccountId: string | null;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    scopes: string[];
    status: CalendarConnectionStatus;
  }): Promise<CalendarConnection> {
    const existing = await this.findByUserId(data.userId);
    if (existing) {
      Object.assign(existing, data);
      return this.repo.save(existing);
    }
    const conn = this.repo.create(data);
    return this.repo.save(conn);
  }

  async updateTokens(
    id: string,
    accessToken: string,
    tokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.repo.update({ id }, { accessToken, tokenExpiresAt });
  }

  async updateStatus(id: string, status: CalendarConnectionStatus): Promise<void> {
    await this.repo.update({ id }, { status });
  }

  async delete(userId: string): Promise<void> {
    await this.repo.delete({ userId, provider: 'google' });
  }
}
