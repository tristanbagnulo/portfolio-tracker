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
