// Published ATO figures for the 2026-27 Australian financial year (1 Jul 2026 – 30 Jun
// 2027), verified against ato.gov.au and cross-checked with several accounting-firm
// summaries. These change with legislation (most recently the 16%→15% bottom-bracket
// cut effective 1 Jul 2026) — worth reconfirming against ato.gov.au if this has been
// sitting unused for a while.
export const TAX_YEAR_LABEL = "2026-27";

interface Bracket {
  upTo: number; // inclusive
  rate: number; // percent
}

const RESIDENT_BRACKETS: Bracket[] = [
  { upTo: 18200, rate: 0 },
  { upTo: 45000, rate: 15 },
  { upTo: 135000, rate: 30 },
  { upTo: 190000, rate: 37 },
  { upTo: Infinity, rate: 45 },
];

const MEDICARE_LEVY_PCT = 2;

// Singles thresholds only. The Medicare Levy Surcharge uses COMBINED income for
// couples/families, which isn't modeled here — a family should use the ATO's own MLS
// calculator instead for the surcharge tier, though the income-tax-bracket + Medicare
// levy part below is the same regardless.
const MLS_SINGLE_TIERS: Bracket[] = [
  { upTo: 105000, rate: 0 },
  { upTo: 123000, rate: 1 },
  { upTo: 164000, rate: 1.25 },
  { upTo: Infinity, rate: 1.5 },
];

function bracketRate(income: number, brackets: Bracket[]): number {
  for (const b of brackets) if (income <= b.upTo) return b.rate;
  return brackets[brackets.length - 1].rate;
}

export interface MarginalRateBreakdown {
  bracketPct: number;
  medicareLevyPct: number;
  surchargePct: number;
  totalPct: number;
}

/**
 * An Australian resident's marginal tax rate on their NEXT dollar earned — income tax
 * bracket + the 2% Medicare levy + the Medicare Levy Surcharge (only if uninsured and
 * over the threshold for their income). This is deliberately narrow: not total tax
 * payable, not HECS/HELP (that's a loan repayment, not a tax rate), not the private
 * health insurance rebate, not the low-income Medicare levy reduction. It answers one
 * question — "what fraction of an extra dollar of INVESTMENT GROWTH would tax take" —
 * which is exactly what Settings' "Your tax rate" field needs.
 */
export function estimateMarginalRatePct(annualIncome: number, hasPrivateHospitalCover: boolean): MarginalRateBreakdown {
  const bracketPct = bracketRate(annualIncome, RESIDENT_BRACKETS);
  const surchargePct = hasPrivateHospitalCover ? 0 : bracketRate(annualIncome, MLS_SINGLE_TIERS);
  return {
    bracketPct,
    medicareLevyPct: MEDICARE_LEVY_PCT,
    surchargePct,
    totalPct: bracketPct + MEDICARE_LEVY_PCT + surchargePct,
  };
}
