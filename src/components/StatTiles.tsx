import { formatMoney } from "../lib/format";

const MASK = "••••••";

export function StatTiles({
  baseCurrency,
  totalNow,
  monthlyContribution,
  holdingsCount,
  wealthRevealed,
  onToggleWealth,
}: {
  baseCurrency: string;
  totalNow: number;
  monthlyContribution: number;
  holdingsCount: number;
  wealthRevealed: boolean;
  onToggleWealth: () => void;
}) {
  return (
    <div className="stat-tiles">
      <div
        className="stat-tile"
        role="button"
        tabIndex={0}
        onClick={onToggleWealth}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggleWealth()}
        style={{ cursor: "pointer" }}
      >
        <div className="label">Current wealth</div>
        <div className="value">{wealthRevealed ? formatMoney(totalNow, baseCurrency) : MASK}</div>
        <div className="hint">
          {holdingsCount} holding{holdingsCount === 1 ? "" : "s"} — {wealthRevealed ? "tap to hide" : "tap to reveal"}
        </div>
      </div>
      <div className="stat-tile">
        <div className="label">Contributing (monthly rate)</div>
        <div className="value">{formatMoney(monthlyContribution, baseCurrency)}</div>
        <div className="hint">everything you've scheduled, even if it hasn't started yet</div>
      </div>
    </div>
  );
}
