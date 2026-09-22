import { useState } from "react";
import { formatMoney } from "../lib/format";
import { Holding } from "../types";

export function FxRateModal({
  currency,
  baseCurrency,
  currentRate,
  holdings,
  onSave,
  onClose,
}: {
  currency: string;
  baseCurrency: string;
  currentRate: number | undefined;
  holdings: Holding[];
  onSave: (rate: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(currentRate != null ? String(currentRate) : "");
  const rate = Number(value);
  const affected = holdings.filter((h) => h.currency === currency);
  const nativeSum = affected.reduce((s, h) => s + h.value, 0);

  function lookUp() {
    const url = `https://www.google.com/search?q=${encodeURIComponent(`1 ${currency} to ${baseCurrency}`)}`;
    window.open(url, "_blank", "noopener");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rate || rate <= 0) return;
    onSave(rate);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>Set exchange rate</h2>
        <div className="banner">
          Live rates come from Frankfurter automatically when it's reachable. If a fetch fails (offline, rate-limited,
          blocked), set it here yourself as a fallback — it's overwritten next time a live refresh succeeds.
        </div>
        <div className="form-field span-2">
          <label>1 {currency} equals how many {baseCurrency}?</label>
          <input
            type="number"
            step="any"
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="help">Double-check the direction — this is 1 {currency} in {baseCurrency}, not the reverse.</span>
          <button type="button" className="link-btn" style={{ marginTop: 4, textAlign: "left" }} onClick={lookUp}>
            Look up 1 {currency} to {baseCurrency} ↗
          </button>
        </div>
        {rate > 0 && (
          <div className="help" style={{ marginBottom: 4 }}>
            Reverse check: 1 {baseCurrency} = {(1 / rate).toFixed(4)} {currency}
          </div>
        )}
        {rate > 0 && affected.length > 0 && (
          <div className="help" style={{ marginBottom: 12 }}>
            {affected.length} holding{affected.length === 1 ? "" : "s"} in {currency}: {formatMoney(nativeSum, currency)} →{" "}
            {formatMoney(nativeSum * rate, baseCurrency)} at this rate
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save rate
          </button>
        </div>
      </form>
    </div>
  );
}
