import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, ReminderEmailPayload } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend | null;
  private readonly from: string | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('EMAIL_API_KEY');
    this.from = this.configService.get<string>('EMAIL_FROM') ?? null;
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  isAvailable(): boolean {
    return Boolean(this.client && this.from);
  }

  async sendEmail(payload: ReminderEmailPayload): Promise<void> {
    if (!this.client || !this.from) {
      throw new Error('Email provider is not configured');
    }

    const response = await this.client.emails.send({
      from: this.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }
  }
}
