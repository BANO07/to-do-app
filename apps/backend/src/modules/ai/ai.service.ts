import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from './ai.tokens';
import { AIUsageService } from './ai-usage.service';
import {
  AIProvider,
  AIProviderGenerateTextInput,
  AIProviderGenerateChatInput,
  AIProviderResult,
  AIProviderChatResult,
} from './providers/ai-provider.interface';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly aiUsageService: AIUsageService,
  ) {}

  isProviderConfigured(): boolean {
    return this.aiProvider.isAvailable();
  }

  getUsage(userId: string) {
    return this.aiUsageService.getUsage(userId);
  }

  async generateText(
    userId: string,
    input: AIProviderGenerateTextInput,
  ): Promise<AIProviderResult> {
    await this.aiUsageService.consumeDailyRequest(userId);
    return this.aiProvider.generateText(input);
  }

  async generateChat(
    userId: string,
    input: AIProviderGenerateChatInput,
  ): Promise<AIProviderChatResult> {
    await this.aiUsageService.consumeDailyRequest(userId);
    return this.aiProvider.generateChat(input);
  }
}
