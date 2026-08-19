import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Content,
  createPartFromFunctionResponse,
  createPartFromText,
  FunctionDeclaration,
  GoogleGenAI,
} from '@google/genai';
import {
  AIProvider,
  AIProviderChatMessage,
  AIProviderChatResult,
  AIProviderGenerateChatInput,
  AIProviderGenerateTextInput,
  AIProviderResult,
} from './ai-provider.interface';
import {
  AiProviderException,
  AiProviderUnavailableException,
} from '../exceptions/ai.exceptions';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenAI | null;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.configured = Boolean(apiKey);
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isAvailable(): boolean {
    return this.configured;
  }

  async generateText(
    input: AIProviderGenerateTextInput,
  ): Promise<AIProviderResult> {
    if (!this.client) {
      throw new AiProviderUnavailableException();
    }

    const model =
      this.configService.get<string>('AI_MODEL') ?? DEFAULT_GEMINI_MODEL;

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: input.prompt,
      });

      return {
        text: response.text ?? '',
      };
    } catch (error) {
      this.logger.warn(
        'Gemini generateText failed',
        error instanceof Error ? error.message : 'unknown error',
      );
      throw new AiProviderException();
    }
  }

  async generateChat(
    input: AIProviderGenerateChatInput,
  ): Promise<AIProviderChatResult> {
    if (!this.client) {
      throw new AiProviderUnavailableException();
    }

    const model =
      this.configService.get<string>('AI_MODEL') ?? DEFAULT_GEMINI_MODEL;

    const functionDeclarations: FunctionDeclaration[] = input.tools.map(
      (tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parametersJsonSchema,
      }),
    );

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: this.toGeminiContents(input.messages),
        config: {
          systemInstruction: input.systemInstruction,
          tools: [{ functionDeclarations }],
        },
      });

      const toolCalls =
        response.functionCalls?.map((call) => ({
          id: call.id,
          name: call.name ?? 'unknown',
          arguments: (call.args ?? {}) as Record<string, unknown>,
        })) ?? [];

      if (toolCalls.length > 0) {
        return { toolCalls };
      }

      return {
        text: response.text ?? '',
      };
    } catch (error) {
      this.logger.warn(
        'Gemini generateChat failed',
        error instanceof Error ? error.message : 'unknown error',
      );
      throw new AiProviderException();
    }
  }

  toGeminiContents(messages: AIProviderChatMessage[]): Content[] {
    return messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'user',
          parts: [
            createPartFromFunctionResponse(
              message.toolCallId ?? message.toolName ?? 'tool',
              message.toolName ?? 'tool',
              JSON.parse(message.content || '{}') as Record<string, unknown>,
            ),
          ],
        };
      }

      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [createPartFromText(message.content)],
      };
    });
  }
}
