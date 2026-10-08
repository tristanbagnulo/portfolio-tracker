import { useMemo, useState } from "react";
import { Holding } from "../types";
import { ProjectionPoint } from "../lib/projection";
import { formatCompact, formatMoney } from "../lib/format";
import { holdingColor } from "../lib/colors";

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const MAX_SLOTS = 8; // the validated categorical palette's hard ceiling — see lib/colors.ts

interface Band {
  id: string;
  name: string;
  color: string;
}

/**
 * The same total the main chart and the returns breakdown already show, split into the
 * individual holdings that make it up — a stacked area, one band per holding, so it's
 * visible which holdings are actually doing the work rather than just the aggregate.
 * One scenario at a time: stacking every scenario's holdings at once would be
 * unreadable (see the returns-breakdown chart for the same reasoning). Beyond 8
 * holdings — the categorical palette's ceiling — the rest fold into a single "Other
 * holdings" band rather than generating a 9th hue.
 */
export function HoldingsBreakdownChart({
  series,
  holdings,
  baseCurrency,
  horizonYears,
}: {
  series: ProjectionPoint[];
  holdings: Holding[];
  baseCurrency: string;
  horizonYears: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const seriesLen = series.length;

  // Stable order (matches the Holdings table), limited to holdings the projection
  // actually included (convertible ones), folding the tail into "Other holdings".
  const bands: Band[] = useMemo(() => {
    const present = holdings.filter((h) => series[0]?.byHolding[h.id] != null);
    const named = present.slice(0, MAX_SLOTS).map((h, i) => ({ id: h.id, name: h.name, color: holdingColor(i) }));
    if (present.length > MAX_SLOTS) {
      named.push({ id: "__other__", name: "Other holdings", color: holdingColor(MAX_SLOTS) });
    }
    return named;
  }, [holdings, series]);

  const valueFor = (point: ProjectionPoint, band: Band): number => {
    if (band.id !== "__other__") return point.byHolding[band.id] ?? 0;
    const named = new Set(bands.filter((b) => b.id !== "__other__").map((b) => b.id));
    let sum = 0;
    for (const [id, v] of Object.entries(point.byHolding)) if (!named.has(id)) sum += v;
    return sum;
  };

  // Same split the "Returns breakdown" chart shows for the portfolio total, per band —
  // how much of this holding's value is principal that was put in (directly, or shifted
  // in by a transfer) versus what compounding actually grew it by.
  const contributedFor = (point: ProjectionPoint, band: Band): number => {
    if (band.id !== "__other__") return point.contributedByHolding[band.id] ?? 0;
    const named = new Set(bands.filter((b) => b.id !== "__other__").map((b) => b.id));
    let sum = 0;
    for (const [id, v] of Object.entries(point.contributedByHolding)) if (!named.has(id)) sum += v;
    return sum;
  };

  // Cumulative stack boundaries per month, bottom-up — clamped at 0 per band so a
  // holding that dips negative (e.g. drawn down hard by transfers) doesn't distort the
  // stack shape; the total line elsewhere in Projections remains the source of truth.
  const stacks = useMemo(
    () =>
      series.map((point) => {
        let cum = 0;
        return bands.map((band) => {
          const v = Math.max(0, valueFor(point, band));
          const bottom = cum;
          cum += v;
          return { bottom, top: cum };
        });
      }),
    [series, bands],
  );

  const maxValue = useMemo(() => Math.max(...stacks.map((s) => s[s.length - 1]?.top ?? 0), 1), [stacks]);

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xFor = (i: number) => PAD_LEFT + (i / (seriesLen - 1 || 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + plotH - (v / maxValue) * plotH;

  const bandPaths = useMemo(
    () =>
      bands.map((_, bi) => {
        const top = series.map((_, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(stacks[i][bi].top).toFixed(1)}`);
        const bottom = [...series]
          .map((_, i) => i)
          .reverse()
          .map((i) => `L ${xFor(i).toFixed(1)} ${yFor(stacks[i][bi].bottom).toFixed(1)}`);
        return [...top, ...bottom, "Z"].join(" ");
      }),
    [bands, series, stacks, maxValue],
  );

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i);
  const yearStep = horizonYears <= 5 ? 1 : horizonYears <= 10 ? 2 : horizonYears <= 20 ? 5 : 10;
  const xTickYears = Array.from({ length: Math.floor(horizonYears / yearStep) + 1 }, (_, i) => i * yearStep);
  if (xTickYears[xTickYears.length - 1] !== horizonYears) xTickYears.push(horizonYears);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (relX - PAD_LEFT) / plotW));
    const idx = Math.round(ratio * (seriesLen - 1));
    setHoverIndex(Math.min(seriesLen - 1, Math.max(0, idx)));
  }

  if (bands.length === 0) {
    return <div className="empty-state">No convertible holdings to break down yet.</div>;
  }

  const hoverPoint = hoverIndex != null ? series[hoverIndex] : null;
  const lastPoint = series[series.length - 1];

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Projected total value broken down by individual holding"
      >
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="var(--gridline)" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yFor(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {formatCompact(v, baseCurrency)}
            </text>
          </g>
        ))}

        {xTickYears.map((y) => {
          const idx = Math.min(seriesLen - 1, y * 12);
          return (
            <text key={y} x={xFor(idx)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {y === 0 ? "Now" : `${y}y`}
            </text>
          );
        })}

        {/* 2px surface-color gap between stacked bands, per band boundary */}
        {bands.map((band, bi) => (
          <path key={band.id} d={bandPaths[bi]} fill={band.color} opacity={0.75} stroke="var(--surface-1)" strokeWidth={2} />
        ))}

        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="var(--baseline)"
          strokeWidth={1}
        />

        {hoverIndex != null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        )}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        {bands.map((band) => (
          <span key={band.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: band.color, flex: "none" }} />
            {band.name}
          </span>
        ))}
      </div>

      {/* Visible by default (not hover-only) — contributed vs. growth per holding, at
          the end of the horizon, so it's there to see without having to find the chart's
          right edge. */}
      {lastPoint && (
        <table style={{ width: "100%", marginTop: 10, fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "right" }}>
              <th style={{ textAlign: "left", fontWeight: 400, paddingBottom: 4 }}>Holding</th>
              <th style={{ fontWeight: 400, paddingBottom: 4 }}>Total</th>
              <th style={{ fontWeight: 400, paddingBottom: 4 }}>Contributed</th>
              <th style={{ fontWeight: 400, paddingBottom: 4 }}>Growth</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => {
              const total = valueFor(lastPoint, band);
              const contributed = contributedFor(lastPoint, band);
              const growth = total - contributed;
              return (
                <tr key={band.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: band.color, flex: "none" }} />
                    {band.name}
                  </td>
                  <td style={{ textAlign: "right" }}>{formatCompact(total, baseCurrency)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{formatCompact(contributed, baseCurrency)}</td>
                  <td style={{ textAlign: "right", color: growth < 0 ? "var(--critical)" : "var(--text-secondary)" }}>
                    {growth < 0 ? "−" : ""}
                    {formatCompact(Math.abs(growth), baseCurrency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hoverPoint && hoverIndex != null && (
        <div
          className="chart-tooltip"
          style={{
            left: `min(${(xFor(hoverIndex) / WIDTH) * 100}%, calc(100% - 190px))`,
            top: 8,
          }}
        >
          <div className="tt-total">Total: {formatMoney(hoverPoint.totalBase, baseCurrency)}</div>
          {bands.map((band) => (
            <div key={band.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: band.color, flex: "none" }} />
              {band.name}: {formatMoney(valueFor(hoverPoint, band), baseCurrency)}
            </div>
          ))}
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{hoverPoint.date}</div>
        </div>
      )}
    </div>
  );
}
