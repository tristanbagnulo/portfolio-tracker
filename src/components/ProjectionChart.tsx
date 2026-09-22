import { useMemo, useState } from "react";
import { ScenarioProjection } from "../lib/projection";
import { formatCompact, formatMoney } from "../lib/format";
import { SCENARIO_COLOR_VARS } from "../lib/colors";

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function scenarioColor(index: number): string {
  return SCENARIO_COLOR_VARS[index % SCENARIO_COLOR_VARS.length];
}

export function ProjectionChart({
  results,
  baseCurrency,
  horizonYears,
}: {
  results: ScenarioProjection[];
  baseCurrency: string;
  horizonYears: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const seriesLen = results[0]?.series.length ?? 0;
  const maxValue = useMemo(
    () => Math.max(...results.flatMap((r) => r.series.map((p) => p.totalBase)), 1),
    [results],
  );

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (i / (seriesLen - 1 || 1)) * plotW;
  const yFor = (v: number) => PAD_TOP + plotH - (v / maxValue) * plotH;

  const linePaths = useMemo(
    () =>
      results.map((r) =>
        r.series.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.totalBase).toFixed(1)}`).join(" "),
      ),
    [results, maxValue],
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

  if (results.length === 0) {
    return <div className="empty-state">Select at least one scenario above.</div>;
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Projected total portfolio value over time, by scenario"
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

        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="var(--baseline)"
          strokeWidth={1}
        />

        {results.map((r, i) => (
          <path key={r.scenario.id} d={linePaths[i]} fill="none" stroke={scenarioColor(i)} strokeWidth={2} strokeLinejoin="round" />
        ))}

        {hoverIndex != null && (
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
            {results.map((r, i) => (
              <circle
                key={r.scenario.id}
                cx={xFor(hoverIndex)}
                cy={yFor(r.series[hoverIndex].totalBase)}
                r={4}
                fill={scenarioColor(i)}
              />
            ))}
          </>
        )}
      </svg>

      {hoverIndex != null && (
        <div
          className="chart-tooltip"
          style={{
            left: `min(${(xFor(hoverIndex) / WIDTH) * 100}%, calc(100% - 170px))`,
            top: 8,
          }}
        >
          {results.map((r, i) => (
            <div className="tt-total" key={r.scenario.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: scenarioColor(i), flex: "none" }} />
              {r.scenario.name}: {formatMoney(r.series[hoverIndex].totalBase, baseCurrency)}
            </div>
          ))}
          <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{results[0].series[hoverIndex].date}</div>
        </div>
      )}
    </div>
  );
}
