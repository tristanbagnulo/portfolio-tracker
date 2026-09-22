import { formatMoney } from "../lib/format";

export function StatTiles({
  baseCurrency,
  totalNow,
  monthlyContribution,
  holdingsCount,
}: {
  baseCurrency: string;
  totalNow: number;
  monthlyContribution: number;
  holdingsCount: number;
}) {
  return (
    <div className="stat-tiles">
      <div className="stat-tile">
        <div className="label">Current wealth</div>
        <div className="value">{formatMoney(totalNow, baseCurrency)}</div>
        <div className="hint">
          {holdingsCount} holding{holdingsCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="stat-tile">
        <div className="label">Contributing (monthly rate)</div>
        <div className="value">{formatMoney(monthlyContribution, baseCurrency)}</div>
        <div className="hint">normalized across all schedules</div>
      </div>
    </div>
  );
}
