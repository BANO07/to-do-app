import { Injectable } from '@nestjs/common';
import { EmailProvider, ReminderEmailPayload } from './email-provider.interface';

@Injectable()
export class NoopEmailProvider implements EmailProvider {
  isAvailable(): boolean {
    return false;
  }

  async sendEmail(_payload: ReminderEmailPayload): Promise<void> {
    throw new Error('Email provider is not configured');
  }
}
