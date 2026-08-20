import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Content,
  createPartFromBase64,
  createPartFromFunctionResponse,
  createPartFromText,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
} from '@google/genai';
import {
  AIProvider,
  AIProviderChatMessage,
  AIProviderChatResult,
  AIProviderGenerateChatInput,
  AIProviderGenerateTextInput,
  AIProviderImagePart,
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
      const geminiContents = this.toGeminiContents(input.messages, input.imageParts);
      this.logger.log(
        `[GeminiProvider] generateChat: messages=${input.messages.length} imageParts=${input.imageParts?.length ?? 0} contentsBlocks=${geminiContents.length}`,
      );
      // Log part counts per content block without leaking data
      geminiContents.forEach((c, i) => {
        const partSummary = (c.parts ?? []).map((p) => {
          const pp = p as Record<string, unknown>;
          if (pp['text']) return 'text';
          if (pp['inlineData']) return `inlineData(${(pp['inlineData'] as Record<string, unknown>)['mimeType']})`;
          if (pp['functionResponse']) return 'functionResponse';
          return 'unknown';
        });
        this.logger.log(`[GeminiProvider] content[${i}] role=${c.role} parts=[${partSummary.join(', ')}]`);
      });
      const response = await this.client.models.generateContent({
        model,
        contents: geminiContents,
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

  toGeminiContents(
    messages: AIProviderChatMessage[],
    imageParts?: AIProviderImagePart[],
  ): Content[] {
    const contents: Content[] = messages.map((message) => {
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

    // Append inline image parts to the last user-role content block.
    // This gives Gemini the actual image bytes alongside the user's text request.
    if (imageParts && imageParts.length > 0) {
      const inlineParts: Part[] = imageParts.map((img) =>
        createPartFromBase64(img.base64, img.mimeType),
      );

      // Find the last user message to attach images to
      let lastUserIndex = -1;
      for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role === 'user') {
          lastUserIndex = i;
          break;
        }
      }

      if (lastUserIndex >= 0) {
        contents[lastUserIndex] = {
          ...contents[lastUserIndex],
          parts: [...(contents[lastUserIndex].parts ?? []), ...inlineParts],
        };
      } else {
        // No user message yet — create one containing only the images
        contents.push({ role: 'user', parts: inlineParts });
      }
    }

    return contents;
  }
}
