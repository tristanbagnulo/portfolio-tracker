import { Holding } from "../types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface PriceRefreshResult {
  updated: string[]; // holding ids
  skipped: string[]; // holding ids with no live source available (manual only)
  failed: { id: string; reason: string }[];
}

/** Batch-fetches spot prices from CoinGecko — crypto or a tokenized-commodity id like
 * "pax-gold" alike, CoinGecko treats them identically. `ids` are CoinGecko coin ids
 * (e.g. "bitcoin", not "BTC"). vsCurrency is a lowercase fiat code, e.g. "usd". */
async function fetchCoingeckoPrices(
  ids: string[],
  vsCurrency: string,
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=${encodeURIComponent(vsCurrency)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Record<string, number>>;
  const out: Record<string, number> = {};
  for (const [id, byCurrency] of Object.entries(data)) {
    const price = byCurrency[vsCurrency.toLowerCase()];
    if (typeof price === "number") out[id] = price;
  }
  return out;
}

/** Best-effort equity/ETF price via Yahoo Finance's unofficial chart endpoint. This is
 * an unauthenticated, undocumented API that frequently blocks cross-origin browser
 * requests or changes shape without notice — callers must treat failure as routine,
 * not exceptional, and fall back to manual entry. */
async function fetchEquityPrice(
  symbol: string,
): Promise<{ price: number; currency: string } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const currency = meta?.currency;
    if (typeof price !== "number" || typeof currency !== "string") return null;
    return { price, currency };
  } catch {
    return null; // CORS block, network error, or shape change — manual fallback stands
  }
}

/**
 * Attempts to refresh live prices for every holding that has a lookupSymbol.
 * Crypto AND precious metals both go through CoinGecko (reliable, CORS-open) — gold's
 * lookup id is a tokenized-gold coin (e.g. "pax-gold", pegged ~1:1 to a troy ounce of
 * gold) since CoinGecko doesn't distinguish "coin id" from "commodity id"; the fetch
 * itself is identical either way. Equities/other go through a best-effort Yahoo lookup
 * that may simply fail. Cash/savings has no live source and is always manual entry.
 */
export async function refreshLivePrices(
  holdings: Holding[],
): Promise<{ holdings: Holding[]; result: PriceRefreshResult }> {
  const result: PriceRefreshResult = { updated: [], skipped: [], failed: [] };
  const now = new Date().toISOString();

  const coingeckoHoldings = holdings.filter(
    (h) => h.entryMode === "quantity" && (h.assetClass === "crypto" || h.assetClass === "precious_metal") && h.lookupSymbol,
  );
  const coingeckoByVsCurrency = new Map<string, Holding[]>();
  for (const h of coingeckoHoldings) {
    const vs = h.currency.toLowerCase();
    if (!coingeckoByVsCurrency.has(vs)) coingeckoByVsCurrency.set(vs, []);
    coingeckoByVsCurrency.get(vs)!.push(h);
  }

  const priceById = new Map<string, number>(); // holding id -> new price
  for (const [vs, group] of coingeckoByVsCurrency) {
    const ids = group.map((h) => h.lookupSymbol!).filter(Boolean);
    try {
      const prices = await fetchCoingeckoPrices(ids, vs);
      for (const h of group) {
        const price = prices[h.lookupSymbol!];
        if (typeof price === "number") {
          priceById.set(h.id, price);
        } else {
          result.failed.push({ id: h.id, reason: `No CoinGecko price for id "${h.lookupSymbol}"` });
        }
      }
    } catch (err) {
      for (const h of group) {
        result.failed.push({ id: h.id, reason: err instanceof Error ? err.message : "Fetch failed" });
      }
    }
  }

  const equityHoldings = holdings.filter(
    (h) => h.entryMode === "quantity" && (h.assetClass === "equity" || h.assetClass === "other") && h.lookupSymbol,
  );
  for (const h of equityHoldings) {
    const quote = await fetchEquityPrice(h.lookupSymbol!);
    if (quote && quote.currency === h.currency) {
      priceById.set(h.id, quote.price);
    } else if (quote) {
      result.failed.push({
        id: h.id,
        reason: `Live quote currency (${quote.currency}) doesn't match holding currency (${h.currency})`,
      });
    } else {
      result.failed.push({ id: h.id, reason: "Live lookup unavailable (blocked or symbol not found)" });
    }
  }

  for (const h of holdings) {
    if (!priceById.has(h.id) && !result.failed.some((f) => f.id === h.id)) {
      result.skipped.push(h.id);
    }
  }

  const nextHoldings = holdings.map((h) => {
    const price = priceById.get(h.id);
    if (price == null) return h;
    result.updated.push(h.id);
    const quantity = h.quantity ?? 0;
    return { ...h, price, quantity, value: quantity * price, priceSource: "live" as const, valueUpdatedAt: now };
  });

  return { holdings: nextHoldings, result };
}
