import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER } from '../notification.tokens';
import { EmailProvider } from '../providers/email-provider.interface';

export interface EmailNotificationContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class EmailNotificationChannel {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  isAvailable(): boolean {
    return this.emailProvider.isAvailable();
  }

  async deliver(content: EmailNotificationContent): Promise<void> {
    await this.emailProvider.sendEmail({
      to: content.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }
}
