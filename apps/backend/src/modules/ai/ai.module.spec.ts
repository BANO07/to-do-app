import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';

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
});
