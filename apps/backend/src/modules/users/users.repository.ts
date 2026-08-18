import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.repository.findOne({ where: { googleId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async upsertFromGoogle(profile: GoogleProfile): Promise<User> {
    let user = await this.findByGoogleId(profile.googleId);

    if (!user) {
      user = this.repository.create({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isActive: true,
        ianaTimezone: 'UTC',
      });
    } else {
      user.email = profile.email;
      user.name = profile.name;
      user.avatarUrl = profile.avatarUrl ?? user.avatarUrl;
    }

    user.lastLoginAt = new Date();
    return this.repository.save(user);
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}
