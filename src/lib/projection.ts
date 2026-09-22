import { AssetClass, ContributionSchedule, FREQUENCY_PER_YEAR, Holding, Scenario } from "../types";
import { convert } from "./fx";

export interface ProjectionPoint {
  monthIndex: number; // 0 = today
  date: string; // ISO date, first of month
  totalBase: number;
}

export interface Milestone {
  years: number;
  date: string;
  totalBase: number;
}

export interface ScenarioProjection {
  scenario: Scenario;
  series: ProjectionPoint[];
  milestones: Milestone[];
}

/** Normalizes any contribution frequency to an equivalent smooth monthly amount,
 * in the holding's currency. "once" is handled separately since it fires
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

/** Holdings whose currency has a known rate to `baseCurrency` — the rest can't be
 * summed and are surfaced separately by the caller rather than silently dropped. */
export function convertibleHoldings(holdings: Holding[], baseCurrency: string, fxRates: Record<string, number>): Holding[] {
  return holdings.filter((h) => convert(0, h.currency, baseCurrency, fxRates) != null);
}

const EMPTY_BY_CLASS = (): Record<AssetClass, number> => ({
  equity: 0,
  crypto: 0,
  precious_metal: 0,
  cash_savings: 0,
  other: 0,
});

/**
 * Simulates portfolio value month-by-month for one scenario: each holding compounds
 * at that scenario's rate for its asset class and receives its scheduled contributions,
 * converted to the base currency using the CURRENT fx snapshot held constant throughout —
 * a simplification (real exchange rates move), flagged in the UI. Compounding (monthly)
 * is always on; there's no "simple growth" mode.
 */
export function projectScenario(
  holdings: Holding[],
  scenario: Scenario,
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
): { series: ProjectionPoint[]; milestones: Milestone[] } {
  const months = horizonYears * 12;
  const today = startOfMonth(new Date());
  const usable = convertibleHoldings(holdings, baseCurrency, fxRates);

  const nativeValues = new Map<string, number>();
  for (const h of usable) nativeValues.set(h.id, h.value);

  const series: ProjectionPoint[] = [];
  const milestoneMarks = Array.from(new Set([1, 5, 10, 20, 30, horizonYears])).filter(
    (y) => y >= 1 && y <= horizonYears,
  );
  const milestones: Milestone[] = [];

  for (let m = 0; m <= months; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);

    if (m > 0) {
      for (const h of usable) {
        const ratePct = scenario.rates[h.assetClass] ?? 0;
        const rate = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
        const prev = nativeValues.get(h.id)!;
        const contribution = monthlyContributionFor(h, monthDate);
        nativeValues.set(h.id, prev * (1 + rate) + contribution);
      }
    }

    let totalBase = 0;
    for (const h of usable) {
      const nativeValue = nativeValues.get(h.id)!;
      totalBase += convert(nativeValue, h.currency, baseCurrency, fxRates) ?? 0;
    }

    const dateStr = monthDate.toISOString().slice(0, 10);
    series.push({ monthIndex: m, date: dateStr, totalBase });

    if (m % 12 === 0 && milestoneMarks.includes(m / 12)) {
      milestones.push({ years: m / 12, date: dateStr, totalBase });
    }
  }

  return { series, milestones };
}

export function projectScenarios(
  holdings: Holding[],
  scenarios: Scenario[],
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
): ScenarioProjection[] {
  return scenarios.map((scenario) => ({
    scenario,
    ...projectScenario(holdings, scenario, baseCurrency, fxRates, horizonYears),
  }));
}

export function currentPortfolioValue(
  holdings: Holding[],
  baseCurrency: string,
  fxRates: Record<string, number>,
): { totalBase: number; byAssetClass: Record<AssetClass, number>; unconvertedCurrencies: string[] } {
  const byAssetClass = EMPTY_BY_CLASS();
  let totalBase = 0;
  const unconverted = new Set<string>();
  for (const h of holdings) {
    const baseValue = convert(h.value, h.currency, baseCurrency, fxRates);
    if (baseValue == null) {
      unconverted.add(h.currency);
      continue;
    }
    byAssetClass[h.assetClass] += baseValue;
    totalBase += baseValue;
  }
  return { totalBase, byAssetClass, unconvertedCurrencies: Array.from(unconverted) };
}

/** What's actively contributing to the total THIS calendar month — a schedule that
 * starts next month, or already ended, contributes 0 here even though it's part of
 * the plan. This is what the projection engine uses internally, month by month. */
export function monthlyContributionRate(holdings: Holding[], baseCurrency: string, fxRates: Record<string, number>): number {
  const now = startOfMonth(new Date());
  let total = 0;
  for (const h of holdings) {
    const nativeMonthly = monthlyContributionFor(h, now);
    const converted = convert(nativeMonthly, h.currency, baseCurrency, fxRates);
    if (converted != null) total += converted;
  }
  return total;
}

/** The full monthly rate you've committed to across every recurring schedule,
 * regardless of whether it's started yet or already ended — "once" (one-off)
 * schedules aren't a rate and are excluded. This is the "at a glance" number for
 * a stat tile; the projection itself still gates each schedule by its real dates. */
export function plannedMonthlyContribution(
  holdings: Holding[],
  baseCurrency: string,
  fxRates: Record<string, number>,
): number {
  let total = 0;
  for (const h of holdings) {
    const nativeMonthly = h.contributions.reduce((sum, c) => sum + monthlyEquivalent(c), 0);
    const converted = convert(nativeMonthly, h.currency, baseCurrency, fxRates);
    if (converted != null) total += converted;
  }
  return total;
}
