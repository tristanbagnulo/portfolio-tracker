import { TaxTreatment } from "../types";

// The one simplification this whole feature makes: real capital gains tax is a lump
// sum paid when you actually sell, not a smooth monthly drag — modeling that properly
// means tracking cost basis and a realization event, a much bigger feature than "roughly
// how much of this is really mine." Instead, capital-gains growth is taxed continuously
// at half your marginal rate (the same 50% discount the ATO gives an individual who
// holds an asset over 12 months), applied every month rather than deferred to a sale.
export function effectiveTaxRatePct(treatment: TaxTreatment, marginalTaxRatePct: number): number {
  switch (treatment) {
    case "tax_free":
      return 0;
    case "income":
      return marginalTaxRatePct;
    case "capital_gains":
      return marginalTaxRatePct / 2;
  }
}
