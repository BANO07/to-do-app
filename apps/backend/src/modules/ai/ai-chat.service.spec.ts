import { Test, TestingModule } from '@nestjs/testing';
import { AI_PROVIDER } from './ai.tokens';
import { AiChatService, buildSystemInstruction } from './ai-chat.service';
import { AIService } from './ai.service';
import { AIUsageService } from './ai-usage.service';
import { AIConversationService } from './ai-conversation.service';
import { AiConfirmationService } from './ai-confirmation.service';
import { AiToolsService } from './tools/ai-tools.service';
import { AiAttachmentService } from './attachments/ai-attachment.service';
import { AttachmentContentExtractor } from './attachments/attachment-content-extractor';
import { AiMessageRole } from '../../common/enums/ai-message-role.enum';
import { AiProviderUnavailableException } from './exceptions/ai.exceptions';
import { AiLimitReachedException } from './exceptions/ai.exceptions';

describe('AiChatService', () => {
  let service: AiChatService;

  const aiProvider = {
    isAvailable: jest.fn().mockReturnValue(true),
    generateText: jest.fn(),
    generateChat: jest.fn(),
  };

  const aiService = {
    isProviderConfigured: jest.fn(),
    getUsage: jest.fn(),
  };

  const aiUsageService = {
    consumeDailyRequest: jest.fn(),
  };

  const conversationService = {
    getConversationForUser: jest.fn(),
    addMessage: jest.fn(),
    ensureConversationTitleFromFirstMessage: jest.fn(),
    getRecentMessagesForContext: jest.fn(),
  };

  const confirmationService = {
    create: jest.fn(),
    consume: jest.fn(),
  };

  const toolsService = {
    getToolDefinitions: jest.fn(),
    getTool: jest.fn(),
    executeTool: jest.fn(),
    buildConfirmation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    toolsService.getToolDefinitions.mockReturnValue([
      {
        name: 'getTasks',
        description: 'List tasks',
        parametersJsonSchema: { type: 'object' },
        readOnly: true,
        destructive: false,
        requiresConfirmation: false,
      },
      {
        name: 'createTask',
        description: 'Create task',
        parametersJsonSchema: { type: 'object' },
        readOnly: false,
        destructive: false,
        requiresConfirmation: false,
      },
      {
        name: 'deleteTask',
        description: 'Delete task',
        parametersJsonSchema: { type: 'object' },
        readOnly: false,
        destructive: true,
        requiresConfirmation: true,
      },
    ]);

    conversationService.getConversationForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
    });
    conversationService.addMessage.mockImplementation(async (input) => ({
      id: `msg-${Math.random()}`,
      ...input,
      createdAt: new Date(),
    }));
    conversationService.getRecentMessagesForContext.mockResolvedValue([
      {
        role: AiMessageRole.USER,
        content: 'delete my task',
      },
    ]);
    aiService.isProviderConfigured.mockReturnValue(true);
    aiService.getUsage.mockResolvedValue({
      dailyLimit: 20,
      used: 1,
      remaining: 19,
      resetAt: new Date(),
    });
    aiUsageService.consumeDailyRequest.mockResolvedValue(1);

    const mockAttachmentService = {
      getReadyAttachmentsForConversation: jest.fn().mockResolvedValue([]),
      getAttachmentData: jest.fn().mockResolvedValue(null),
    };
    const mockContentExtractor = {
      extract: jest.fn().mockResolvedValue({ text: '', truncated: false, isImage: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: AI_PROVIDER, useValue: aiProvider },
        { provide: AIService, useValue: aiService },
        { provide: AIUsageService, useValue: aiUsageService },
        { provide: AIConversationService, useValue: conversationService },
        { provide: AiConfirmationService, useValue: confirmationService },
        { provide: AiToolsService, useValue: toolsService },
        { provide: AiAttachmentService, useValue: mockAttachmentService },
        { provide: AttachmentContentExtractor, useValue: mockContentExtractor },
      ],
    }).compile();

    service = module.get(AiChatService);
  });

  it('requires configured provider before consuming usage', async () => {
    aiService.isProviderConfigured.mockReturnValue(false);

    await expect(
      service.chat('user-1', 'conv-1', 'hello', 'UTC'),
    ).rejects.toThrow(AiProviderUnavailableException);
    expect(aiUsageService.consumeDailyRequest).not.toHaveBeenCalled();
  });

  it('consumes usage once and saves assistant response', async () => {
    aiProvider.generateChat.mockResolvedValue({ text: 'Here are your tasks.' });

    const response = await service.chat('user-1', 'conv-1', 'hello', 'UTC');

    expect(aiUsageService.consumeDailyRequest).toHaveBeenCalledTimes(1);
    expect(aiProvider.generateChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining("Today's local date is"),
      }),
    );
    expect(conversationService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: AiMessageRole.USER, content: 'hello' }),
    );
    expect(response.completed).toBe(true);
    expect(response.assistantMessage?.content).toBe('Here are your tasks.');
  });

  it('includes user timezone in the system instruction', () => {
    const instruction = buildSystemInstruction('Asia/Kolkata');
    expect(instruction).toContain('Asia/Kolkata');
    expect(instruction).toContain('planMyDay');
    expect(instruction).toContain('getProductivityInsights');
  });

  it('executes read tools automatically', async () => {
    aiProvider.generateChat
      .mockResolvedValueOnce({
        toolCalls: [{ id: 'call-1', name: 'getTasks', arguments: { view: 'TODAY' } }],
      })
      .mockResolvedValueOnce({ text: 'You have 2 tasks today.' });

    toolsService.getTool.mockImplementation((name: string) =>
      toolsService.getToolDefinitions().find((tool: { name: string }) => tool.name === name),
    );
    toolsService.executeTool.mockResolvedValue({
      toolName: 'getTasks',
      toolCallId: 'call-1',
      success: true,
      summary: 'Found 2 task(s)',
      data: { items: [] },
    });

    const response = await service.chat(
      'user-1',
      'conv-1',
      'what is due today?',
      'UTC',
    );

    expect(toolsService.executeTool).toHaveBeenCalled();
    expect(toolsService.executeTool).toHaveBeenCalledWith(
      expect.any(Object),
      'call-1',
      'getTasks',
      expect.objectContaining({ view: 'TODAY' }),
    );
    expect(response.toolCalls[0]?.toolName).toBe('getTasks');
    expect(response.completed).toBe(true);
  });

  it('executes explicit createTask mutations without using delete flow', async () => {
    aiProvider.generateChat
      .mockResolvedValueOnce({
        toolCalls: [
          { id: 'call-3', name: 'createTask', arguments: { title: 'Prepare slides' } },
        ],
      })
      .mockResolvedValueOnce({ text: 'Created task "Prepare slides".' });

    toolsService.getTool.mockImplementation((name: string) =>
      toolsService.getToolDefinitions().find((tool: { name: string }) => tool.name === name),
    );
    toolsService.executeTool.mockResolvedValue({
      toolName: 'createTask',
      toolCallId: 'call-3',
      success: true,
      summary: 'Created task "Prepare slides".',
      data: { id: 'task-1', title: 'Prepare slides' },
    });

    const response = await service.chat(
      'user-1',
      'conv-1',
      'create a task called Prepare slides',
      'UTC',
    );

    expect(toolsService.executeTool).toHaveBeenCalledWith(
      expect.any(Object),
      'call-3',
      'createTask',
      expect.objectContaining({ title: 'Prepare slides' }),
    );
    expect(confirmationService.create).not.toHaveBeenCalled();
    expect(response.completed).toBe(true);
  });

  it('returns pending confirmation for destructive deleteTask', async () => {
    aiProvider.generateChat.mockResolvedValue({
      toolCalls: [{ id: 'call-2', name: 'deleteTask', arguments: { taskId: 'task-1' } }],
    });
    toolsService.getTool.mockImplementation((name: string) =>
      toolsService.getToolDefinitions().find((tool: { name: string }) => tool.name === name),
    );
    toolsService.buildConfirmation.mockReturnValue({
      title: 'Delete task',
      description: 'Delete permanently?',
    });
    confirmationService.create.mockReturnValue({
      id: 'confirm-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
      expiresAt: new Date(Date.now() + 60_000),
      consumed: false,
    });

    const response = await service.chat(
      'user-1',
      'conv-1',
      'delete testing task',
      'UTC',
    );

    expect(response.pendingConfirmation?.id).toBe('confirm-1');
    expect(response.completed).toBe(false);
    expect(toolsService.executeTool).not.toHaveBeenCalled();
  });

  it('propagates daily limit errors without saving assistant output', async () => {
    aiUsageService.consumeDailyRequest.mockRejectedValue(
      new AiLimitReachedException('limit reached'),
    );

    await expect(
      service.chat('user-1', 'conv-1', 'hello', 'UTC'),
    ).rejects.toThrow(AiLimitReachedException);
    expect(aiProvider.generateChat).not.toHaveBeenCalled();
  });

  it('confirms destructive action for the owning user', async () => {
    confirmationService.consume.mockReturnValue({
      id: 'confirm-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      toolName: 'deleteTask',
      arguments: { taskId: 'task-1' },
      title: 'Delete task',
      description: 'Delete permanently?',
      expiresAt: new Date(Date.now() + 60_000),
      consumed: true,
    });
    toolsService.executeTool.mockResolvedValue({
      toolName: 'deleteTask',
      toolCallId: 'call-1',
      success: true,
      summary: 'Task deleted.',
    });

    const response = await service.confirmAction('user-1', 'confirm-1', 'UTC');
    expect(response.completed).toBe(true);
    expect(response.toolResult.summary).toBe('Task deleted.');
    expect(aiUsageService.consumeDailyRequest).not.toHaveBeenCalled();
  });

  describe('multimodal image attachment integration', () => {
    const makeModule = async (
      attachments: unknown[],
      fileData: { data: Buffer } | null,
      extraction: unknown,
    ) => {
      jest.clearAllMocks();
      toolsService.getToolDefinitions.mockReturnValue([]);
      conversationService.getConversationForUser.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
      });
      conversationService.addMessage.mockImplementation(async (input) => ({
        id: `msg-${Math.random()}`,
        ...input,
        createdAt: new Date(),
      }));
      conversationService.getRecentMessagesForContext.mockResolvedValue([
        { role: AiMessageRole.USER, content: 'What is in this image?' },
      ]);
      aiService.isProviderConfigured.mockReturnValue(true);
      aiService.getUsage.mockResolvedValue({
        dailyLimit: 20, used: 1, remaining: 19, resetAt: new Date(),
      });
      aiUsageService.consumeDailyRequest.mockResolvedValue(1);

      const mockAttachmentService = {
        getReadyAttachmentsForConversation: jest.fn().mockResolvedValue(attachments),
        getAttachmentData: jest.fn().mockResolvedValue(fileData),
      };
      const mockContentExtractor = {
        extract: jest.fn().mockResolvedValue(extraction),
      };

      aiProvider.generateChat.mockResolvedValue({ text: 'I see a cat.' });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiChatService,
          { provide: AI_PROVIDER, useValue: aiProvider },
          { provide: AIService, useValue: aiService },
          { provide: AIUsageService, useValue: aiUsageService },
          { provide: AIConversationService, useValue: conversationService },
          { provide: AiConfirmationService, useValue: confirmationService },
          { provide: AiToolsService, useValue: toolsService },
          { provide: AiAttachmentService, useValue: mockAttachmentService },
          { provide: AttachmentContentExtractor, useValue: mockContentExtractor },
        ],
      }).compile();

      return {
        svc: module.get(AiChatService),
        attachmentService: mockAttachmentService,
        extractor: mockContentExtractor,
      };
    };

    it('passes PNG image bytes as imageParts to the AI provider', async () => {
      const imageBuffer = Buffer.from('fake-png-bytes');
      const { svc } = await makeModule(
        [{ id: 'att-1', mimeType: 'image/png', originalFilename: 'photo.png', sizeBytes: 100 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: imageBuffer.toString('base64'), imageMimeType: 'image/png' },
      );

      await svc.chat('user-1', 'conv-1', 'What is in this image?', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { imageParts: Array<{ mimeType: string; base64: string }> };
      expect(call.imageParts).toBeDefined();
      expect(call.imageParts).toHaveLength(1);
      expect(call.imageParts[0].mimeType).toBe('image/png');
      expect(call.imageParts[0].base64).toBe(imageBuffer.toString('base64'));
    });

    it('preserves JPEG MIME type when passing image to provider', async () => {
      const imageBuffer = Buffer.from('fake-jpg-bytes');
      const { svc } = await makeModule(
        [{ id: 'att-2', mimeType: 'image/jpeg', originalFilename: 'photo.jpg', sizeBytes: 200 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: imageBuffer.toString('base64'), imageMimeType: 'image/jpeg' },
      );

      await svc.chat('user-1', 'conv-1', 'Describe.', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { imageParts: Array<{ mimeType: string }> };
      expect(call.imageParts[0].mimeType).toBe('image/jpeg');
    });

    it('preserves WebP MIME type when passing image to provider', async () => {
      const imageBuffer = Buffer.from('fake-webp-bytes');
      const { svc } = await makeModule(
        [{ id: 'att-3', mimeType: 'image/webp', originalFilename: 'photo.webp', sizeBytes: 150 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: imageBuffer.toString('base64'), imageMimeType: 'image/webp' },
      );

      await svc.chat('user-1', 'conv-1', 'Analyze.', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { imageParts: Array<{ mimeType: string }> };
      expect(call.imageParts[0].mimeType).toBe('image/webp');
    });

    it('does NOT pass image data as textual note in system instruction', async () => {
      const imageBuffer = Buffer.from('fake-png-bytes');
      const { svc } = await makeModule(
        [{ id: 'att-1', mimeType: 'image/png', originalFilename: 'photo.png', sizeBytes: 100 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: imageBuffer.toString('base64'), imageMimeType: 'image/png' },
      );

      await svc.chat('user-1', 'conv-1', 'What is in this image?', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { systemInstruction: string };
      expect(call.systemInstruction).not.toContain('image content is not directly embedded');
      expect(call.systemInstruction).not.toContain('fake-png-bytes');
    });

    it('loads image bytes from AttachmentStorage (not from DB)', async () => {
      const imageBuffer = Buffer.from('real-image-data');
      const { svc, attachmentService } = await makeModule(
        [{ id: 'att-1', mimeType: 'image/png', originalFilename: 'real.png', sizeBytes: 100 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: imageBuffer.toString('base64'), imageMimeType: 'image/png' },
      );

      await svc.chat('user-1', 'conv-1', 'Show me.', 'UTC');

      expect(attachmentService.getAttachmentData).toHaveBeenCalledWith('user-1', 'att-1');
    });

    it('sends no imageParts when no attachments', async () => {
      const { svc } = await makeModule([], null, { text: '', truncated: false, isImage: false });

      await svc.chat('user-1', 'conv-1', 'Hello.', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { imageParts?: unknown[] };
      expect(call.imageParts == null || call.imageParts.length === 0).toBe(true);
    });

    it('sends no imageParts when attachment data cannot be loaded', async () => {
      const { svc } = await makeModule(
        [{ id: 'att-1', mimeType: 'image/png', originalFilename: 'photo.png', sizeBytes: 100 }],
        null, // getAttachmentData returns null
        { text: '', truncated: false, isImage: false },
      );

      await svc.chat('user-1', 'conv-1', 'Hello.', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as { imageParts?: unknown[] };
      expect(call.imageParts == null || call.imageParts.length === 0).toBe(true);
    });

    it('passes text extraction (PDF) unchanged alongside empty imageParts', async () => {
      const { svc } = await makeModule(
        [{ id: 'att-1', mimeType: 'application/pdf', originalFilename: 'report.pdf', sizeBytes: 500 }],
        { data: Buffer.from('pdf-bytes') },
        { text: 'PDF content here', truncated: false, isImage: false },
      );

      await svc.chat('user-1', 'conv-1', 'Summarize.', 'UTC');

      const call = aiProvider.generateChat.mock.calls[0][0] as {
        systemInstruction: string;
        imageParts?: unknown[];
      };
      expect(call.systemInstruction).toContain('PDF content here');
      expect(call.imageParts == null || call.imageParts.length === 0).toBe(true);
    });

    it('quota is consumed exactly once per chat with image attachment', async () => {
      const imageBuffer = Buffer.from('img');
      const { svc } = await makeModule(
        [{ id: 'att-1', mimeType: 'image/png', originalFilename: 'a.png', sizeBytes: 50 }],
        { data: imageBuffer },
        { text: '', truncated: false, isImage: true, imageBase64: 'aW1n', imageMimeType: 'image/png' },
      );

      await svc.chat('user-1', 'conv-1', 'Analyze.', 'UTC');

      expect(aiUsageService.consumeDailyRequest).toHaveBeenCalledTimes(1);
    });
  });
});
