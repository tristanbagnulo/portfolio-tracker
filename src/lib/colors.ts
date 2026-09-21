import { AssetClass } from "../types";

export const ASSET_CLASS_COLOR_VAR: Record<AssetClass, string> = {
  equity: "var(--series-equity)",
  crypto: "var(--series-crypto)",
  precious_metal: "var(--series-metal)",
  cash_savings: "var(--series-cash)",
  other: "var(--series-other)",
};
