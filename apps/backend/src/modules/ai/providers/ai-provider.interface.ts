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

/** An inline image to pass as a multimodal part alongside the user's message. */
export interface AIProviderImagePart {
  /** Base64-encoded image bytes (no data-URL prefix). */
  base64: string;
  /** MIME type, e.g. "image/png". */
  mimeType: string;
  /** Original filename for display/context purposes only. */
  filename: string;
}

export interface AIProviderGenerateChatInput {
  systemInstruction: string;
  messages: AIProviderChatMessage[];
  tools: AIProviderToolDeclaration[];
  /** Optional inline image parts to append to the most recent user message. */
  imageParts?: AIProviderImagePart[];
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
