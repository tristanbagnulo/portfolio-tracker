import { ASSET_CLASS_LABELS, Holding } from "../types";
import { formatDate, formatMoney } from "../lib/format";

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function amountLabel(h: Holding): string {
  if (h.entryMode === "quantity" && h.quantity) {
    return `${h.quantity} @ ${formatMoney(h.price ?? 0, h.currency)}`;
  }
  return `Value ${formatMoney(h.value, h.currency)}`;
}

export function HoldingsTable({
  holdings,
  onEdit,
  onDelete,
}: {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}) {
  if (holdings.length === 0) {
    return <div className="empty-state">No holdings yet — add your first one below.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Class</th>
            <th>Amount</th>
            <th className="num">Value</th>
            <th>Updated</th>
            <th>Contributions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const stale = daysSince(h.valueUpdatedAt) > 30;
            return (
              <tr key={h.id}>
                <td>
                  <div>{h.name}</div>
                  {h.notes && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.notes}</div>}
                </td>
                <td>{ASSET_CLASS_LABELS[h.assetClass]}</td>
                <td>{amountLabel(h)}</td>
                <td className="num">{formatMoney(h.value, h.currency)}</td>
                <td>
                  {h.priceSource === "live" && <span className="pill live">Live</span>}
                  <div style={{ fontSize: 11, color: stale ? "var(--critical)" : "var(--text-muted)" }}>
                    {stale ? `${Math.floor(daysSince(h.valueUpdatedAt))}d ago` : formatDate(h.valueUpdatedAt)}
                  </div>
                </td>
                <td>
                  {h.contributions.length === 0
                    ? "—"
                    : h.contributions
                        .map((c) => `${formatMoney(c.amount, h.currency)} ${c.frequency === "once" ? "once" : `/ ${c.frequency}`}`)
                        .join(", ")}
                </td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onEdit(h)}>Edit</button>
                    <button className="danger" onClick={() => onDelete(h.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
