import { useMemo, useRef, useState } from "react";
import { ProjectionPoint } from "../lib/projection";
import { formatCompact, formatMoney } from "../lib/format";

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function ProjectionChart({
  series,
  baseCurrency,
  horizonYears,
  onHorizonChange,
}: {
  series: ProjectionPoint[];
  baseCurrency: string;
  horizonYears: number;
  onHorizonChange: (years: 5 | 10 | 20 | 30) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxValue = useMemo(() => Math.max(...series.map((p) => p.totalBase), 1), [series]);

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (i / (series.length - 1 || 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + plotH - (v / maxValue) * plotH;

  const linePath = useMemo(
    () => series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.totalBase).toFixed(1)}`).join(" "),
    [series, maxValue],
  );

  const areaPath = useMemo(() => {
    if (series.length === 0) return "";
    const top = series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.totalBase).toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + plotH;
    return `${top} L ${xFor(series.length - 1).toFixed(1)} ${baseline} L ${xFor(0).toFixed(1)} ${baseline} Z`;
  }, [series, maxValue]);

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i);

  // Show roughly one x-axis label per 5 years (or fewer if horizon is short).
  const yearStep = horizonYears <= 5 ? 1 : horizonYears <= 10 ? 2 : 5;
  const xTickYears = Array.from({ length: Math.floor(horizonYears / yearStep) + 1 }, (_, i) => i * yearStep);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (relX - PAD_LEFT) / plotW));
    const idx = Math.round(ratio * (series.length - 1));
    setHoverIndex(Math.min(series.length - 1, Math.max(0, idx)));
  }

  const hoverPoint = hoverIndex != null ? series[hoverIndex] : null;

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 8, justifyContent: "space-between" }}>
        <span className="banner" style={{ margin: 0 }}>
          Assumes each holding compounds at its own set growth rate, with contributions as scheduled. FX rates are held at
          today's snapshot for the whole projection.
        </span>
        <div className="horizon-toggle">
          {([5, 10, 20, 30] as const).map((y) => (
            <button key={y} className={y === horizonYears ? "active" : ""} onClick={() => onHorizonChange(y)}>
              {y}y
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label="Projected total portfolio value over time"
        >
          <defs>
            <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-equity)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--series-equity)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTickValues.map((v, i) => (
            <g key={i}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="var(--gridline)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yFor(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatCompact(v, baseCurrency)}
              </text>
            </g>
          ))}

          {xTickYears.map((y) => {
            const idx = Math.min(series.length - 1, y * 12);
            return (
              <text key={y} x={xFor(idx)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {y === 0 ? "Now" : `${y}y`}
              </text>
            );
          })}

          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + plotH}
            y2={PAD_TOP + plotH}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          <path d={areaPath} fill="url(#areaFade)" stroke="none" />
          <path d={linePath} fill="none" stroke="var(--series-equity)" strokeWidth={2} strokeLinejoin="round" />

          {hoverPoint && (
            <>
              <line
                x1={xFor(hoverIndex!)}
                x2={xFor(hoverIndex!)}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                stroke="var(--text-muted)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <circle cx={xFor(hoverIndex!)} cy={yFor(hoverPoint.totalBase)} r={4} fill="var(--series-equity)" />
            </>
          )}
        </svg>

        {hoverPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `min(${(xFor(hoverIndex!) / WIDTH) * 100}%, calc(100% - 140px))`,
              top: 8,
            }}
          >
            <div className="tt-total">{formatMoney(hoverPoint.totalBase, baseCurrency)}</div>
            <div style={{ color: "var(--text-muted)" }}>{hoverPoint.date}</div>
          </div>
        )}
      </div>
    </div>
  );
}
