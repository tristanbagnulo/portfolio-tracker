import { ASSET_CLASS_LABELS, Holding } from "../types";
import { formatDate, formatMoney } from "../lib/format";

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
            <th className="num">Quantity</th>
            <th className="num">Price</th>
            <th className="num">Value</th>
            <th>Price source</th>
            <th className="num">Growth p.a.</th>
            <th>Contributions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.id}>
              <td>
                <div>{h.name}</div>
                {h.notes && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.notes}</div>}
              </td>
              <td>{ASSET_CLASS_LABELS[h.assetClass]}</td>
              <td className="num">{h.quantity}</td>
              <td className="num">{formatMoney(h.price, h.currency)}</td>
              <td className="num">{formatMoney(h.quantity * h.price, h.currency)}</td>
              <td>
                <span className={`pill ${h.priceSource === "live" ? "live" : ""}`}>
                  {h.priceSource === "live" ? "Live" : "Manual"}
                </span>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(h.priceUpdatedAt)}</div>
              </td>
              <td className="num">{h.assumedAnnualGrowthPct}%</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
