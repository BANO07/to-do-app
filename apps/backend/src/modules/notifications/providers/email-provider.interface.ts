export interface ReminderEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  isAvailable(): boolean;
  sendEmail(payload: ReminderEmailPayload): Promise<void>;
}
