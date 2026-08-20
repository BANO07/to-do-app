import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushPayload, PushProvider, PushTarget } from './push-provider.interface';

@Injectable()
export class WebPushProvider implements PushProvider {
  private readonly publicKey: string | null;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const publicKey =
      this.configService.get<string>('PUSH_VAPID_PUBLIC_KEY') ?? null;
    const privateKey =
      this.configService.get<string>('PUSH_VAPID_PRIVATE_KEY') ?? null;
    const subject =
      this.configService.get<string>('PUSH_VAPID_SUBJECT') ?? null;

    this.publicKey = publicKey;
    this.configured = Boolean(publicKey && privateKey && subject);

    if (this.configured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    }
  }

  isAvailable(): boolean {
    return this.configured;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async sendNotification(
    target: PushTarget,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.configured) {
      throw new Error('Push provider is not configured');
    }

    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: target.keys,
      },
      JSON.stringify(payload),
    );
  }
}
