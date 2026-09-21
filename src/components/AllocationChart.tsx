import { ASSET_CLASS_LABELS, AssetClass } from "../types";
import { ASSET_CLASS_COLOR_VAR } from "../lib/colors";
import { formatMoney } from "../lib/format";

const ORDER: AssetClass[] = ["equity", "crypto", "precious_metal", "cash_savings", "other"];

export function AllocationChart({
  byAssetClass,
  total,
  baseCurrency,
}: {
  byAssetClass: Record<AssetClass, number>;
  total: number;
  baseCurrency: string;
}) {
  const rows = ORDER.map((cls) => ({ cls, value: byAssetClass[cls] })).filter((r) => r.value > 0);

  if (rows.length === 0) {
    return <div className="empty-state">Add a holding to see your allocation.</div>;
  }

  return (
    <div>
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <div className="alloc-row" key={r.cls}>
            <span>{ASSET_CLASS_LABELS[r.cls]}</span>
            <div className="alloc-bar-track">
              <div
                className="alloc-bar-fill"
                style={{ width: `${pct}%`, background: ASSET_CLASS_COLOR_VAR[r.cls] }}
              />
            </div>
            <span>
              {formatMoney(r.value, baseCurrency)} <span style={{ color: "var(--text-muted)" }}>({pct.toFixed(0)}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
