import { TaxTreatment } from "../types";

// What fraction of marginalTaxRatePct applies to a holding's growth, by treatment.
// Keyed lookup rather than a switch so a treatment value that doesn't match anything
// (old/foreign data that slipped past lib/storage.ts's sanitizeState somehow) falls
// through the `?? 0.5` below instead of silently producing NaN — a single holding with
// an unrecognized treatment previously poisoned every scenario's whole projection this
// way, so this function specifically must never return anything but a real number.
const TREATMENT_FACTOR: Record<TaxTreatment, number> = {
  tax_free: 0,
  income: 1,
  // The one simplification this whole feature makes: real capital gains tax is a lump
  // sum paid when you actually sell, not a smooth monthly drag — modeling that properly
  // means tracking cost basis and a realization event, a much bigger feature than
  // "roughly how much of this is really mine." Instead, capital-gains growth is taxed
  // continuously at half your marginal rate (the same 50% discount the ATO gives an
  // individual who holds an asset over 12 months), applied every month rather than
  // deferred to a sale.
  capital_gains: 0.5,
};

export function effectiveTaxRatePct(treatment: TaxTreatment, marginalTaxRatePct: number): number {
  const factor = TREATMENT_FACTOR[treatment] ?? 0.5;
  return marginalTaxRatePct * factor;
}
