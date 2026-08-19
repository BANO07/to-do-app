import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AIService } from './ai.service';
import { AIUsageService } from './ai-usage.service';
import { AI_PROVIDER } from './ai.tokens';
import { AIConversationService } from './ai-conversation.service';
import { AiConfirmationService } from './ai-confirmation.service';
import { AiToolsService } from './tools/ai-tools.service';
import { AiMessageRole } from '../../common/enums/ai-message-role.enum';
import { AiMessage } from './entities/ai-message.entity';
import { AiConversation } from './entities/ai-conversation.entity';
import {
  AiChatResponse,
  AiConfirmActionResponse,
  AiPendingConfirmation,
  AiToolCallResult,
} from './dto/ai-chat.dto';
import {
  AIProvider,
  AIProviderChatMessage,
  AIProviderToolCall,
} from './providers/ai-provider.interface';
import { sanitizeToolArguments } from './tools/ai-tool-args.util';
import {
  AiProviderException,
  AiProviderUnavailableException,
} from './exceptions/ai.exceptions';

const MAX_TOOL_ROUNDS = 5;

const SYSTEM_INSTRUCTION = `You are a helpful task management assistant for an authenticated Todo App user.
Always use the provided tools to retrieve real application data. Never invent tasks, reminders, categories, or stats.
Never claim an operation succeeded unless a tool result confirms it.
When intent is ambiguous, ask a concise clarification question instead of guessing.
Keep responses concise and friendly.
Do not ask for or accept a userId — all data belongs to the authenticated user automatically.`;

