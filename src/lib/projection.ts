import { AssetClass, Holding, Scenario, Transfer } from "../types";
import { convert } from "./fx";
import { amountForMonth, monthlyEquivalent, startOfMonth } from "./schedule";
import { effectiveTaxRatePct } from "./tax";

export interface ProjectionPoint {
  monthIndex: number; // 0 = today
  date: string; // ISO date, first of month
  totalBase: number;
  /** Net principal: today's starting value plus every contribution since (withdrawals
   * subtract), converted at the same held-constant fx snapshot as everything else.
   * Transfers don't touch this — moving money between two of your own holdings isn't
   * new principal in or out of the portfolio. `totalBase - contributedBase` is what a
   * "returns projection" calls growth: the part compounding actually added. */
  contributedBase: number;
}

export interface Milestone {
  years: number;
  date: string;
  totalBase: number;
  contributedBase: number;
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
 * is always on; there's no "simple growth" mode. `marginalTaxRatePct` (0 = untaxed,
 * today's default) is applied to each month's GROWTH only — never to contributions,
 * that's already post-tax money — at a rate scaled per holding by its tax treatment;
 * see lib/tax.ts. Every contribution amount also grows at the scenario's
 * `incomeGrowthPct` (compounding annually from today) — a fixed monthly dollar amount
 * 20 years out assuming income never changes isn't realistic. Transfers are exempt:
 * they move money you already have, not new money in from income.
 */
export function projectScenario(
  holdings: Holding[],
  transfers: Transfer[],
  scenario: Scenario,
  baseCurrency: string,
  fxRates: Record<string, number>,
  horizonYears: number,
  marginalTaxRatePct: number,
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

  let contributedBase = 0;
  for (const h of usable) contributedBase += convert(h.value, h.currency, baseCurrency, fxRates) ?? 0;

  const series: ProjectionPoint[] = [];
  const milestoneMarks = Array.from(new Set([1, 5, 10, 20, 30, horizonYears])).filter(
    (y) => y >= 1 && y <= horizonYears,
  );
  const milestones: Milestone[] = [];

  for (let m = 0; m <= months; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);

    if (m > 0) {
      // Compounds from today regardless of when an individual contribution schedule
      // starts — the assumption is "income grows over time," not "income grows only
      // once this particular contribution kicks in."
      const incomeGrowthFactor = Math.pow(1 + (scenario.incomeGrowthPct ?? 0) / 100, m / 12);

      for (const h of usable) {
        const ratePct = scenario.rates[h.assetClass] ?? 0;
        const grossRate = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
        const prev = nativeValues.get(h.id)!;
        const taxRatePct = effectiveTaxRatePct(h.taxTreatment, marginalTaxRatePct);
        const afterTaxGrowth = prev * grossRate * (1 - taxRatePct / 100);
        const contribution = monthlyContributionFor(h, monthDate) * incomeGrowthFactor;
        nativeValues.set(h.id, prev + afterTaxGrowth + contribution);
        contributedBase += convert(contribution, h.currency, baseCurrency, fxRates) ?? 0;
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
    series.push({ monthIndex: m, date: dateStr, totalBase, contributedBase });

    if (m % 12 === 0 && milestoneMarks.includes(m / 12)) {
      milestones.push({ years: m / 12, date: dateStr, totalBase, contributedBase });
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
  marginalTaxRatePct: number,
): ScenarioProjection[] {
  return scenarios.map((scenario) => ({
    scenario,
    ...projectScenario(holdings, transfers, scenario, baseCurrency, fxRates, horizonYears, marginalTaxRatePct),
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
