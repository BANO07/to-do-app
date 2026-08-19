export interface AIProviderGenerateTextInput {
  prompt: string;
}

export interface AIProviderResult {
  text: string;
}

export interface AIProviderToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface AIProviderChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export interface AIProviderToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIProviderGenerateChatInput {
  systemInstruction: string;
  messages: AIProviderChatMessage[];
  tools: AIProviderToolDeclaration[];
}

export interface AIProviderChatResult {
  text?: string;
  toolCalls?: AIProviderToolCall[];
}

export interface AIProvider {
  isAvailable(): boolean;
  generateText(input: AIProviderGenerateTextInput): Promise<AIProviderResult>;
  generateChat(input: AIProviderGenerateChatInput): Promise<AIProviderChatResult>;
}
