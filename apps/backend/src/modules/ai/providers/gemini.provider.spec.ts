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
