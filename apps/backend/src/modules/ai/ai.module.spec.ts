import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai.tokens';
import { GeminiProvider } from './providers/gemini.provider';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { UnavailableAiProvider } from './providers/unavailable-ai.provider';
import { AIProvider } from './providers/ai-provider.interface';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: jest.fn() },
  })),
}));

describe('AiModule provider wiring', () => {
  it('initializes GeminiProvider without GEMINI_API_KEY', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    const geminiProvider = module.get(GeminiProvider);
    expect(geminiProvider.isAvailable()).toBe(false);
  });

  const buildSelectionModule = async (aiProvider: string) => {
    return Test.createTestingModule({
      providers: [
        GeminiProvider,
        NvidiaNimProvider,
        UnavailableAiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AI_PROVIDER') return aiProvider;
              if (key === 'GEMINI_API_KEY') return 'gemini-key';
              if (key === 'NVIDIA_API_KEY') return 'nvidia-key';
              return undefined;
            }),
          },
        },
        {
          provide: AI_PROVIDER,
          inject: [
            ConfigService,
            GeminiProvider,
            NvidiaNimProvider,
            UnavailableAiProvider,
          ],
          useFactory: (
            configService: ConfigService,
            geminiProvider: GeminiProvider,
            nvidiaProvider: NvidiaNimProvider,
            unavailableProvider: UnavailableAiProvider,
          ) => {
            const provider = (
              configService.get<string>('AI_PROVIDER') ?? 'gemini'
            ).toLowerCase();
            if (provider === 'gemini') return geminiProvider;
            if (provider === 'nvidia') return nvidiaProvider;
            return unavailableProvider;
          },
        },
      ],
    }).compile();
  };

  it('selects GeminiProvider when AI_PROVIDER=gemini', async () => {
    const module = await buildSelectionModule('gemini');
    const selected = module.get<AIProvider>(AI_PROVIDER);
    expect(selected).toBeInstanceOf(GeminiProvider);
  });

  it('selects NvidiaNimProvider when AI_PROVIDER=nvidia', async () => {
    const module = await buildSelectionModule('nvidia');
    const selected = module.get<AIProvider>(AI_PROVIDER);
    expect(selected).toBeInstanceOf(NvidiaNimProvider);
  });

  it('selects UnavailableAiProvider for unknown AI_PROVIDER', async () => {
    const module = await buildSelectionModule('unknown');
    const selected = module.get<AIProvider>(AI_PROVIDER);
    expect(selected).toBeInstanceOf(UnavailableAiProvider);
  });
});
