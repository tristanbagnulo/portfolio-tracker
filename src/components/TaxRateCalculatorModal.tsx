import { useState } from "react";
import { estimateMarginalRatePct, TAX_YEAR_LABEL } from "../lib/taxRates";

// A brief marginal-rate estimator, not a full tax return calculator — see lib/taxRates.ts
// for exactly what it does and doesn't account for. Fills in Settings' "Your tax rate"
// field; doesn't touch anything else.
export function TaxRateCalculatorModal({
  onUse,
  onClose,
}: {
  onUse: (ratePct: number) => void;
  onClose: () => void;
}) {
  const [income, setIncome] = useState<number>(0);
  const [hasCover, setHasCover] = useState(true);

  const result = income > 0 ? estimateMarginalRatePct(income, hasCover) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result) onUse(Math.round(result.totalPct * 100) / 100);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>Estimate your tax rate</h2>
        <p className="help" style={{ marginTop: -6, marginBottom: 12 }}>
          Your marginal rate — what tax takes from your NEXT dollar of income. Not your total tax payable, not
          HECS/HELP, not the private health rebate. Australian resident, single taxpayer, {TAX_YEAR_LABEL} rates.
        </p>

        <div className="form-field span-2">
          <label>Annual income (before tax, not including super)</label>
          <input
            type="number"
            step="any"
            autoFocus
            value={income ? income : ""}
            onChange={(e) => setIncome(Number(e.target.value))}
            placeholder="e.g. 180000"
          />
        </div>

        <div className="form-field span-2">
          <label style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: "row" }}>
            <input type="checkbox" checked={hasCover} onChange={(e) => setHasCover(e.target.checked)} />
            I have private hospital cover
          </label>
          <span className="help">
            Determines whether the Medicare Levy Surcharge applies — it never affects the base 2% Medicare levy
            itself, which almost everyone pays regardless of cover.
          </span>
        </div>

        {result && (
          <div className="help" style={{ marginBottom: 4 }}>
            {result.bracketPct}% bracket + {result.medicareLevyPct}% Medicare levy
            {result.surchargePct > 0 && ` + ${result.surchargePct}% Medicare levy surcharge (no private cover)`} ={" "}
            <strong style={{ color: "var(--text-primary)" }}>{result.totalPct.toFixed(2)}%</strong>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!result}>
            Use this rate
          </button>
        </div>
      </form>
    </div>
  );
}
