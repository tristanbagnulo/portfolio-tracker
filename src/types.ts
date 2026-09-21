export type AssetClass =
  | "equity"
  | "crypto"
  | "precious_metal"
  | "cash_savings"
  | "other";

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity / stocks",
  crypto: "Crypto",
  precious_metal: "Precious metal",
  cash_savings: "Cash / savings",
  other: "Other",
};

// Default long-run assumptions, fully editable per holding. Not financial advice —
// just a reasonable starting point for a first projection.
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
  amount: number; // in the holding's native currency
  frequency: ContributionFrequency;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate?: string; // ISO date, ongoing if absent (ignored for "once")
  note?: string;
}

export type PriceSource = "manual" | "live";

export interface Holding {
  id: string;
  name: string; // e.g. "Bitcoin", "VAS - Vanguard Australian Shares", "ING Savings Maximiser"
  assetClass: AssetClass;
  currency: string; // ISO code the holding is denominated in, e.g. "USD", "AUD"
  /** Lookup id for live price fetches. CoinGecko coin id for crypto (e.g. "bitcoin"),
   * a Yahoo Finance-style ticker for equities (e.g. "VAS.AX", "AAPL"). Left blank = manual only. */
  lookupSymbol?: string;
  quantity: number; // units held. For cash_savings, use 1 unit and put the balance in price.
  price: number; // current price per unit, in the holding's native currency
  priceSource: PriceSource;
  priceUpdatedAt: string; // ISO datetime
  assumedAnnualGrowthPct: number; // used for projections (also doubles as APY for cash_savings)
  contributions: ContributionSchedule[];
  notes?: string;
}

export interface PortfolioSettings {
  baseCurrency: string;
  fxRates: Record<string, number>; // 1 unit of key currency -> base currency
  fxRatesUpdatedAt?: string;
  projectionHorizonYears: 5 | 10 | 20 | 30;
}

export interface PortfolioState {
  holdings: Holding[];
  settings: PortfolioSettings;
}

export const DEFAULT_SETTINGS: PortfolioSettings = {
  baseCurrency: "AUD",
  fxRates: { AUD: 1 },
  projectionHorizonYears: 20,
};

export const DEFAULT_STATE: PortfolioState = {
  holdings: [],
  settings: DEFAULT_SETTINGS,
};

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
