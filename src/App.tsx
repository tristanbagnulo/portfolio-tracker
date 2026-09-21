import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "./context/PortfolioContext";
import { Holding } from "./types";
import { currentPortfolioValue, monthlyContributionRate, projectPortfolio } from "./lib/projection";
import { StatTiles } from "./components/StatTiles";
import { AllocationChart } from "./components/AllocationChart";
import { ProjectionChart } from "./components/ProjectionChart";
import { HoldingsTable } from "./components/HoldingsTable";
import { HoldingForm } from "./components/HoldingForm";
import { SettingsBar } from "./components/SettingsBar";

export default function App() {
  const { state, addHolding, updateHolding, deleteHolding, updateSettings, refreshFx } = usePortfolio();
  const [modalHolding, setModalHolding] = useState<Holding | "new" | null>(null);

  const { baseCurrency, fxRates } = state.settings;

  useEffect(() => {
    // Best-effort initial FX fetch so a freshly loaded portfolio isn't showing
    // stale/missing conversion rates.
    if (state.holdings.length > 0) {
      refreshFx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missingRates = useMemo(
    () => Array.from(new Set(state.holdings.map((h) => h.currency))).filter((c) => !(c in fxRates)),
    [state.holdings, fxRates],
  );

  const current = useMemo(() => currentPortfolioValue(state.holdings, baseCurrency, fxRates), [state.holdings, baseCurrency, fxRates]);
  const monthlyRate = useMemo(
    () => monthlyContributionRate(state.holdings, baseCurrency, fxRates),
    [state.holdings, baseCurrency, fxRates],
  );
  const projection = useMemo(
    () => projectPortfolio(state.holdings, baseCurrency, fxRates, state.settings.projectionHorizonYears),
    [state.holdings, baseCurrency, fxRates, state.settings.projectionHorizonYears],
  );

  function handleSave(holding: Omit<Holding, "id"> | Holding) {
    if ("id" in holding) {
      updateHolding(holding.id, holding);
    } else {
      addHolding(holding);
    }
    setModalHolding(null);
  }

  return (
    <div className="app">
      <div className="app-header">
        <div>
          <h1>Portfolio Tracker</h1>
          <div className="subtitle">Your wealth, across currencies, in one place.</div>
        </div>
        <button className="primary" onClick={() => setModalHolding("new")}>
          + Add holding
        </button>
      </div>

      <SettingsBar />

      {missingRates.length > 0 && (
        <div className="banner">
          No FX rate yet for {missingRates.join(", ")} → {baseCurrency}. Values in that currency are shown unconverted until
          you refresh.
        </div>
      )}

      <StatTiles
        baseCurrency={baseCurrency}
        totalNow={current.totalBase}
        monthlyContribution={monthlyRate}
        holdingsCount={state.holdings.length}
        finalMilestone={projection.milestones[projection.milestones.length - 1]}
      />

      <div className="card">
        <h2>Current allocation</h2>
        <AllocationChart byAssetClass={current.byAssetClass} total={current.totalBase} baseCurrency={baseCurrency} />
      </div>

      <div className="card">
        <h2>Projected wealth</h2>
        <ProjectionChart
          series={projection.series}
          baseCurrency={baseCurrency}
          horizonYears={state.settings.projectionHorizonYears}
          onHorizonChange={(years) => updateSettings({ projectionHorizonYears: years })}
        />
      </div>

      <div className="card">
        <h2>Holdings</h2>
        <HoldingsTable holdings={state.holdings} onEdit={setModalHolding} onDelete={deleteHolding} />
      </div>

      {modalHolding && (
        <HoldingForm
          initial={modalHolding === "new" ? null : modalHolding}
          onSave={handleSave}
          onClose={() => setModalHolding(null)}
        />
      )}

      <div className="footer-note">
        All data stays in this browser (localStorage) — nothing is sent anywhere except live price/FX lookups. Use "Export
        backup" regularly since clearing browser data or switching devices loses it. Growth-rate assumptions are yours to
        set; this isn't financial advice.
      </div>
    </div>
  );
}
