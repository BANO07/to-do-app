import { AiUsageRepository } from './ai-usage.repository';

describe('AiUsageRepository', () => {
  const repository = {
    findOne: jest.fn(),
    query: jest.fn(),
  };

  let aiUsageRepository: AiUsageRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    aiUsageRepository = new AiUsageRepository(repository as any);
  });

  it('uses atomic upsert SQL for daily consumption', async () => {
    repository.query.mockResolvedValue([{ request_count: 1 }]);

    const count = await aiUsageRepository.consumeDailyRequest(
      'user-1',
      '2026-08-19',
      20,
    );

    expect(count).toBe(1);
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id, usage_date)'),
      ['user-1', '2026-08-19', 20],
    );
    expect(repository.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ai_usage.request_count < $3'),
      ['user-1', '2026-08-19', 20],
    );
  });

  it('returns null when the daily limit has already been reached', async () => {
    repository.query.mockResolvedValue([]);

    const count = await aiUsageRepository.consumeDailyRequest(
      'user-1',
      '2026-08-19',
      20,
    );

    expect(count).toBeNull();
  });
});
