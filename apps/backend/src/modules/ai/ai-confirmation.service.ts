import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PendingAiConfirmation {
  id: string;
  userId: string;
  conversationId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  title: string;
  description: string;
  expiresAt: Date;
  consumed: boolean;
}

const CONFIRMATION_TTL_MS = 15 * 60_000;

@Injectable()
export class AiConfirmationService {
  private readonly store = new Map<string, PendingAiConfirmation>();

  create(input: {
    userId: string;
    conversationId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    title: string;
    description: string;
  }): PendingAiConfirmation {
    const confirmation: PendingAiConfirmation = {
      id: randomUUID(),
      userId: input.userId,
      conversationId: input.conversationId,
      toolName: input.toolName,
      arguments: input.arguments,
      title: input.title,
      description: input.description,
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
      consumed: false,
    };
    this.store.set(confirmation.id, confirmation);
    return confirmation;
  }

  consume(id: string, userId: string): PendingAiConfirmation {
    const confirmation = this.store.get(id);
    if (!confirmation) {
      throw new NotFoundException('Confirmation not found or expired');
    }
    if (confirmation.userId !== userId) {
      throw new NotFoundException('Confirmation not found or expired');
    }
    if (confirmation.consumed) {
      throw new NotFoundException('Confirmation already used');
    }
    if (confirmation.expiresAt.getTime() < Date.now()) {
      this.store.delete(id);
      throw new NotFoundException('Confirmation not found or expired');
    }
    confirmation.consumed = true;
    this.store.set(id, confirmation);
    return confirmation;
  }

  reset(): void {
    this.store.clear();
  }
}
