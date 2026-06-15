import { calculatePredictions, Cycle } from '../utils/periodEngine';

describe('Smart Period Engine Tests', () => {
  const todayStr = '2026-06-13';

  test('should return default predictions when cycle history is empty', () => {
    const emptyCycles: Cycle[] = [];
    const results = calculatePredictions(emptyCycles, todayStr);

    expect(results.averageCycleLength).toBe(28);
    expect(results.averagePeriodLength).toBe(5);
    expect(results.confidenceScore).toBe(50);
    expect(results.isIrregular).toBe(false);
    expect(results.futureCycles.length).toBe(6);
  });

  test('should calculate correct average cycle length for regular logs', () => {
    // 3 completed cycles with start dates 28 days apart
    const regularCycles: Cycle[] = [
      { id: 1, start_date: '2026-03-20', end_date: '2026-03-25', cycle_length: 28, period_length: 5 },
      { id: 2, start_date: '2026-04-17', end_date: '2026-04-22', cycle_length: 28, period_length: 5 },
      { id: 3, start_date: '2026-05-15', end_date: '2026-05-20', cycle_length: 28, period_length: 5 },
    ];

    const results = calculatePredictions(regularCycles, todayStr);

    expect(results.averageCycleLength).toBe(28);
    expect(results.averagePeriodLength).toBe(5);
    expect(results.isIrregular).toBe(false);
    // 3 cycles with high regularity should boost confidence
    expect(results.confidenceScore).toBeGreaterThanOrEqual(75);
  });

  test('should detect irregular cycles and calculate weighted averages', () => {
    // Variable cycle lengths: 22 days, 35 days (varying length)
    const irregularCycles: Cycle[] = [
      { id: 1, start_date: '2026-03-01', end_date: '2026-03-06', cycle_length: 22, period_length: 5 },
      { id: 2, start_date: '2026-03-23', end_date: '2026-03-28', cycle_length: 35, period_length: 5 },
      { id: 3, start_date: '2026-04-27', end_date: '2026-05-02', cycle_length: 28, period_length: 5 },
    ];

    const results = calculatePredictions(irregularCycles, todayStr);

    // Recent cycles have higher weight, so average should lean towards latest cycle length (28)
    expect(results.averageCycleLength).toBeGreaterThanOrEqual(27);
    expect(results.averageCycleLength).toBeLessThanOrEqual(31);
    
    // Low regularity + small log count should flag isIrregular and keep confidence lower
    expect(results.isIrregular).toBe(true);
    expect(results.confidenceScore).toBeLessThanOrEqual(70);
  });
});
