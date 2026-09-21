import { formatMoney } from "../lib/format";
import { Milestone } from "../lib/projection";

export function StatTiles({
  baseCurrency,
  totalNow,
  monthlyContribution,
  holdingsCount,
  finalMilestone,
}: {
  baseCurrency: string;
  totalNow: number;
  monthlyContribution: number;
  holdingsCount: number;
  finalMilestone?: Milestone;
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
      {finalMilestone && (
        <div className="stat-tile">
          <div className="label">Projected in {finalMilestone.years} yrs</div>
          <div className="value">{formatMoney(finalMilestone.totalBase, baseCurrency)}</div>
          <div className="hint">at current assumptions & FX</div>
        </div>
      )}
    </div>
  );
}
