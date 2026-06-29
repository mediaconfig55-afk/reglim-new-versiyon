import { getLocalDateString } from './date';

export interface Cycle {
  id: number;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_length: number | null;
}

export interface PredictionResult {
  averageCycleLength: number;
  averagePeriodLength: number;
  nextPeriodDate: string;
  nextOvulationDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  pregnancyChance: number; // 0 to 100 for today
  confidenceScore: number; // 0 to 100
  isIrregular: boolean;
  futureCycles: {
    startDate: string;
    endDate: string;
    ovulationDate: string;
    fertileStart: string;
    fertileEnd: string;
  }[];
}

/**
 * Adds days to a date string (YYYY-MM-DD) and returns YYYY-MM-DD in a timezone-safe manner.
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Calculates days between two date strings (YYYY-MM-DD) in a timezone-safe manner.
 */
export function getDaysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1.includes('T') ? dateStr1 : `${dateStr1}T00:00:00Z`);
  const d2 = new Date(dateStr2.includes('T') ? dateStr2 : `${dateStr2}T00:00:00Z`);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Smart Period Engine that analyzes past cycles to predict upcoming phases and score accuracy
 */
export function calculatePredictions(
  cycles: Cycle[],
  todayStr: string = getLocalDateString(),
  profileAvgCycle?: number,
  profileAvgPeriod?: number
): PredictionResult {
  const defaultCycleLength = profileAvgCycle && profileAvgCycle >= 15 && profileAvgCycle <= 50 ? profileAvgCycle : 28;
  const defaultPeriodLength = profileAvgPeriod && profileAvgPeriod >= 2 && profileAvgPeriod <= 20 ? profileAvgPeriod : 5;

  // Filter out invalid/incomplete/anomalous cycles for statistical calculations
  const validCycles = cycles
    .filter(c => c.cycle_length !== null && c.cycle_length >= 15 && c.cycle_length <= 50)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()); // oldest to newest

  let avgCycle = defaultCycleLength;
  let avgPeriod = defaultPeriodLength;
  let isIrregular = false;
  let confidenceScore = 50;

  if (validCycles.length > 0) {
    // 1. Calculate weighted averages (giving higher weights to recent cycles)
    let totalCycleWeight = 0;
    let weightedCycleSum = 0;
    let totalPeriodWeight = 0;
    let weightedPeriodSum = 0;

    for (let i = 0; i < validCycles.length; i++) {
      // Weight increases for newer cycles (index increases from oldest to newest)
      const weight = i + 1; 
      
      const c = validCycles[i];
      if (c.cycle_length) {
        weightedCycleSum += c.cycle_length * weight;
        totalCycleWeight += weight;
      }
      if (c.period_length) {
        weightedPeriodSum += c.period_length * weight;
        totalPeriodWeight += weight;
      }
    }

    avgCycle = Math.round(weightedCycleSum / totalCycleWeight) || defaultCycleLength;
    avgPeriod = Math.round(weightedPeriodSum / totalPeriodWeight) || defaultPeriodLength;

    // 2. Calculate regularity (Standard Deviation)
    if (validCycles.length >= 3) {
      const cycleLengths = validCycles.map(c => c.cycle_length as number);
      const mean = cycleLengths.reduce((s, val) => s + val, 0) / cycleLengths.length;
      const variance = cycleLengths.reduce((s, val) => s + Math.pow(val - mean, 2), 0) / cycleLengths.length;
      const stdDev = Math.sqrt(variance);

      isIrregular = stdDev > 3.5; // Irregular if variation is more than 3.5 days

      // Calculate confidence score
      // Starts with base based on log count, then adjusted by variation
      const baseScore = Math.min(85, 50 + validCycles.length * 7); // Max base 85%
      const regularityBonus = isIrregular 
        ? -Math.min(25, Math.round(stdDev * 5)) // Penalty up to -25%
        : Math.max(0, 15 - Math.round(stdDev * 4)); // Bonus up to +15%
      
      confidenceScore = Math.max(40, Math.min(99, baseScore + regularityBonus));
    } else {
      // Sparse data confidence
      confidenceScore = Math.min(75, 50 + validCycles.length * 10);
      isIrregular = false;
    }
  }

  // 3. Find the reference starting point (the most recent cycle start date)
  let lastStartDate = todayStr;
  if (cycles.length > 0) {
    // Sort all by start_date desc to find latest start date
    const sortedAll = [...cycles].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    lastStartDate = sortedAll[0].start_date;
  }

  // 4. Predict the next 6 cycles
  const futureCycles: PredictionResult['futureCycles'] = [];
  let currentRefDate = lastStartDate;

  // If the last start date was in the past and today is after it + cycle length, 
  // we need to shift predictions dynamically to future dates.
  const daysSinceLastStart = getDaysBetween(lastStartDate, todayStr);
  const isLastStartInPast = new Date(lastStartDate).getTime() < new Date(todayStr).getTime();
  
  if (isLastStartInPast && daysSinceLastStart > avgCycle) {
    // Determine how many cycles have theoretically passed and step forward
    const cyclesPassed = Math.floor(daysSinceLastStart / avgCycle);
    currentRefDate = addDays(lastStartDate, cyclesPassed * avgCycle);
  }

  for (let i = 0; i < 6; i++) {
    // The next cycle start date
    const predStart = i === 0 && new Date(currentRefDate).getTime() > new Date(todayStr).getTime()
      ? currentRefDate
      : addDays(currentRefDate, avgCycle * (i === 0 && new Date(currentRefDate).getTime() <= new Date(todayStr).getTime() ? 1 : i));

    if (i > 0) {
      // Future cycles sequence continues from prediction 0
      const prevCycle = futureCycles[i - 1];
      const nextStart = addDays(prevCycle.startDate, avgCycle);
      const nextEnd = addDays(nextStart, avgPeriod - 1);
      const nextOv = addDays(nextStart, avgCycle - 14); // 14 days before next period (start + avgCycle - 14)
      const fertileS = addDays(nextOv, -5);
      const fertileE = addDays(nextOv, 1);

      futureCycles.push({
        startDate: nextStart,
        endDate: nextEnd,
        ovulationDate: nextOv,
        fertileStart: fertileS,
        fertileEnd: fertileE,
      });
    } else {
      // Initial prediction
      const nextEnd = addDays(predStart, avgPeriod - 1);
      const nextOv = addDays(predStart, avgCycle - 14); // 14 days before next period (start + avgCycle - 14)
      const fertileS = addDays(nextOv, -5);
      const fertileE = addDays(nextOv, 1);

      futureCycles.push({
        startDate: predStart,
        endDate: nextEnd,
        ovulationDate: nextOv,
        fertileStart: fertileS,
        fertileEnd: fertileE,
      });
    }
  }

  const primaryPrediction = futureCycles[0];

  // 5. Calculate pregnancy chance for "today"
  // High chance in fertile window (especially 2 days before ovulation up to ovulation day)
  // Low chance elsewhere
  let pregnancyChance = 5; // default baseline
  const today = new Date(todayStr).getTime();
  
  // Find which phase today falls in (using the nearest future cycle or current active cycle prediction)
  for (const c of futureCycles) {
    const fertS = new Date(c.fertileStart).getTime();
    const fertE = new Date(c.fertileEnd).getTime();
    const ov = new Date(c.ovulationDate).getTime();
    
    if (today >= fertS && today <= fertE) {
      // Within fertile window
      const daysToOvulation = Math.round((ov - today) / (1000 * 60 * 60 * 24));
      if (daysToOvulation === 0) {
        pregnancyChance = 95; // Ovulation day
      } else if (daysToOvulation === 1 || daysToOvulation === 2) {
        pregnancyChance = 98; // Peak fertility
      } else if (daysToOvulation > 2) {
        pregnancyChance = 70 + (5 - daysToOvulation) * 5; // high
      } else {
        pregnancyChance = 60; // 1 day after ovulation
      }
      break;
    }
  }

  return {
    averageCycleLength: avgCycle,
    averagePeriodLength: avgPeriod,
    nextPeriodDate: primaryPrediction.startDate,
    nextOvulationDate: primaryPrediction.ovulationDate,
    fertileWindowStart: primaryPrediction.fertileStart,
    fertileWindowEnd: primaryPrediction.fertileEnd,
    pregnancyChance,
    confidenceScore,
    isIrregular,
    futureCycles,
  };
}
