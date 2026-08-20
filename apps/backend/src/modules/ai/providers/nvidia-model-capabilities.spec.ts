import { nvidiaModelSupportsImageInput } from './nvidia-model-capabilities';

describe('nvidiaModelSupportsImageInput', () => {
  it('treats openai/gpt-oss-120b as text-only', () => {
    expect(nvidiaModelSupportsImageInput('openai/gpt-oss-120b')).toBe(false);
    expect(nvidiaModelSupportsImageInput('OpenAI/GPT-OSS-120B')).toBe(false);
  });

  it('returns false for unknown / empty models (fail closed)', () => {
    expect(nvidiaModelSupportsImageInput('')).toBe(false);
    expect(nvidiaModelSupportsImageInput('some/unknown-model')).toBe(false);
  });
});
