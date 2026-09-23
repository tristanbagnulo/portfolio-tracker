import { useState } from "react";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASSES,
  AssetClass,
  DEFAULT_GROWTH_PCT,
  DEFAULT_INCOME_GROWTH_PCT,
  Scenario,
} from "../types";
import { ASSET_CLASS_COLOR_VAR } from "../lib/colors";
import { newId } from "../lib/id";

export function ScenarioForm({
  initial,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Scenario | null;
  canDelete: boolean;
  onSave: (scenario: Scenario) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rates, setRates] = useState<Record<AssetClass, number>>(initial?.rates ?? { ...DEFAULT_GROWTH_PCT });
  const [incomeGrowthPct, setIncomeGrowthPct] = useState(initial?.incomeGrowthPct ?? DEFAULT_INCOME_GROWTH_PCT);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: initial?.id ?? newId(), name: name.trim() || "Untitled scenario", rates, incomeGrowthPct });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Edit scenario" : "New scenario"}</h2>
        <div className="form-field span-2" style={{ marginBottom: 16 }}>
          <label>Name</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Conservative, Base case, Bull run"
          />
        </div>

        <div className="slider-row" style={{ marginBottom: 16 }}>
          <div className="sr-top">
            <span className="name">Income growth (scales your contributions)</span>
            <span className="val">{incomeGrowthPct.toFixed(1)}%/yr</span>
          </div>
          <input
            type="range"
            min={-10}
            max={30}
            step={0.5}
            value={incomeGrowthPct}
            onChange={(e) => setIncomeGrowthPct(Number(e.target.value))}
          />
          <div className="sr-scale">
            <span>−10%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
          <span className="help">
            Every scheduled contribution grows at this rate each year, compounding from today — not just the asset
            it's held in. 0% keeps contributions fixed in today's dollars forever.
          </span>
        </div>

        {ASSET_CLASSES.map((cls) => (
          <div className="slider-row" key={cls}>
            <div className="sr-top">
              <span className="name">
                <span
                  style={{ width: 8, height: 8, borderRadius: 2, display: "inline-block", background: ASSET_CLASS_COLOR_VAR[cls] }}
                />
                {ASSET_CLASS_LABELS[cls]}
              </span>
              <span className="val">{rates[cls].toFixed(1)}%/yr</span>
            </div>
            <input
              type="range"
              min={-20}
              max={30}
              step={0.5}
              value={rates[cls]}
              onChange={(e) => setRates((r) => ({ ...r, [cls]: Number(e.target.value) }))}
            />
            <div className="sr-scale">
              <span>−20%</span>
              <span>0%</span>
              <span>+30%</span>
            </div>
          </div>
        ))}

        <div className="modal-actions">
          {canDelete && onDelete && (
            <button type="button" className="danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete
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
