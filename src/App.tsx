import { useEffect, useMemo, useState } from "react";
import { usePortfolio } from "./context/PortfolioContext";
import { Holding, Scenario, Transfer } from "./types";
import { currentPortfolioValue, plannedMonthlyContribution } from "./lib/projection";
import { StatTiles } from "./components/StatTiles";
import { AllocationChart } from "./components/AllocationChart";
import { HoldingsTable } from "./components/HoldingsTable";
import { HoldingForm } from "./components/HoldingForm";
import { SettingsBar } from "./components/SettingsBar";
import { ProjectionsPanel } from "./components/ProjectionsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { FxRateModal } from "./components/FxRateModal";
import { TransfersList } from "./components/TransfersList";
import { TransferForm } from "./components/TransferForm";
import { LoadIssueBanner } from "./components/LoadIssueBanner";
import { CloudSyncBar } from "./components/CloudSyncBar";
import { BuildBadge } from "./components/BuildBadge";
import { formatDate } from "./lib/format";

type Tab = "holdings" | "projections" | "history";

export default function App() {
  const {
    state,
    saveHolding,
    deleteHolding,
    saveTransfer,
    deleteTransfer,
    updateSettings,
    refreshAll,
    loadIssue,
    dismissLoadIssue,
    importData,
  } = usePortfolio();
  const [modalHolding, setModalHolding] = useState<Holding | "new" | null>(null);
  const [modalTransfer, setModalTransfer] = useState<Transfer | "new" | null>(null);
  const [editingFxCurrency, setEditingFxCurrency] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("holdings");

  const { baseCurrency, fxRates } = state.settings;

  useEffect(() => {
    // Best-effort initial refresh so a freshly loaded portfolio isn't showing
    // stale/missing prices or conversion rates.
    if (state.holdings.length > 0) {
      refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => currentPortfolioValue(state.holdings, baseCurrency, fxRates), [state.holdings, baseCurrency, fxRates]);
  const monthlyRate = useMemo(
    () => plannedMonthlyContribution(state.holdings, baseCurrency, fxRates),
    [state.holdings, baseCurrency, fxRates],
  );

  const staleHoldings = state.holdings.filter((h) => (Date.now() - new Date(h.valueUpdatedAt).getTime()) / 86400000 > 30);

  function handleSave(holding: Omit<Holding, "id"> | Holding) {
    // saveHolding also tries to fetch a live price/rate for it immediately,
    // rather than waiting for the next 5-minute tick.
    saveHolding(holding);
    setModalHolding(null);
  }

  function handleDeleteFromForm() {
    if (modalHolding && modalHolding !== "new") {
      if (!confirm("Delete this holding? This can't be undone.")) return;
      deleteHolding(modalHolding.id);
      setModalHolding(null);
    }
  }

  function handleSaveTransfer(transfer: Omit<Transfer, "id"> | Transfer) {
    saveTransfer(transfer);
    setModalTransfer(null);
  }

  function handleDeleteTransfer() {
    if (modalTransfer && modalTransfer !== "new") {
      if (!confirm("Delete this transfer? This can't be undone.")) return;
      deleteTransfer(modalTransfer.id);
      setModalTransfer(null);
    }
  }

  return (
    <div className="app">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
        <BuildBadge />
        <CloudSyncBar />
      </div>
      <div className="app-header">
        <div>
          <h1>Portfolio Tracker</h1>
          <div className="subtitle">Your wealth, across currencies, in one place.</div>
        </div>
        <button className="primary" onClick={() => setModalHolding("new")}>
          + Add holding
        </button>
      </div>

      {loadIssue && (
        <LoadIssueBanner issue={loadIssue} onDismiss={dismissLoadIssue} onImport={importData} />
      )}

      <SettingsBar />

      <div className="tabbar">
        <button className={tab === "holdings" ? "active" : ""} onClick={() => setTab("holdings")}>
          Holdings
        </button>
        <button className={tab === "projections" ? "active" : ""} onClick={() => setTab("projections")}>
          Projections
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          History
        </button>
      </div>

      {tab === "holdings" && (
        <>
          {current.unconvertedCurrencies.length > 0 && (
            <div className="banner">
              No exchange rate yet for {current.unconvertedCurrencies.join(", ")} → {baseCurrency}. Those holdings are left
              out of the total until a live refresh succeeds, or you{" "}
              <button className="link-btn" onClick={() => setEditingFxCurrency(current.unconvertedCurrencies[0])}>
                set one manually
              </button>
              .
            </div>
          )}
          {staleHoldings.length > 0 && (
            <div className="banner">
              {staleHoldings.length} value{staleHoldings.length === 1 ? "" : "s"} haven't updated in 30+ days (no live
              source for that asset, or refresh hasn't run) —{" "}
              <button className="link-btn" onClick={() => setModalHolding(staleHoldings[0])}>
                review
              </button>
              .
            </div>
          )}

          <StatTiles
            baseCurrency={baseCurrency}
            totalNow={current.totalBase}
            monthlyContribution={monthlyRate}
            holdingsCount={state.holdings.length}
          />

          <div className="card">
            <h2>Allocation</h2>
            <AllocationChart byAssetClass={current.byAssetClass} total={current.totalBase} baseCurrency={baseCurrency} />
          </div>

          {(() => {
            const needed = Array.from(new Set(state.holdings.map((h) => h.currency).filter((c) => c !== baseCurrency)));
            if (!needed.length) return null;
            return (
              <div className="card">
                <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <h2 style={{ margin: 0 }}>Exchange rates</h2>
                  <span className="help">to {baseCurrency}</span>
                </div>
                {needed.map((c) => (
                  <div
                    key={c}
                    className="fx-row"
                    style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--gridline)", cursor: "pointer" }}
                    onClick={() => setEditingFxCurrency(c)}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {c} → {baseCurrency}
                    </span>
                    <span>{fxRates[c] != null ? `1 ${c} = ${fxRates[c]} ${baseCurrency}` : "not set"}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="card">
            <h2>Holdings</h2>
            <HoldingsTable holdings={state.holdings} onEdit={setModalHolding} onDelete={deleteHolding} />
          </div>

          <TransfersList
            transfers={state.transfers}
            holdings={state.holdings}
            onEdit={setModalTransfer}
            onAdd={() => setModalTransfer("new")}
          />
        </>
      )}

      {tab === "projections" && (
        <ProjectionsPanel
          holdings={state.holdings}
          transfers={state.transfers}
          settings={state.settings}
          onHorizonChange={(years) => updateSettings({ projectionHorizonYears: years })}
          onScenariosChange={(scenarios: Scenario[]) => updateSettings({ scenarios })}
          onVisibleChange={(visibleScenarioIds: string[]) => updateSettings({ visibleScenarioIds })}
        />
      )}

      {tab === "history" && <HistoryPanel />}

      {modalHolding && (
        <HoldingForm
          initial={modalHolding === "new" ? null : modalHolding}
          baseCurrency={baseCurrency}
          fxRates={fxRates}
          onSave={handleSave}
          onDelete={modalHolding !== "new" ? handleDeleteFromForm : undefined}
          onClose={() => setModalHolding(null)}
        />
      )}

      {modalTransfer && (
        <TransferForm
          initial={modalTransfer === "new" ? null : modalTransfer}
          holdings={state.holdings}
          onSave={handleSaveTransfer}
          onDelete={modalTransfer !== "new" ? handleDeleteTransfer : undefined}
          onClose={() => setModalTransfer(null)}
        />
      )}

      {editingFxCurrency && (
        <FxRateModal
          currency={editingFxCurrency}
          baseCurrency={baseCurrency}
          currentRate={fxRates[editingFxCurrency]}
          holdings={state.holdings}
          onSave={(rate) => {
            updateSettings({
              fxRates: { ...fxRates, [editingFxCurrency]: rate },
              fxRatesUpdatedAt: new Date().toISOString(),
            });
            setEditingFxCurrency(null);
          }}
          onClose={() => setEditingFxCurrency(null)}
        />
      )}

      <div className="footer-note">
        Data is kept in this browser (localStorage) and, if you sign in above, backed up to your private Firebase account
        too — nothing else is sent anywhere except live price/FX lookups (CoinGecko for crypto, Frankfurter for FX, both
        anonymous — no portfolio data leaves your device unless you sign in). Signed out, "Export backup" is worth doing
        regularly since clearing browser data or switching devices loses it.
        {state.settings.fxRatesUpdatedAt && <> FX rates as of {formatDate(state.settings.fxRatesUpdatedAt)}.</>}
      </div>
    </div>
  );
}
