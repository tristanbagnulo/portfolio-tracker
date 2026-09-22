import { useRef } from "react";
import { CURRENCIES } from "../types";
import { usePortfolio } from "../context/PortfolioContext";
import { formatDate } from "../lib/format";

export function SettingsBar() {
  const {
    state,
    updateSettings,
    refreshAll,
    fxStatus,
    fxError,
    priceStatus,
    lastRefreshedAt,
    lastPriceResult,
    exportData,
    importData,
  } = usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshing = priceStatus === "loading" || fxStatus === "loading";

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(String(reader.result));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Import failed");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="card">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div className="toolbar">
          <div className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <label style={{ marginBottom: 0 }}>Display currency</label>
            <select value={state.settings.baseCurrency} onChange={(e) => updateSettings({ baseCurrency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <button onClick={() => refreshAll()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={state.settings.autoRefresh}
              onChange={(e) => updateSettings({ autoRefresh: e.target.checked })}
            />
            Auto-refresh every 5 min
          </label>
        </div>
        <div className="toolbar">
          <button onClick={exportData}>Export backup</button>
          <button onClick={handleImportClick}>Import backup</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
        {lastRefreshedAt ? `Last refreshed ${formatDate(lastRefreshedAt)}.` : "Not refreshed yet — crypto prices and FX rates are fetched live; equities are best-effort."}{" "}
        {fxError && <span style={{ color: "var(--critical)" }}>FX refresh failed: {fxError}</span>}
      </div>
      {lastPriceResult && lastPriceResult.failed.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {lastPriceResult.updated.length} price{lastPriceResult.updated.length === 1 ? "" : "s"} updated live.{" "}
          {lastPriceResult.failed.length} couldn't be fetched — left as manual (e.g. blocked lookup, no symbol match).
        </div>
      )}
    </div>
  );
}
