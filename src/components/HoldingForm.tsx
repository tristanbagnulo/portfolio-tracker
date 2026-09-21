import { useState } from "react";
import {
  ASSET_CLASS_LABELS,
  AssetClass,
  CURRENCIES,
  ContributionFrequency,
  ContributionSchedule,
  DEFAULT_GROWTH_PCT,
  FREQUENCY_LABELS,
  Holding,
} from "../types";
import { newId } from "../lib/id";

type DraftContribution = ContributionSchedule;

function blankHolding(): Omit<Holding, "id"> {
  return {
    name: "",
    assetClass: "equity",
    currency: "AUD",
    lookupSymbol: "",
    quantity: 0,
    price: 0,
    priceSource: "manual",
    priceUpdatedAt: new Date().toISOString(),
    assumedAnnualGrowthPct: DEFAULT_GROWTH_PCT.equity,
    contributions: [],
    notes: "",
  };
}

export function HoldingForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Holding | null;
  onSave: (holding: Omit<Holding, "id"> | Holding) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Omit<Holding, "id"> | Holding>(() => initial ?? blankHolding());

  function set<K extends keyof Holding>(key: K, value: Holding[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setAssetClass(cls: AssetClass) {
    setDraft((d) => ({
      ...d,
      assetClass: cls,
      // Only nudge the default growth rate if the user hasn't customized it yet
      assumedAnnualGrowthPct:
        d.assumedAnnualGrowthPct === DEFAULT_GROWTH_PCT[d.assetClass] ? DEFAULT_GROWTH_PCT[cls] : d.assumedAnnualGrowthPct,
    }));
  }

  function addContribution() {
    const c: DraftContribution = {
      id: newId(),
      amount: 0,
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
    };
    setDraft((d) => ({ ...d, contributions: [...d.contributions, c] }));
  }

  function updateContribution(id: string, patch: Partial<ContributionSchedule>) {
    setDraft((d) => ({
      ...d,
      contributions: d.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeContribution(id: string) {
    setDraft((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== id) }));
  }

  const canFetchLive = draft.assetClass === "crypto" || draft.assetClass === "equity" || draft.assetClass === "other";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave(draft);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Edit holding" : "Add holding"}</h2>

        <div className="form-grid">
          <div className="form-field span-2">
            <label>Name</label>
            <input
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Bitcoin, VAS, ING Savings Maximiser"
            />
          </div>

          <div className="form-field">
            <label>Asset class</label>
            <select value={draft.assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
              {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((cls) => (
                <option key={cls} value={cls}>
                  {ASSET_CLASS_LABELS[cls]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Native currency</label>
            <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Quantity {draft.assetClass === "cash_savings" && "(use 1)"}</label>
            <input
              type="number"
              step="any"
              value={draft.quantity}
              onChange={(e) => set("quantity", Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label>
              {draft.assetClass === "cash_savings" ? "Balance" : "Price per unit"} ({draft.currency})
            </label>
            <input type="number" step="any" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
          </div>

          {canFetchLive && (
            <div className="form-field span-2">
              <label>Live lookup symbol (optional)</label>
              <input
                value={draft.lookupSymbol ?? ""}
                onChange={(e) => set("lookupSymbol", e.target.value)}
                placeholder={draft.assetClass === "crypto" ? "CoinGecko id, e.g. bitcoin" : "Ticker, e.g. VAS.AX or AAPL"}
              />
              <span className="help">
                {draft.assetClass === "crypto"
                  ? "Reliable — fetched from CoinGecko's free public API."
                  : "Best-effort — an unauthenticated lookup that can fail; price will stay manual if it does."}
              </span>
            </div>
          )}
          {draft.assetClass === "precious_metal" && (
            <div className="form-field span-2 help">
              No free live metals price source yet — update this price manually as it moves.
            </div>
          )}

          <div className="form-field">
            <label>{draft.assetClass === "cash_savings" ? "Interest rate (APY %)" : "Assumed annual growth (%)"}</label>
            <input
              type="number"
              step="any"
              value={draft.assumedAnnualGrowthPct}
              onChange={(e) => set("assumedAnnualGrowthPct", Number(e.target.value))}
            />
          </div>

          <div className="form-field span-2">
            <label>Notes (optional)</label>
            <input value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <h2 style={{ fontSize: 14, marginTop: 20 }}>Contribution schedule</h2>
        <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>
          How much, how often, and from when you add to this holding. Add as many rows as you like.
        </p>
        {draft.contributions.map((c) => (
          <div className="contribution-row" key={c.id}>
            <div className="form-field">
              <label>Amount ({draft.currency})</label>
              <input
                type="number"
                step="any"
                value={c.amount}
                onChange={(e) => updateContribution(c.id, { amount: Number(e.target.value) })}
              />
            </div>
            <div className="form-field">
              <label>Frequency</label>
              <select
                value={c.frequency}
                onChange={(e) => updateContribution(c.id, { frequency: e.target.value as ContributionFrequency })}
              >
                {(Object.keys(FREQUENCY_LABELS) as ContributionFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Start date</label>
              <input
                type="date"
                value={c.startDate}
                onChange={(e) => updateContribution(c.id, { startDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>End date (optional)</label>
              <input
                type="date"
                disabled={c.frequency === "once"}
                value={c.endDate ?? ""}
                onChange={(e) => updateContribution(c.id, { endDate: e.target.value || undefined })}
              />
            </div>
            <button type="button" className="danger" onClick={() => removeContribution(c.id)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addContribution}>
          + Add contribution
        </button>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
