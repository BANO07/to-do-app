import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GeminiProvider } from './gemini.provider';
import {
  AiProviderException,
  AiProviderUnavailableException,
} from '../exceptions/ai.exceptions';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
  createPartFromText: (text: string) => ({ text }),
  createPartFromBase64: (data: string, mimeType: string) => ({ inlineData: { data, mimeType } }),
  createPartFromFunctionResponse: (id: string, name: string, response: unknown) => ({
    functionResponse: { id, name, response },
  }),
}));

describe('GeminiProvider', () => {
  const generateContent = jest.fn();
  let provider: GeminiProvider;

  const buildModule = async (config: Record<string, unknown>) => {
    jest.clearAllMocks();
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      models: { generateContent },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    return module.get(GeminiProvider);
  };

  it('reports unavailable when GEMINI_API_KEY is missing', async () => {
    provider = await buildModule({});

    expect(provider.isAvailable()).toBe(false);
    expect(GoogleGenAI).not.toHaveBeenCalled();
    await expect(provider.generateText({ prompt: 'hello' })).rejects.toThrow(
      AiProviderUnavailableException,
    );
  });

  it('initializes the Gemini client when GEMINI_API_KEY is configured', async () => {
    provider = await buildModule({ GEMINI_API_KEY: 'test-key' });

    expect(provider.isAvailable()).toBe(true);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });

  it('uses the configured AI_MODEL when generating text', async () => {
    provider = await buildModule({
      GEMINI_API_KEY: 'test-key',
      AI_MODEL: 'gemini-custom-model',
    });
    generateContent.mockResolvedValue({ text: 'ok' });

    const result = await provider.generateText({ prompt: 'hello' });

    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-custom-model',
      contents: 'hello',
    });
    expect(result).toEqual({ text: 'ok' });
  });

  describe('toGeminiContents - multimodal image support', () => {
    beforeEach(async () => {
      provider = await buildModule({ GEMINI_API_KEY: 'test-key' });
    });

    it('returns text-only content when no imageParts provided', () => {
      const messages = [
        { role: 'user' as const, content: 'What is my plan?' },
      ];
      const contents = provider.toGeminiContents(messages);
      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe('user');
      expect(contents[0].parts).toHaveLength(1);
      expect((contents[0].parts![0] as { text: string }).text).toBe('What is my plan?');
    });

    it('appends PNG inline image part to last user message', () => {
      const messages = [
        { role: 'user' as const, content: 'What is in this image?' },
      ];
      const imageParts = [
        { base64: 'abc123==', mimeType: 'image/png', filename: 'photo.png' },
      ];
      const contents = provider.toGeminiContents(messages, imageParts);
      expect(contents).toHaveLength(1);
      expect(contents[0].parts).toHaveLength(2);
      const inlinePart = contents[0].parts![1] as { inlineData: { data: string; mimeType: string } };
      expect(inlinePart.inlineData.mimeType).toBe('image/png');
      expect(inlinePart.inlineData.data).toBe('abc123==');
    });

    it('appends JPEG inline image part preserving MIME type', () => {
      const messages = [{ role: 'user' as const, content: 'Describe this.' }];
      const imageParts = [
        { base64: 'jpeg64', mimeType: 'image/jpeg', filename: 'photo.jpg' },
      ];
      const contents = provider.toGeminiContents(messages, imageParts);
      const inlinePart = contents[0].parts![1] as { inlineData: { mimeType: string } };
      expect(inlinePart.inlineData.mimeType).toBe('image/jpeg');
    });

    it('appends WebP inline image part preserving MIME type', () => {
      const messages = [{ role: 'user' as const, content: 'Analyze this.' }];
      const imageParts = [
        { base64: 'webp64', mimeType: 'image/webp', filename: 'img.webp' },
      ];
      const contents = provider.toGeminiContents(messages, imageParts);
      const inlinePart = contents[0].parts![1] as { inlineData: { mimeType: string } };
      expect(inlinePart.inlineData.mimeType).toBe('image/webp');
    });

    it('appends multiple image parts when multiple images attached', () => {
      const messages = [{ role: 'user' as const, content: 'Compare these.' }];
      const imageParts = [
        { base64: 'img1', mimeType: 'image/png', filename: 'a.png' },
        { base64: 'img2', mimeType: 'image/jpeg', filename: 'b.jpg' },
      ];
      const contents = provider.toGeminiContents(messages, imageParts);
      expect(contents[0].parts).toHaveLength(3); // text + 2 images
    });

    it('creates a new user content block if messages list is empty', () => {
      const contents = provider.toGeminiContents([], [
        { base64: 'img', mimeType: 'image/png', filename: 'x.png' },
      ]);
      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe('user');
    });

    it('does not add image parts when imageParts is undefined', () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const contents = provider.toGeminiContents(messages, undefined);
      expect(contents[0].parts).toHaveLength(1);
    });

    it('does not add image parts when imageParts is empty', () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const contents = provider.toGeminiContents(messages, []);
      expect(contents[0].parts).toHaveLength(1);
    });

    it('passes imageParts to generateChat call', async () => {
      generateContent.mockResolvedValue({ text: 'I see a dog.' });
      const result = await provider.generateChat({
        systemInstruction: 'You are helpful.',
        messages: [{ role: 'user', content: 'What is this?' }],
        tools: [],
        imageParts: [{ base64: 'abc', mimeType: 'image/png', filename: 'dog.png' }],
      });
      expect(result.text).toBe('I see a dog.');
      const call = generateContent.mock.calls[0][0] as { contents: Array<{ parts: unknown[] }> };
      // Last user message should have 2 parts (text + inline image)
      expect(call.contents[0].parts).toHaveLength(2);
    });
  });

  it('surfaces provider failures safely without exposing secrets', async () => {
    provider = await buildModule({ GEMINI_API_KEY: 'secret-key-value' });
    generateContent.mockRejectedValue(
      new Error('401 invalid api key secret-key-value'),
    );

    await expect(provider.generateText({ prompt: 'hello' })).rejects.toThrow(
      AiProviderException,
    );

    try {
      await provider.generateText({ prompt: 'hello' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-key-value');
    }
  });
});
