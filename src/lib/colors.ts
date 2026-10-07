import { AssetClass } from "../types";

export const ASSET_CLASS_COLOR_VAR: Record<AssetClass, string> = {
  equity: "var(--series-equity)",
  crypto: "var(--series-crypto)",
  precious_metal: "var(--series-metal)",
  cash_savings: "var(--series-cash)",
  other: "var(--series-other)",
};

// Reused for scenario identity on the projection chart — a different encoding than
// asset-class color, so the same five fixed hues are safe to reuse (never shown together).
export const SCENARIO_COLOR_VARS = [
  "var(--series-equity)",
  "var(--series-crypto)",
  "var(--series-metal)",
  "var(--series-cash)",
  "var(--series-other)",
];

// Full validated 8-slot categorical palette, fixed order, for per-HOLDING identity on
// the holdings-breakdown chart — a third, independent use of the same hues (never
// shown in the same legend as asset-class or scenario color). A portfolio can easily
// hold more individual assets than there are asset classes, so this needs its own
// slots 6-8 beyond the 5 already used for asset class. Never cycle past slot 8 — a 9th
// holding folds into "Other holdings" instead of generating a new hue.
export const HOLDING_COLOR_VARS = [
  "var(--series-equity)",
  "var(--series-crypto)",
  "var(--series-metal)",
  "var(--series-cash)",
  "var(--series-other)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function holdingColor(index: number): string {
  return index < HOLDING_COLOR_VARS.length ? HOLDING_COLOR_VARS[index] : "var(--text-muted)";
}
