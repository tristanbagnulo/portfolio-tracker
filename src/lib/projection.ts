import { AssetClass, ContributionSchedule, FREQUENCY_PER_YEAR, Holding } from "../types";
import { convert } from "./fx";

export interface ProjectionPoint {
  monthIndex: number; // 0 = today
  date: string; // ISO date, first of month
  totalBase: number;
  byAssetClass: Record<AssetClass, number>;
}

export interface Milestone {
  years: number;
  date: string;
  totalBase: number;
}

/** Normalizes any contribution frequency to an equivalent smooth monthly amount,
 * in the holding's native currency. "once" is handled separately since it fires
 * in a single month rather than repeating — smoothing it would misrepresent it. */
function monthlyEquivalent(schedule: ContributionSchedule): number {
  if (schedule.frequency === "once") return 0;
  return (schedule.amount * FREQUENCY_PER_YEAR[schedule.frequency]) / 12;
}

function isActiveInMonth(schedule: ContributionSchedule, monthDate: Date): boolean {
  const start = new Date(schedule.startDate);
  if (monthDate < startOfMonth(start)) return false;
  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    if (monthDate > startOfMonth(end)) return false;
  }
  return true;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthlyContributionFor(holding: Holding, monthDate: Date): number {
  let total = 0;
  for (const s of holding.contributions) {
    if (s.frequency === "once") {
      if (sameMonth(new Date(s.startDate), monthDate)) total += s.amount;
      continue;
    }
    if (isActiveInMonth(s, monthDate)) total += monthlyEquivalent(s);
  }
  return total;
}

const EMPTY_BY_CLASS = (): Record<AssetClass, number> => ({
  equity: 0,
  crypto: 0,
  precious_metal: 0,
  cash_savings: 0,
  other: 0,
});

/**
 * Simulates portfolio value month-by-month: each holding compounds at its own
 * assumed annual growth rate and receives its scheduled contributions, converted
 * to the base currency using the CURRENT fx snapshot held constant throughout —
 * a simplification (real exchange rates move), flagged in the UI.
 */
export function projectPortfolio(
  holdings: Holding[],
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
): { series: ProjectionPoint[]; milestones: Milestone[] } {
  const months = horizonYears * 12;
  const today = startOfMonth(new Date());

  const nativeValues = new Map<string, number>();
  for (const h of holdings) nativeValues.set(h.id, h.quantity * h.price);

  const series: ProjectionPoint[] = [];
  const milestoneMarks = [1, 5, 10, 20, 30].filter((y) => y <= horizonYears);
  const milestones: Milestone[] = [];

  for (let m = 0; m <= months; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);

    if (m > 0) {
      for (const h of holdings) {
        const rate = Math.pow(1 + h.assumedAnnualGrowthPct / 100, 1 / 12) - 1;
        const prev = nativeValues.get(h.id)!;
        const contribution = monthlyContributionFor(h, monthDate);
        nativeValues.set(h.id, prev * (1 + rate) + contribution);
      }
    }

    const byAssetClass = EMPTY_BY_CLASS();
    let totalBase = 0;
    for (const h of holdings) {
      const nativeValue = nativeValues.get(h.id)!;
      const baseValue = convert(nativeValue, h.currency, baseCurrency, fxRates);
      byAssetClass[h.assetClass] += baseValue;
      totalBase += baseValue;
    }

    series.push({ monthIndex: m, date: monthDate.toISOString().slice(0, 10), totalBase, byAssetClass });

    if (m % 12 === 0 && milestoneMarks.includes(m / 12)) {
      milestones.push({ years: m / 12, date: series[series.length - 1].date, totalBase });
    }
  }

  return { series, milestones };
}

export function currentPortfolioValue(
  holdings: Holding[],
  baseCurrency: string,
  fxRates: Record<string, number>,
): { totalBase: number; byAssetClass: Record<AssetClass, number> } {
  const byAssetClass = EMPTY_BY_CLASS();
  let totalBase = 0;
  for (const h of holdings) {
    const baseValue = convert(h.quantity * h.price, h.currency, baseCurrency, fxRates);
    byAssetClass[h.assetClass] += baseValue;
    totalBase += baseValue;
  }
  return { totalBase, byAssetClass };
}

export function monthlyContributionRate(holdings: Holding[], baseCurrency: string, fxRates: Record<string, number>): number {
  const now = startOfMonth(new Date());
  let total = 0;
  for (const h of holdings) {
    const nativeMonthly = monthlyContributionFor(h, now);
    total += convert(nativeMonthly, h.currency, baseCurrency, fxRates);
  }
  return total;
}