@Injectable()
export class AiChatService {
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly aiService: AIService,
    private readonly aiUsageService: AIUsageService,
    private readonly conversationService: AIConversationService,
    private readonly confirmationService: AiConfirmationService,
    private readonly toolsService: AiToolsService,
  ) {}

  async chat(
    userId: string,
    conversationId: string,
    message: string,
    timeZone: string,
  ): Promise<AiChatResponse> {
    const conversation = await this.conversationService.getConversationForUser(
      conversationId,
      userId,
    );

    await this.conversationService.addMessage({
      conversationId,
      userId,
      role: AiMessageRole.USER,
      content: message.trim(),
    });

    await this.conversationService.ensureConversationTitleFromFirstMessage(
      conversationId,
      userId,
      message,
    );

    if (!this.aiService.isProviderConfigured()) {
      throw new AiProviderUnavailableException();
    }

    await this.aiUsageService.consumeDailyRequest(userId);

    const toolContext = {
      userId,
      timeZone,
      conversationId,
    };

    const toolDeclarations = this.toolsService
      .getToolDefinitions()
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parametersJsonSchema,
      }));

    const executedToolCalls: AiToolCallResult[] = [];
    let pendingConfirmation: AiPendingConfirmation | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const history = await this.buildProviderMessages(conversationId, userId);

      let providerResult;
      try {
        providerResult = await this.aiProvider.generateChat({
          systemInstruction: SYSTEM_INSTRUCTION,
          messages: history,
          tools: toolDeclarations,
        });
      } catch (error) {
        if (
          error instanceof AiProviderUnavailableException ||
          error instanceof AiProviderException
        ) {
          throw error;
        }
        throw new AiProviderException();
      }

      if (providerResult.toolCalls?.length) {
        const pause = await this.handleToolCalls(
          providerResult.toolCalls,
          toolContext,
          conversationId,
          userId,
          executedToolCalls,
        );
        if (pause) {
          pendingConfirmation = pause;
          break;
        }
        continue;
      }

      const assistantText =
        providerResult.text?.trim() ||
        'I could not generate a response. Please try again.';

      const assistantMessage = await this.conversationService.addMessage({
        conversationId,
        userId,
        role: AiMessageRole.ASSISTANT,
        content: assistantText,
      });

      const updatedConversation =
        await this.conversationService.getConversationForUser(
          conversationId,
          userId,
        );

      return {
        conversation: updatedConversation,
        assistantMessage,
        toolCalls: executedToolCalls,
        pendingConfirmation: null,
        completed: true,
        usage: {
          ...(await this.aiService.getUsage(userId)),
          providerConfigured: this.aiService.isProviderConfigured(),
        },
      };
    }

    const updatedConversation =
      await this.conversationService.getConversationForUser(
        conversationId,
        userId,
      );

    let assistantMessage: AiMessage | null = null;
    if (pendingConfirmation) {
      assistantMessage = await this.conversationService.addMessage({
        conversationId,
        userId,
        role: AiMessageRole.ASSISTANT,
        content: `${pendingConfirmation.description} Confirm to proceed.`,
        metadata: {
          pendingConfirmationId: pendingConfirmation.id,
        },
      });
    } else if (executedToolCalls.length > 0) {
      assistantMessage = await this.conversationService.addMessage({
        conversationId,
        userId,
        role: AiMessageRole.ASSISTANT,
        content:
          'I reached the maximum number of tool steps for one request. Please send another message to continue.',
      });
    }

    return {
      conversation: updatedConversation,
      assistantMessage,
      toolCalls: executedToolCalls,
      pendingConfirmation,
      completed: !pendingConfirmation,
      usage: {
        ...(await this.aiService.getUsage(userId)),
        providerConfigured: this.aiService.isProviderConfigured(),
      },
    };
  }

  async confirmAction(
    userId: string,
    confirmationId: string,
    timeZone: string,
  ): Promise<AiConfirmActionResponse> {
    const confirmation = this.confirmationService.consume(
      confirmationId,
      userId,
    );

    await this.conversationService.getConversationForUser(
      confirmation.conversationId,
      userId,
    );

    const toolContext = {
      userId,
      timeZone,
      conversationId: confirmation.conversationId,
    };

    const result = await this.toolsService.executeTool(
      toolContext,
      randomUUID(),
      confirmation.toolName,
      confirmation.arguments,
    );

    await this.conversationService.addMessage({
      conversationId: confirmation.conversationId,
      userId,
      role: AiMessageRole.TOOL,
      content: JSON.stringify({
        success: result.success,
        summary: result.summary,
        data: result.data ?? null,
        error: result.error ?? null,
      }),
      toolName: confirmation.toolName,
      toolCallId: result.toolCallId ?? confirmation.id,
      toolStatus: result.success ? 'success' : 'error',
    });

    const assistantMessage = await this.conversationService.addMessage({
      conversationId: confirmation.conversationId,
      userId,
      role: AiMessageRole.ASSISTANT,
      content: result.success
        ? result.summary
        : `I couldn't complete that action: ${result.error ?? 'unknown error'}`,
    });

    const conversation = await this.conversationService.getConversationForUser(
      confirmation.conversationId,
      userId,
    );

    return {
      conversation,
      assistantMessage,
      toolResult: {
        toolName: result.toolName,
        toolCallId: result.toolCallId,
        summary: result.summary,
        success: result.success,
      },
      completed: result.success,
    };
  }

  private async buildProviderMessages(
    conversationId: string,
    userId: string,
  ): Promise<AIProviderChatMessage[]> {
    const messages = await this.conversationService.getRecentMessagesForContext(
      conversationId,
      userId,
    );

    return messages.map((message) => ({
      role:
        message.role === AiMessageRole.USER
          ? 'user'
          : message.role === AiMessageRole.ASSISTANT
            ? 'assistant'
            : 'tool',
      content:
        message.role === AiMessageRole.TOOL
          ? message.content
          : message.content,
      toolName: message.toolName ?? undefined,
      toolCallId: message.toolCallId ?? undefined,
    }));
  }

  private async handleToolCalls(
    toolCalls: AIProviderToolCall[],
    toolContext: { userId: string; timeZone: string; conversationId: string },
    conversationId: string,
    userId: string,
    executedToolCalls: AiToolCallResult[],
  ): Promise<AiPendingConfirmation | null> {
    for (const call of toolCalls) {
      const tool = this.toolsService.getTool(call.name);
      if (!tool) {
        continue;
      }

      const args = sanitizeToolArguments(call.arguments);
      const toolCallId = call.id ?? randomUUID();

      if (tool.requiresConfirmation) {
        let preview: unknown;
        if (call.name === 'deleteTask' && args.taskId) {
          try {
            preview = await this.toolsService
              .getTool('getTask')
              ?.execute(toolContext, { taskId: String(args.taskId) });
          } catch {
            preview = undefined;
          }
        }

        const copy = this.toolsService.buildConfirmation(
          call.name,
          args,
          preview,
        );
        const confirmation = this.confirmationService.create({
          userId,
          conversationId,
          toolName: call.name,
          arguments: args,
          title: copy.title,
          description: copy.description,
        });

        return {
          id: confirmation.id,
          action: call.name,
          title: copy.title,
          description: copy.description,
          toolName: call.name,
        };
      }

      const result = await this.toolsService.executeTool(
        toolContext,
        toolCallId,
        call.name,
        args,
      );

      executedToolCalls.push({
        toolName: result.toolName,
        toolCallId: result.toolCallId,
        summary: result.summary,
        success: result.success,
      });

      await this.conversationService.addMessage({
        conversationId,
        userId,
        role: AiMessageRole.TOOL,
        content: JSON.stringify({
          success: result.success,
          summary: result.summary,
          data: result.data ?? null,
          error: result.error ?? null,
        }),
        toolName: result.toolName,
        toolCallId: result.toolCallId ?? toolCallId,
        toolStatus: result.success ? 'success' : 'error',
      });
    }

    return null;
  }
}
