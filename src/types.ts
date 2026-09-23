export type AssetClass =
  | "equity"
  | "crypto"
  | "precious_metal"
  | "cash_savings"
  | "other";

export const ASSET_CLASSES: AssetClass[] = ["equity", "crypto", "precious_metal", "cash_savings", "other"];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity / stocks",
  crypto: "Crypto",
  precious_metal: "Precious metal",
  cash_savings: "Cash / savings",
  other: "Other",
};

// Starting point for a NEW scenario's sliders. Not a prediction — nobody knows
// future returns; these just have to start somewhere reasonable.
export const DEFAULT_GROWTH_PCT: Record<AssetClass, number> = {
  equity: 7,
  crypto: 15,
  precious_metal: 5,
  cash_savings: 4.5,
  other: 5,
};

export type ContributionFrequency =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "once";

export const FREQUENCY_LABELS: Record<ContributionFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
  once: "One-off",
};

// How many times per year a frequency fires, for normalizing to a monthly rate.
export const FREQUENCY_PER_YEAR: Record<Exclude<ContributionFrequency, "once">, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

export interface ContributionSchedule {
  id: string;
  amount: number; // in the holding's currency
  frequency: ContributionFrequency;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate?: string; // ISO date, ongoing if absent (ignored for "once")
  note?: string;
}

export type EntryMode = "value" | "quantity";
export type PriceSource = "manual" | "live";

// How this holding's GROWTH (never contributions — that's already your post-tax money
// going in) gets taxed in the projection. Deliberately simple labels, not a full ATO
// simulator — see lib/tax.ts for the one approximation this makes (a flat, continuous
// CGT-discount rate rather than modeling tax as a lump sum deferred until you actually
// sell). You choose the treatment per holding because it genuinely varies: bank
// interest is ordinary income, an ATO-recognized capital asset gets the CGT discount,
// and something like an informal family arrangement might be tax-free — or might not;
// that's a real question worth checking with an accountant, not something this app
// decides for you.
export type TaxTreatment = "tax_free" | "income" | "capital_gains";

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  tax_free: "Tax-free",
  income: "Taxed as income",
  capital_gains: "Taxed as capital gain",
};

// Just a starting guess so a new holding isn't left on some arbitrary default — cash
// interest is taxed as ordinary income; everything else here is the kind of asset
// that's normally a CGT event on sale. Always editable per holding.
export function defaultTaxTreatmentForClass(cls: AssetClass): TaxTreatment {
  return cls === "cash_savings" ? "income" : "capital_gains";
}

export interface Holding {
  id: string;
  name: string; // e.g. "Bitcoin", "VAS - Vanguard Australian Shares", "ING Savings Maximiser"
  assetClass: AssetClass;
  currency: string; // ISO code the value/price is denominated in
  entryMode: EntryMode;
  /** Lookup id for live price fetches — only meaningful in "quantity" mode.
   * CoinGecko coin id for crypto (e.g. "bitcoin"), a Yahoo Finance-style ticker
   * for equities (e.g. "VAS.AX", "AAPL"). Left blank = manual only. */
  lookupSymbol?: string;
  quantity?: number; // units held, "quantity" mode only
  price?: number; // price per unit in `currency`, "quantity" mode only
  priceSource?: PriceSource;
  value: number; // canonical current value in `currency` (quantity * price when in that mode)
  valueUpdatedAt: string; // ISO datetime
  contributions: ContributionSchedule[];
  taxTreatment: TaxTreatment;
  notes?: string;
}

// Starting point for a NEW scenario's income-growth slider — not a prediction, just has
// to start somewhere. 10%/yr is an aggressive-but-plausible early/mid-career assumption.
export const DEFAULT_INCOME_GROWTH_PCT = 10;

/** A named set of assumed annual growth rates, one per asset class, plus one assumed
 * annual growth rate for your contribution amounts (`incomeGrowthPct`) — the idea being
 * that if your income grows, what you're able to contribute each month probably does
 * too, rather than staying fixed in nominal dollars for a 20-year projection. Applied
 * uniformly to every contribution schedule regardless of which holding it funds; never
 * attached to a holding itself — this is a scenario you build and compare, since nobody
 * knows future returns (or future income) in advance. */
export interface Scenario {
  id: string;
  name: string;
  rates: Record<AssetClass, number>;
  incomeGrowthPct: number;
}

/** A recurring (or one-off) movement of money from one of your holdings to another —
 * e.g. routinely moving USD from a SoFi savings holding into a Bitcoin holding. This is
 * NOT a contribution: it's a reallocation between assets you already track, so it never
 * changes your total net worth by itself and is never counted in a "money added" stat —
 * only the projection applies it, shrinking the source and growing the destination each
 * month it's active. `amount` is denominated in the source holding's currency; it's
 * converted to the destination's currency at the same held-constant FX snapshot the rest
 * of the projection uses. */
export interface Transfer {
  id: string;
  name?: string; // optional label, e.g. "DCA into Bitcoin"
  fromHoldingId: string;
  toHoldingId: string;
  amount: number;
  frequency: ContributionFrequency;
  startDate: string;
  endDate?: string;
}

export interface PortfolioSettings {
  baseCurrency: string;
  fxRates: Record<string, number>; // 1 unit of key currency -> base currency
  fxRatesUpdatedAt?: string;
  projectionHorizonYears: number; // 1-50
  scenarios: Scenario[];
  visibleScenarioIds: string[];
  autoRefresh: boolean;
  /** Your marginal income tax rate, as a percentage — e.g. include the 2% Medicare
   * levy, exclude HECS/HELP repayments (that's a loan repayment, not a tax rate).
   * You set this yourself; 0 means untaxed projections (today's default, unchanged
   * behavior for anyone who hasn't touched it). Applied only to each holding's
   * projected GROWTH, per its own tax treatment — see types.ts's TaxTreatment. */
  marginalTaxRatePct: number;
}

export interface PortfolioState {
  holdings: Holding[];
  transfers: Transfer[];
  settings: PortfolioSettings;
}

function defaultScenario(name: string): Scenario {
  return { id: crypto.randomUUID(), name, rates: { ...DEFAULT_GROWTH_PCT }, incomeGrowthPct: DEFAULT_INCOME_GROWTH_PCT };
}

export function defaultState(): PortfolioState {
  const base = defaultScenario("Base case");
  return {
    holdings: [],
    transfers: [],
    settings: {
      baseCurrency: "AUD",
      fxRates: { AUD: 1 },
      projectionHorizonYears: 20,
      scenarios: [base],
      visibleScenarioIds: [base.id],
      autoRefresh: true,
      marginalTaxRatePct: 0,
    },
  };
}

// Curated list of common ISO currency codes for the picker. Frankfurter (used for
// live FX) supports these; the list is static so the picker still works offline.
export const CURRENCIES: { code: string; name: string }[] = [
  { code: "AUD", name: "Australian Dollar" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "KRW", name: "South Korean Won" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
];
