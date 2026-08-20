import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProvider,
  AIProviderCapabilities,
  AIProviderChatMessage,
  AIProviderChatResult,
  AIProviderGenerateChatInput,
  AIProviderGenerateTextInput,
  AIProviderImagePart,
  AIProviderResult,
  AIProviderToolCall,
  AIProviderToolDeclaration,
} from './ai-provider.interface';
import {
  AiProviderException,
  AiProviderUnavailableException,
  AiUnsupportedAttachmentException,
} from '../exceptions/ai.exceptions';
import { nvidiaModelSupportsImageInput } from './nvidia-model-capabilities';

const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_NVIDIA_MODEL = 'openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 60_000;

/** OpenAI-compatible chat message shapes used by NVIDIA NIM. */
type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAiContentPart[] }
  | {
      role: 'assistant';
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
    finish_reason?: string;
  }>;
  error?: { message?: string; type?: string; code?: string };
};

@Injectable()
export class NvidiaNimProvider implements AIProvider {
  private readonly logger = new Logger(NvidiaNimProvider.name);
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('NVIDIA_API_KEY');
    this.apiKey = apiKey?.trim() ? apiKey.trim() : null;
    this.configured = Boolean(this.apiKey);
    this.baseUrl = (
      this.configService.get<string>('NVIDIA_BASE_URL') ?? DEFAULT_NVIDIA_BASE_URL
    ).replace(/\/$/, '');
  }

  isAvailable(): boolean {
    return this.configured;
  }

  getCapabilities(): AIProviderCapabilities {
    return {
      imageInput: nvidiaModelSupportsImageInput(this.resolveModel()),
    };
  }

  async generateText(
    input: AIProviderGenerateTextInput,
  ): Promise<AIProviderResult> {
    const result = await this.generateChat({
      systemInstruction: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: input.prompt }],
      tools: [],
    });
    return { text: result.text ?? '' };
  }

  async generateChat(
    input: AIProviderGenerateChatInput,
  ): Promise<AIProviderChatResult> {
    if (!this.apiKey) {
      throw new AiProviderUnavailableException();
    }

    const model = this.resolveModel();
    if (
      input.imageParts &&
      input.imageParts.length > 0 &&
      !nvidiaModelSupportsImageInput(model)
    ) {
      throw new AiUnsupportedAttachmentException();
    }

    const messages = this.toOpenAiMessages(
      input.systemInstruction,
      input.messages,
      input.imageParts,
    );
    const tools = this.toOpenAiTools(input.tools);

    const startedAt = Date.now();
    try {
      const response = await this.postChatCompletion({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      });

      const latencyMs = Date.now() - startedAt;
      this.logger.log(
        `NVIDIA generateChat ok provider=nvidia model=${model} latencyMs=${latencyMs} requestId=${response.id ?? 'n/a'}`,
      );

      const choice = response.choices?.[0]?.message;
      if (!choice) {
        throw new AiProviderException('AI returned an empty response.');
      }

      const toolCalls = this.parseToolCalls(choice.tool_calls);
      if (toolCalls.length > 0) {
        this.logger.log(
          `NVIDIA tool calls: ${toolCalls.map((c) => c.name).join(', ')}`,
        );
        return { toolCalls };
      }

      return { text: choice.content ?? '' };
    } catch (error) {
      if (
        error instanceof AiProviderException ||
        error instanceof AiProviderUnavailableException
      ) {
        throw error;
      }

      this.logger.warn(
        `NVIDIA generateChat failed provider=nvidia model=${model} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new AiProviderException();
    }
  }

  /** Exposed for unit tests — maps app messages to OpenAI-compatible format. */
  toOpenAiMessages(
    systemInstruction: string,
    messages: AIProviderChatMessage[],
    imageParts?: AIProviderImagePart[],
  ): OpenAiMessage[] {
    const result: OpenAiMessage[] = [
      { role: 'system', content: systemInstruction },
    ];

    let i = 0;
    while (i < messages.length) {
      const message = messages[i];

      if (message.role === 'tool') {
        // Collect consecutive tool results and synthesize the required
        // assistant tool_calls turn (AiChatService does not persist it).
        const batch: AIProviderChatMessage[] = [];
        while (i < messages.length && messages[i].role === 'tool') {
          batch.push(messages[i]);
          i += 1;
        }

        const toolCalls: OpenAiToolCall[] = batch.map((toolMsg, index) => ({
          id: toolMsg.toolCallId ?? `tool_${index}`,
          type: 'function',
          function: {
            name: toolMsg.toolName ?? 'tool',
            // Arguments are not stored in history; empty object is acceptable
            // for OpenAI-compatible follow-up rounds.
            arguments: '{}',
          },
        }));

        result.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        });

        for (const toolMsg of batch) {
          result.push({
            role: 'tool',
            tool_call_id: toolMsg.toolCallId ?? toolMsg.toolName ?? 'tool',
            content: toolMsg.content || '{}',
          });
        }
        continue;
      }

      if (message.role === 'assistant') {
        result.push({ role: 'assistant', content: message.content });
        i += 1;
        continue;
      }

      // user
      result.push({ role: 'user', content: message.content });
      i += 1;
    }

    // Attach images to the last user message (OpenAI multimodal format).
    if (imageParts && imageParts.length > 0) {
      const imageContentParts: OpenAiContentPart[] = imageParts.map((img) => ({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
        },
      }));

      let lastUserIndex = -1;
      for (let j = result.length - 1; j >= 0; j--) {
        if (result[j].role === 'user') {
          lastUserIndex = j;
          break;
        }
      }

      if (lastUserIndex >= 0) {
        const existing = result[lastUserIndex] as {
          role: 'user';
          content: string | OpenAiContentPart[];
        };
        const textParts: OpenAiContentPart[] =
          typeof existing.content === 'string'
            ? [{ type: 'text', text: existing.content }]
            : existing.content;
        result[lastUserIndex] = {
          role: 'user',
          content: [...textParts, ...imageContentParts],
        };
      } else {
        result.push({ role: 'user', content: imageContentParts });
      }
    }

    return result;
  }

  /** Exposed for unit tests. */
  toOpenAiTools(tools: AIProviderToolDeclaration[]): OpenAiTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parametersJsonSchema,
      },
    }));
  }

  private parseToolCalls(
    toolCalls: OpenAiToolCall[] | undefined,
  ): AIProviderToolCall[] {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    return toolCalls.map((call) => {
      let args: Record<string, unknown> = {};
      try {
        const raw = call.function?.arguments ?? '{}';
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        this.logger.warn(
          `NVIDIA malformed tool arguments for tool=${call.function?.name ?? 'unknown'}`,
        );
      }

      return {
        id: call.id,
        name: call.function?.name ?? 'unknown',
        arguments: args,
      };
    });
  }

  private resolveModel(): string {
    return (
      this.configService.get<string>('AI_MODEL')?.trim() || DEFAULT_NVIDIA_MODEL
    );
  }

  private async postChatCompletion(body: {
    model: string;
    messages: OpenAiMessage[];
    tools?: OpenAiTool[];
    tool_choice?: 'auto';
  }): Promise<OpenAiChatCompletionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          ...(body.tools ? { tools: body.tools, tool_choice: body.tool_choice } : {}),
          stream: false,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: OpenAiChatCompletionResponse = {};
      try {
        payload = text ? (JSON.parse(text) as OpenAiChatCompletionResponse) : {};
      } catch {
        this.logger.warn(
          `NVIDIA malformed JSON response status=${response.status}`,
        );
        throw new AiProviderException();
      }

      if (!response.ok) {
        this.mapHttpError(response.status, payload);
      }

      if (payload.error) {
        this.logger.warn(
          `NVIDIA API error type=${payload.error.type ?? 'n/a'} code=${payload.error.code ?? 'n/a'}`,
        );
        throw new AiProviderException();
      }

      return payload;
    } catch (error) {
      if (
        error instanceof AiProviderException ||
        error instanceof AiProviderUnavailableException
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('NVIDIA request timed out');
        throw new AiProviderException('AI request timed out. Please try again.');
      }

      this.logger.warn(
        `NVIDIA network failure: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new AiProviderException();
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapHttpError(
    status: number,
    payload: OpenAiChatCompletionResponse,
  ): never {
    const category =
      status === 401 || status === 403
        ? 'auth'
        : status === 429
          ? 'rate_limit'
          : status === 404
            ? 'model_unavailable'
            : status >= 500
              ? 'provider_error'
              : 'client_error';

    this.logger.warn(
      `NVIDIA HTTP error status=${status} category=${category} code=${payload.error?.code ?? 'n/a'}`,
    );

    if (status === 401 || status === 403) {
      throw new AiProviderUnavailableException(
        'AI provider authentication failed. Please contact your administrator.',
      );
    }

    if (status === 429) {
      throw new AiProviderException(
        'AI provider rate limit reached. Please try again shortly.',
      );
    }

    if (status === 404) {
      throw new AiProviderException(
        'Configured AI model is unavailable. Please contact your administrator.',
      );
    }

    throw new AiProviderException();
  }
}
