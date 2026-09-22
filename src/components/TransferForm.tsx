import { useState } from "react";
import { ContributionFrequency, FREQUENCY_LABELS, Holding, Transfer } from "../types";

type Draft = Omit<Transfer, "id"> | Transfer;

function blank(holdings: Holding[]): Draft {
  return {
    name: "",
    fromHoldingId: holdings[0]?.id ?? "",
    toHoldingId: holdings[1]?.id ?? holdings[0]?.id ?? "",
    amount: 0,
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
  };
}

export function TransferForm({
  initial,
  holdings,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Transfer | null;
  holdings: Holding[];
  onSave: (transfer: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initial ?? blank(holdings));

  function set<K extends keyof Transfer>(key: K, value: Transfer[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const fromHolding = holdings.find((h) => h.id === draft.fromHoldingId);
  const toHolding = holdings.find((h) => h.id === draft.toHoldingId);
  const sameHolding = draft.fromHoldingId && draft.fromHoldingId === draft.toHoldingId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.fromHoldingId || !draft.toHoldingId || sameHolding) return;
    onSave(draft);
  }

  if (holdings.length < 2) {
    return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <h2>Add transfer</h2>
          <p className="help">You need at least two holdings before you can move money between them.</p>
          <div className="modal-actions">
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Edit transfer" : "Add transfer"}</h2>
        <p className="help" style={{ marginTop: -8, marginBottom: 14 }}>
          Moves money you already track from one holding to another — e.g. routinely funding Bitcoin from a savings
          account. Reallocates your portfolio; doesn't add to it, so it's never counted as a contribution.
        </p>

        <div className="form-grid">
          <div className="form-field span-2">
            <label>Label (optional)</label>
            <input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. DCA into Bitcoin" />
          </div>

          <div className="form-field">
            <label>From</label>
            <select value={draft.fromHoldingId} onChange={(e) => set("fromHoldingId", e.target.value)}>
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>To</label>
            <select value={draft.toHoldingId} onChange={(e) => set("toHoldingId", e.target.value)}>
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.currency})
                </option>
              ))}
            </select>
          </div>
          {sameHolding && <div className="form-field span-2 help" style={{ color: "var(--critical)" }}>From and To can't be the same holding.</div>}

          <div className="form-field">
            <label>Amount ({fromHolding?.currency ?? "…"})</label>
            <input
              type="number"
              step="any"
              value={draft.amount ? draft.amount : ""}
              onChange={(e) => set("amount", Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label>Frequency</label>
            <select value={draft.frequency} onChange={(e) => set("frequency", e.target.value as ContributionFrequency)}>
              {(Object.keys(FREQUENCY_LABELS) as ContributionFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Start date</label>
            <input type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="form-field">
            <label>End date (optional)</label>
            <input
              type="date"
              disabled={draft.frequency === "once"}
              value={draft.endDate ?? ""}
              onChange={(e) => set("endDate", e.target.value || undefined)}
            />
          </div>

          {fromHolding && toHolding && !sameHolding && draft.amount > 0 && (
            <div className="form-field span-2 help">
              Each {draft.frequency === "once" ? "one-off transfer" : "time this runs"}: {fromHolding.name} loses{" "}
              {draft.amount} {fromHolding.currency}, {toHolding.name} gains the converted equivalent in {toHolding.currency}.
            </div>
          )}
        </div>

        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete transfer
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!!sameHolding}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
