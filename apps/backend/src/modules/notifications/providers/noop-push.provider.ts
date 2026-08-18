import { Injectable } from '@nestjs/common';
import { PushPayload, PushProvider, PushTarget } from './push-provider.interface';

@Injectable()
export class NoopPushProvider implements PushProvider {
  isAvailable(): boolean {
    return false;
  }

  getPublicKey(): string | null {
    return null;
  }

  async sendNotification(
    _target: PushTarget,
    _payload: PushPayload,
  ): Promise<void> {
    throw new Error('Push provider is not configured');
  }
}
