import { AssetClass, Holding, Scenario, Transfer } from "../types";
import { convert } from "./fx";
import { amountForMonth, monthlyEquivalent, startOfMonth } from "./schedule";

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

function monthlyContributionFor(holding: Holding, monthDate: Date): number {
  let total = 0;
  for (const s of holding.contributions) total += amountForMonth(s, monthDate);
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
  transfers: Transfer[],
  scenario: Scenario,
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
): { series: ProjectionPoint[]; milestones: Milestone[] } {
  const months = horizonYears * 12;
  const today = startOfMonth(new Date());
  const usable = convertibleHoldings(holdings, baseCurrency, fxRates);
  const usableIds = new Set(usable.map((h) => h.id));
  const byId = new Map(usable.map((h) => [h.id, h]));
  // Only simulate a transfer if both ends are holdings we can actually value —
  // one leg pointing at a deleted or unconvertible holding just gets skipped.
  const relevantTransfers = transfers.filter((t) => usableIds.has(t.fromHoldingId) && usableIds.has(t.toHoldingId));

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

      // Transfers move already-tracked money between two holdings — applied after
      // growth/contributions so a transfer this month moves this month's contributed
      // amount too, not last month's stale balance.
      for (const t of relevantTransfers) {
        const amount = amountForMonth(t, monthDate);
        if (amount === 0) continue;
        const fromHolding = byId.get(t.fromHoldingId)!;
        const toHolding = byId.get(t.toHoldingId)!;
        nativeValues.set(t.fromHoldingId, nativeValues.get(t.fromHoldingId)! - amount);
        const convertedToDest = convert(amount, fromHolding.currency, toHolding.currency, fxRates) ?? 0;
        nativeValues.set(t.toHoldingId, nativeValues.get(t.toHoldingId)! + convertedToDest);
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
  transfers: Transfer[],
  scenarios: Scenario[],
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
): ScenarioProjection[] {
  return scenarios.map((scenario) => ({
    scenario,
    ...projectScenario(holdings, transfers, scenario, baseCurrency, fxRates, horizonYears),
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
