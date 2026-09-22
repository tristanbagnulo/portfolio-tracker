import { useMemo, useState } from "react";
import { ProjectionPoint } from "../lib/projection";
import { formatCompact, formatMoney } from "../lib/format";

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

// Splits the same total-value line the main chart shows into what a typical
// investment-returns projection makes visually obvious: how much of the ending balance
// is money you put in (principal — today's starting value plus every contribution
// since) versus how much compounding actually added (growth). Shown one scenario at a
// time since two stacked breakdowns overlaid would be unreadable.
export function ReturnsBreakdownChart({
  series,
  baseCurrency,
  horizonYears,
  color,
}: {
  series: ProjectionPoint[];
  baseCurrency: string;
  horizonYears: number;
  color: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const seriesLen = series.length;
  const maxValue = useMemo(
    () => Math.max(...series.map((p) => Math.max(p.totalBase, p.contributedBase)), 1),
    [series],
  );

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (i / (seriesLen - 1 || 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + plotH - (v / maxValue) * plotH;
  const yBase = PAD_TOP + plotH;

  const contributedAreaPath = useMemo(() => {
    const top = series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.contributedBase).toFixed(1)}`);
    return [...top, `L ${xFor(seriesLen - 1).toFixed(1)} ${yBase}`, `L ${xFor(0).toFixed(1)} ${yBase}`, "Z"].join(" ");
  }, [series, maxValue]);

  // Growth is only shaded where the scenario is actually ahead of principal — a losing
  // stretch (a negative growth-rate scenario early on) just shows the total line
  // dipping below the contributed line instead of being misrepresented as growth.
  const growthAreaPath = useMemo(() => {
    const top = series.map(
      (p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(Math.max(p.totalBase, p.contributedBase)).toFixed(1)}`,
    );
    const bottom = [...series]
      .reverse()
      .map((p, i) => `L ${xFor(seriesLen - 1 - i).toFixed(1)} ${yFor(p.contributedBase).toFixed(1)}`);
    return [...top, ...bottom, "Z"].join(" ");
  }, [series, maxValue]);

  const totalLinePath = useMemo(
    () => series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.totalBase).toFixed(1)}`).join(" "),
    [series, maxValue],
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

  const hover = hoverIndex != null ? series[hoverIndex] : null;
  const hoverGrowth = hover ? hover.totalBase - hover.contributedBase : 0;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Projected value split into contributed principal and investment growth"
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

        <path d={contributedAreaPath} fill="var(--text-muted)" opacity={0.18} stroke="none" />
        <path d={growthAreaPath} fill={color} opacity={0.28} stroke="none" />

        <path
          d={series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.contributedBase).toFixed(1)}`).join(" ")}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
        <path d={totalLinePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="var(--baseline)"
          strokeWidth={1}
        />

        {hover && hoverIndex != null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--text-muted)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <circle cx={xFor(hoverIndex)} cy={yFor(hover.totalBase)} r={4} fill={color} />
            <circle cx={xFor(hoverIndex)} cy={yFor(hover.contributedBase)} r={3} fill="var(--text-muted)" />
          </>
        )}
      </svg>

      <div className="chart-legend" style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--text-muted)", opacity: 0.5 }} />
          Contributed (your money in)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.6 }} />
          Growth (what compounding added)
        </span>
      </div>

      {hover && (
        <div
          className="chart-tooltip"
          style={{
            left: `min(${(xFor(hoverIndex!) / WIDTH) * 100}%, calc(100% - 190px))`,
            top: 8,
          }}
        >
          <div className="tt-total">Total: {formatMoney(hover.totalBase, baseCurrency)}</div>
          <div>Contributed: {formatMoney(hover.contributedBase, baseCurrency)}</div>
          <div style={{ color: hoverGrowth < 0 ? "var(--critical)" : "var(--text-secondary)" }}>
            Growth: {hoverGrowth < 0 ? "−" : ""}
            {formatMoney(Math.abs(hoverGrowth), baseCurrency)}
          </div>
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{hover.date}</div>
        </div>
      )}
    </div>
  );
}
