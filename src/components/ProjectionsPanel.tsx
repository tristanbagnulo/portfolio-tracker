import { useState } from "react";
import { Holding, PortfolioSettings, Scenario } from "../types";
import { projectScenarios } from "../lib/projection";
import { formatCompact } from "../lib/format";
import { ProjectionChart, scenarioColor } from "./ProjectionChart";
import { ScenarioForm } from "./ScenarioForm";
import { ScenarioManager } from "./ScenarioManager";

export function ProjectionsPanel({
  holdings,
  settings,
  onHorizonChange,
  onScenariosChange,
  onVisibleChange,
}: {
  holdings: Holding[];
  settings: PortfolioSettings;
  onHorizonChange: (years: number) => void;
  onScenariosChange: (scenarios: Scenario[]) => void;
  onVisibleChange: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState<Scenario | "new" | null>(null);
  const [managing, setManaging] = useState(false);

  const { baseCurrency, fxRates, scenarios, visibleScenarioIds, projectionHorizonYears: horizon } = settings;
  const visibleScenarios = scenarios.filter((s) => visibleScenarioIds.includes(s.id));
  const results = projectScenarios(holdings, visibleScenarios, baseCurrency, fxRates, horizon);

  function toggleVisible(id: string) {
    if (visibleScenarioIds.includes(id)) {
      if (visibleScenarioIds.length > 1) onVisibleChange(visibleScenarioIds.filter((v) => v !== id));
    } else {
      onVisibleChange([...visibleScenarioIds, id]);
    }
  }

  function saveScenario(scenario: Scenario) {
    const exists = scenarios.some((s) => s.id === scenario.id);
    if (exists) {
      onScenariosChange(scenarios.map((s) => (s.id === scenario.id ? scenario : s)));
    } else {
      if (scenarios.length >= 6) {
        alert("That's plenty to compare at once — delete one first if you want another.");
        return;
      }
      onScenariosChange([...scenarios, scenario]);
      onVisibleChange([...visibleScenarioIds, scenario.id]);
    }
    setEditing(null);
  }

  function deleteScenario(id: string) {
    if (scenarios.length <= 1) return;
    if (!confirm("Delete this scenario?")) return;
    const next = scenarios.filter((s) => s.id !== id);
    onScenariosChange(next);
    const nextVisible = visibleScenarioIds.filter((v) => v !== id);
    onVisibleChange(nextVisible.length ? nextVisible : [next[0].id]);
    setEditing(null);
  }

  return (
    <>
      <section className="card">
        <h2>Time horizon</h2>
        <div className="sr-top">
          <span className="name">Project forward</span>
          <span className="val">{horizon} {horizon === 1 ? "year" : "years"}</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={horizon}
          onChange={(e) => onHorizonChange(Number(e.target.value))}
        />
        <div className="sr-scale">
          <span>1y</span>
          <span>25y</span>
          <span>50y</span>
        </div>
      </section>

      <section className="card">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Scenarios</h2>
          <button className="link-btn" onClick={() => setManaging(true)}>
            Manage
          </button>
        </div>
        <p className="help" style={{ marginBottom: 10 }}>
          No one knows future returns — these are assumptions you set, not predictions. Click a scenario to show or hide it
          on the chart below.
        </p>
        <div className="chips">
          {scenarios.map((s, i) => {
            const active = visibleScenarioIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`chip${active ? " active" : ""}`}
                style={{ "--dotcolor": scenarioColor(i) } as React.CSSProperties}
                onClick={() => toggleVisible(s.id)}
              >
                <span className="dot" style={{ background: scenarioColor(i) }} />
                {s.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Projected wealth</h2>
        <p className="help" style={{ marginTop: -6, marginBottom: 12 }}>
          Every holding compounds monthly at its scenario's rate for its asset class, plus your scheduled contributions.
          Exchange rates are held at today's values for the whole projection.
        </p>
        <ProjectionChart results={results} baseCurrency={baseCurrency} horizonYears={horizon} />
      </section>

      {results.length > 0 && (
        <section className="card">
          <h2>Milestones</h2>
          {results.map((r, i) => (
            <div className="scenario-group" key={r.scenario.id}>
              <div className="sg-title">
                <span className="dot" style={{ background: scenarioColor(i) }} />
                {r.scenario.name}
              </div>
              <div className="milestones">
                {r.milestones.map((m) => (
                  <div className="milestone" key={m.years}>
                    <div className="y">
                      {m.years} YR{m.years === 1 ? "" : "S"}
                    </div>
                    <div className="v">{formatCompact(m.totalBase, baseCurrency)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <ScenarioForm
          initial={editing === "new" ? null : editing}
          canDelete={scenarios.length > 1}
          onSave={saveScenario}
          onDelete={editing !== "new" ? () => deleteScenario(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {managing && (
        <ScenarioManager
          scenarios={scenarios}
          onEdit={(s) => {
            setManaging(false);
            setEditing(s);
          }}
          onDelete={deleteScenario}
          onAdd={() => {
            setManaging(false);
            setEditing("new");
          }}
          onClose={() => setManaging(false)}
        />
      )}
    </>
  );
}
