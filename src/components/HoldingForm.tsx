import { useState } from "react";
import {
  ASSET_CLASS_LABELS,
  AssetClass,
  CURRENCIES,
  ContributionFrequency,
  ContributionSchedule,
  EntryMode,
  FREQUENCY_LABELS,
  Holding,
} from "../types";
import { newId } from "../lib/id";
import { convert } from "../lib/fx";
import { formatMoney } from "../lib/format";

type DraftContribution = ContributionSchedule;
type Draft = Omit<Holding, "id"> | Holding;

function defaultModeForClass(cls: AssetClass): EntryMode {
  return cls === "cash_savings" || cls === "other" ? "value" : "quantity";
}

function blankHolding(baseCurrency: string): Draft {
  return {
    name: "",
    assetClass: "equity",
    currency: baseCurrency,
    entryMode: "quantity",
    lookupSymbol: "",
    quantity: 0,
    price: 0,
    priceSource: "manual",
    value: 0,
    valueUpdatedAt: new Date().toISOString(),
    contributions: [],
    notes: "",
  };
}

export function HoldingForm({
  initial,
  baseCurrency,
  fxRates,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Holding | null;
  baseCurrency: string;
  fxRates: Record<string, number>;
  onSave: (holding: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initial ?? blankHolding(baseCurrency));

  function set<K extends keyof Holding>(key: K, value: Holding[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setAssetClass(cls: AssetClass) {
    setDraft((d) => ({ ...d, assetClass: cls, entryMode: initial ? d.entryMode : defaultModeForClass(cls) }));
  }

  function setEntryMode(mode: EntryMode) {
    setDraft((d) => ({ ...d, entryMode: mode }));
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

  const canFetchLive =
    draft.entryMode === "quantity" &&
    (draft.assetClass === "crypto" || draft.assetClass === "equity" || draft.assetClass === "other");

  const quantityValuePreview =
    draft.entryMode === "quantity" && draft.quantity && draft.price
      ? formatMoney(draft.quantity * draft.price, draft.currency)
      : null;

  const convertedPreview =
    draft.currency !== baseCurrency
      ? convert(draft.entryMode === "value" ? draft.value : (draft.quantity ?? 0) * (draft.price ?? 0), draft.currency, baseCurrency, fxRates)
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const value = draft.entryMode === "value" ? draft.value : (draft.quantity ?? 0) * (draft.price ?? 0);
    const valueChanged = !initial || initial.value !== value;
    onSave({
      ...draft,
      value,
      valueUpdatedAt: valueChanged ? new Date().toISOString() : draft.valueUpdatedAt,
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Edit holding" : "Add holding"}</h2>

        <div className="form-grid">
          <div className="form-field span-2">
            <label>Asset</label>
            <input
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Bitcoin, VAS, ING Savings Maximiser"
            />
          </div>

          <div className="form-field span-2">
            <label>Asset class</label>
            <select value={draft.assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
              {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((cls) => (
                <option key={cls} value={cls}>
                  {ASSET_CLASS_LABELS[cls]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field span-2">
            <label>How do you want to enter it?</label>
            <div className="seg-toggle">
              <button
                type="button"
                className={draft.entryMode === "value" ? "active" : ""}
                onClick={() => setEntryMode("value")}
              >
                By value
              </button>
              <button
                type="button"
                className={draft.entryMode === "quantity" ? "active" : ""}
                onClick={() => setEntryMode("quantity")}
              >
                By quantity
              </button>
            </div>
          </div>

          {draft.entryMode === "value" ? (
            <>
              <div className="form-field">
                <label>Current value</label>
                <input type="number" step="any" value={draft.value} onChange={(e) => set("value", Number(e.target.value))} />
              </div>
              <div className="form-field">
                <label>Currency</label>
                <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label>Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={draft.quantity ?? 0}
                  onChange={(e) => set("quantity", Number(e.target.value))}
                />
              </div>
              <div className="form-field">
                <label>Price per unit</label>
                <input type="number" step="any" value={draft.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} />
              </div>
              <div className="form-field span-2">
                <label>Currency</label>
                <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              {quantityValuePreview && <div className="form-field span-2 help">= {quantityValuePreview}</div>}
            </>
          )}

          {convertedPreview != null && (
            <div className="form-field span-2 help">
              ≈ {formatMoney(convertedPreview, baseCurrency)}
            </div>
          )}
          {draft.currency !== baseCurrency && convertedPreview == null && (
            <div className="form-field span-2 help">
              No exchange rate set for {draft.currency} yet — one will be fetched automatically, or add one manually.
            </div>
          )}

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
                  ? "Reliable — fetched from CoinGecko's free public API, refreshed automatically."
                  : "Best-effort — an unauthenticated lookup that can fail; value will stay manual if it does."}
              </span>
            </div>
          )}
          {draft.entryMode === "quantity" && draft.assetClass === "precious_metal" && (
            <div className="form-field span-2 help">
              No free live metals price source yet — update this price manually as it moves.
            </div>
          )}

          <div className="form-field span-2">
            <label>Notes (optional)</label>
            <input value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <h2 style={{ fontSize: 14, marginTop: 20 }}>Contributions</h2>
        <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>
          How much, how often, and from when you plan to keep adding to this. Add as many rows as you like.
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
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete holding
            </button>
          )}
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
