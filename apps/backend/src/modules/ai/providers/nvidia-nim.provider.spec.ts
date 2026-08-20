import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NvidiaNimProvider } from './nvidia-nim.provider';
import {
  AiProviderException,
  AiProviderUnavailableException,
} from '../exceptions/ai.exceptions';

describe('NvidiaNimProvider', () => {
  let provider: NvidiaNimProvider;
  let fetchMock: jest.Mock;

  const buildModule = async (config: Record<string, unknown>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NvidiaNimProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    return module.get(NvidiaNimProvider);
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports unavailable when NVIDIA_API_KEY is missing', async () => {
    provider = await buildModule({});

    expect(provider.isAvailable()).toBe(false);
    await expect(provider.generateText({ prompt: 'hello' })).rejects.toThrow(
      AiProviderUnavailableException,
    );
  });

  it('reports available when NVIDIA_API_KEY is present', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    expect(provider.isAvailable()).toBe(true);
  });

  it('uses AI_MODEL and NVIDIA_BASE_URL when generating chat', async () => {
    provider = await buildModule({
      NVIDIA_API_KEY: 'nvapi-test-key',
      AI_MODEL: 'openai/gpt-oss-120b',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: 'req-1',
          choices: [{ message: { content: 'hello from nvidia' } }],
        }),
    });

    const result = await provider.generateChat({
      systemInstruction: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
    });

    expect(result.text).toBe('hello from nvidia');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer nvapi-test-key');

    const body = JSON.parse(String(init.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string }>;
    };
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.stream).toBe(false);
    expect(body.messages[0].role).toBe('system');
  });

  it('defaults model to openai/gpt-oss-120b when AI_MODEL is unset', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
        }),
    });

    await provider.generateText({ prompt: 'ping' });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
      model: string;
    };
    expect(body.model).toBe('openai/gpt-oss-120b');
  });

  describe('toOpenAiMessages', () => {
    beforeEach(async () => {
      provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    });

    it('maps user and assistant messages', () => {
      const messages = provider.toOpenAiMessages('sys', [
        { role: 'user', content: 'Create a task' },
        { role: 'assistant', content: 'Sure' },
      ]);
      expect(messages[0]).toEqual({ role: 'system', content: 'sys' });
      expect(messages[1]).toEqual({ role: 'user', content: 'Create a task' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Sure' });
    });

    it('synthesizes assistant tool_calls before tool results', () => {
      const messages = provider.toOpenAiMessages('sys', [
        { role: 'user', content: 'Plan my day' },
        {
          role: 'tool',
          content: '{"success":true}',
          toolName: 'planMyDay',
          toolCallId: 'call_1',
        },
      ]);

      expect(messages[2]).toMatchObject({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'planMyDay', arguments: '{}' },
          },
        ],
      });
      expect(messages[3]).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"success":true}',
      });
    });

    it('appends image parts to the last user message', () => {
      const messages = provider.toOpenAiMessages(
        'sys',
        [{ role: 'user', content: 'What is this?' }],
        [{ base64: 'abc', mimeType: 'image/png', filename: 'a.png' }],
      );
      const user = messages[1] as {
        role: 'user';
        content: Array<{ type: string; image_url?: { url: string } }>;
      };
      expect(Array.isArray(user.content)).toBe(true);
      expect(user.content).toHaveLength(2);
      expect(user.content[1].type).toBe('image_url');
      expect(user.content[1].image_url?.url).toBe(
        'data:image/png;base64,abc',
      );
    });
  });

  describe('toOpenAiTools', () => {
    beforeEach(async () => {
      provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    });

    it('maps tool declarations to OpenAI function tools', () => {
      const tools = provider.toOpenAiTools([
        {
          name: 'createTask',
          description: 'Create a task',
          parametersJsonSchema: {
            type: 'object',
            properties: { title: { type: 'string' } },
          },
        },
        {
          name: 'getTodayCalendar',
          description: 'Today calendar',
          parametersJsonSchema: { type: 'object', properties: {} },
        },
      ]);

      expect(tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'createTask',
            description: 'Create a task',
            parameters: {
              type: 'object',
              properties: { title: { type: 'string' } },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'getTodayCalendar',
            description: 'Today calendar',
            parameters: { type: 'object', properties: {} },
          },
        },
      ]);
    });
  });

  it('parses tool calls from the provider response', async () => {
    provider = await buildModule({
      NVIDIA_API_KEY: 'nvapi-test-key',
      AI_MODEL: 'openai/gpt-oss-120b',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_abc',
                    type: 'function',
                    function: {
                      name: 'createTask',
                      arguments: JSON.stringify({ title: 'Buy milk' }),
                    },
                  },
                ],
              },
            },
          ],
        }),
    });

    const result = await provider.generateChat({
      systemInstruction: 'sys',
      messages: [{ role: 'user', content: 'Create a task to buy milk' }],
      tools: [
        {
          name: 'createTask',
          description: 'Create a task',
          parametersJsonSchema: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.toolCalls).toEqual([
      {
        id: 'call_abc',
        name: 'createTask',
        arguments: { title: 'Buy milk' },
      },
    ]);
    expect(result.text).toBeUndefined();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
      tools: unknown[];
      tool_choice: string;
    };
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe('auto');
  });

  it('maps 401 to AiProviderUnavailableException without leaking the key', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'secret-nvapi-key' });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({ error: { message: 'invalid key secret-nvapi-key' } }),
    });

    await expect(
      provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      }),
    ).rejects.toThrow(AiProviderUnavailableException);

    try {
      await provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      });
    } catch (error) {
      expect(String(error)).not.toContain('secret-nvapi-key');
    }
  });

  it('maps 429 to a rate-limit AiProviderException', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'rate limited' } }),
    });

    await expect(
      provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      }),
    ).rejects.toThrow(/rate limit/i);
  });

  it('maps 404 model unavailable', async () => {
    provider = await buildModule({
      NVIDIA_API_KEY: 'nvapi-test-key',
      AI_MODEL: 'missing/model',
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: { message: 'not found' } }),
    });

    await expect(
      provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      }),
    ).rejects.toThrow(/model is unavailable/i);
  });

  it('maps network failure to AiProviderException', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      }),
    ).rejects.toThrow(AiProviderException);
  });

  it('maps abort/timeout to AiProviderException', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await expect(
      provider.generateChat({
        systemInstruction: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      }),
    ).rejects.toThrow(/timed out/i);
  });

  it('handles malformed tool argument JSON gracefully', async () => {
    provider = await buildModule({ NVIDIA_API_KEY: 'nvapi-test-key' });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_bad',
                    type: 'function',
                    function: {
                      name: 'getTasks',
                      arguments: '{not-json',
                    },
                  },
                ],
              },
            },
          ],
        }),
    });

    const result = await provider.generateChat({
      systemInstruction: 'sys',
      messages: [{ role: 'user', content: 'list tasks' }],
      tools: [
        {
          name: 'getTasks',
          description: 'List tasks',
          parametersJsonSchema: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.toolCalls?.[0]).toEqual({
      id: 'call_bad',
      name: 'getTasks',
      arguments: {},
    });
  });
});
