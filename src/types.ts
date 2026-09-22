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
  notes?: string;
}

/** A named set of assumed annual growth rates, one per asset class. Growth is never
 * attached to a holding — it's a scenario you build and compare, since nobody knows
 * future returns in advance. */
export interface Scenario {
  id: string;
  name: string;
  rates: Record<AssetClass, number>;
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
}

export interface PortfolioState {
  holdings: Holding[];
  transfers: Transfer[];
  settings: PortfolioSettings;
}

function defaultScenario(name: string): Scenario {
  return { id: crypto.randomUUID(), name, rates: { ...DEFAULT_GROWTH_PCT } };
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
