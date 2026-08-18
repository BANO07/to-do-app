export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushTarget {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushProvider {
  isAvailable(): boolean;
  getPublicKey(): string | null;
  sendNotification(target: PushTarget, payload: PushPayload): Promise<void>;
}
