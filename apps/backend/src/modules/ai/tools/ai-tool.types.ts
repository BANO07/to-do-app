export interface AiToolContext {
  userId: string;
  timeZone: string;
  conversationId: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  readOnly: boolean;
  destructive: boolean;
  requiresConfirmation: boolean;
  execute(
    context: AiToolContext,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface AiToolCallRequest {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiToolExecutionResult {
  toolCallId?: string;
  toolName: string;
  success: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}
