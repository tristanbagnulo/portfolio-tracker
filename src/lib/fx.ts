// Free, no-key, CORS-enabled FX rates (ECB-sourced). Fiat only — crypto/commodity
// prices come from lib/prices.ts and are always denominated in a fiat currency.
const FRANKFURTER_BASE = "https://api.frankfurter.app";
// Independent second provider, tried only if Frankfurter's request itself fails
// (network hiccup, momentary outage) — a "Failed to fetch" on a mobile connection is
// usually transient and would self-heal on the next 5-minute auto-refresh anyway, but
// there's no reason to wait when a second free, no-key, CORS-enabled source exists.
const FALLBACK_BASE = "https://open.er-api.com/v6/latest";

async function fetchFrankfurter(base: string, symbols: string[]): Promise<Record<string, number>> {
  const res = await fetch(
    `${FRANKFURTER_BASE}/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) throw new Error(`FX rate fetch failed (${res.status})`);
  const data = (await res.json()) as { rates: Record<string, number> };
  return data.rates;
}

async function fetchOpenErApi(base: string, symbols: string[]): Promise<Record<string, number>> {
  const res = await fetch(`${FALLBACK_BASE}/${encodeURIComponent(base)}`);
  if (!res.ok) throw new Error(`FX rate fetch failed (${res.status})`);
  const data = (await res.json()) as { result: string; rates: Record<string, number> };
  if (data.result !== "success") throw new Error("FX rate fetch failed (fallback provider)");
  const rates: Record<string, number> = {};
  for (const code of symbols) if (data.rates[code] != null) rates[code] = data.rates[code];
  return rates;
}

/** Returns a map of `currencyCode -> (1 unit of that currency in `base`)`, including `base` itself as 1. */
export async function fetchFxRates(
  base: string,
  targets: string[],
): Promise<Record<string, number>> {
  const symbols = Array.from(new Set(targets.filter((c) => c !== base)));
  const result: Record<string, number> = { [base]: 1 };
  if (symbols.length === 0) return result;

  let rates: Record<string, number>;
  try {
    rates = await fetchFrankfurter(base, symbols);
  } catch {
    rates = await fetchOpenErApi(base, symbols);
  }
  for (const [code, rateFromBase] of Object.entries(rates)) {
    if (rateFromBase > 0) result[code] = 1 / rateFromBase;
  }
  return result;
}

/** Returns null when either currency has no known rate — callers must treat that as
 * "can't convert this yet" (exclude from totals, flag it), never silently pass the
 * raw amount through as if it were already in `toCurrency`. */
export function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (fromRate == null || toRate == null) return null;
  // rates[code] = value of 1 unit of `code` in the settings.baseCurrency at fetch time.
  return (amount * fromRate) / toRate;
}
