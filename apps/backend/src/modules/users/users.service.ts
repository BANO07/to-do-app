import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';
import { isValidIanaTimeZone } from '../../common/utils/date-time.util';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  upsertFromGoogle(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    return this.usersRepository.upsertFromGoogle(profile);
  }

  async updateTimezone(userId: string, timezone: string): Promise<User> {
    if (!isValidIanaTimeZone(timezone)) {
      throw new BadRequestException(
        'Invalid IANA timezone. Use a value such as Asia/Kolkata.',
      );
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.ianaTimezone = timezone;
    return this.usersRepository.save(user);
  }
}
