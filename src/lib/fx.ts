// Free, no-key, CORS-enabled FX rates (ECB-sourced). Fiat only — crypto/commodity
// prices come from lib/prices.ts and are always denominated in a fiat currency.
const FRANKFURTER_BASE = "https://api.frankfurter.app";

/** Returns a map of `currencyCode -> (1 unit of that currency in `base`)`, including `base` itself as 1. */
export async function fetchFxRates(
  base: string,
  targets: string[],
): Promise<Record<string, number>> {
  const symbols = Array.from(new Set(targets.filter((c) => c !== base)));
  const result: Record<string, number> = { [base]: 1 };
  if (symbols.length === 0) return result;

  const res = await fetch(
    `${FRANKFURTER_BASE}/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) throw new Error(`FX rate fetch failed (${res.status})`);
  const data = (await res.json()) as { rates: Record<string, number> };
  for (const [code, rateFromBase] of Object.entries(data.rates)) {
    if (rateFromBase > 0) result[code] = 1 / rateFromBase;
  }
  return result;
}

export function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (fromRate == null || toRate == null) return amount; // unknown pair — caller should flag this
  // rates[code] = value of 1 unit of `code` in the settings.baseCurrency at fetch time.
  return (amount * fromRate) / toRate;
}
