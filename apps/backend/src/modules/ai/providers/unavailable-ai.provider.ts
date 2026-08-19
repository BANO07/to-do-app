import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  AIProviderGenerateChatInput,
  AIProviderGenerateTextInput,
  AIProviderChatResult,
  AIProviderResult,
} from './ai-provider.interface';
import { AiProviderUnavailableException } from '../exceptions/ai.exceptions';

@Injectable()
export class UnavailableAiProvider implements AIProvider {
  isAvailable(): boolean {
    return false;
  }

  async generateText(_input: AIProviderGenerateTextInput): Promise<AIProviderResult> {
    throw new AiProviderUnavailableException();
  }

  async generateChat(_input: AIProviderGenerateChatInput): Promise<AIProviderChatResult> {
    throw new AiProviderUnavailableException();
  }
}
