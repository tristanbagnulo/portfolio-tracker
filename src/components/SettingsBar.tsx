import { useRef, useState } from "react";
import { CURRENCIES } from "../types";
import { usePortfolio } from "../context/PortfolioContext";
import { formatDate } from "../lib/format";
import { PriceRefreshResult } from "../lib/prices";

export function SettingsBar() {
  const { state, updateSettings, refreshFx, refreshPrices, fxStatus, fxError, priceStatus, exportData, importData } =
    usePortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastPriceResult, setLastPriceResult] = useState<PriceRefreshResult | null>(null);

  async function handleRefreshPrices() {
    const result = await refreshPrices();
    setLastPriceResult(result);
    await refreshFx();
  }

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
          <button onClick={handleRefreshPrices} disabled={priceStatus === "loading" || fxStatus === "loading"}>
            {priceStatus === "loading" || fxStatus === "loading" ? "Refreshing…" : "Refresh prices & FX"}
          </button>
        </div>
        <div className="toolbar">
          <button onClick={exportData}>Export backup</button>
          <button onClick={handleImportClick}>Import backup</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
        {state.settings.fxRatesUpdatedAt ? `FX rates as of ${formatDate(state.settings.fxRatesUpdatedAt)}.` : "FX rates not fetched yet."}{" "}
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
