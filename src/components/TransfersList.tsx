import { FREQUENCY_LABELS, Holding, Transfer } from "../types";
import { formatDate, formatMoney } from "../lib/format";

export function TransfersList({
  transfers,
  holdings,
  onEdit,
  onAdd,
}: {
  transfers: Transfer[];
  holdings: Holding[];
  onEdit: (transfer: Transfer) => void;
  onAdd: () => void;
}) {
  const byId = new Map(holdings.map((h) => [h.id, h]));

  return (
    <div className="card">
      <h2>Transfers</h2>
      <p className="help" style={{ marginTop: -6, marginBottom: 12 }}>
        Recurring or one-off money moved from one holding to another — e.g. routinely funding Bitcoin from a savings
        account. Applied for real to both holdings' actual values as each occurrence comes due (caught up
        automatically, even if you haven't opened the app in a while), plus reflected in the projection going
        forward. Never counted as a contribution — this moves money you already have, not new money in.
      </p>
      {transfers.length === 0 ? (
        <div className="empty-state">No transfers set up yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th className="num">Amount</th>
              <th>Frequency</th>
              <th>Applied through</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const from = byId.get(t.fromHoldingId);
              const to = byId.get(t.toHoldingId);
              return (
                <tr key={t.id}>
                  <td>{from ? from.name : "(deleted)"}</td>
                  <td>{to ? to.name : "(deleted)"}</td>
                  <td className="num">{from ? formatMoney(t.amount, from.currency) : t.amount}</td>
                  <td>{t.frequency === "once" ? "One-off" : FREQUENCY_LABELS[t.frequency]}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {t.lastAppliedDate ? formatDate(t.lastAppliedDate) : "not yet"}
                  </td>
                  <td>
                    <button onClick={() => onEdit(t)}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <button style={{ marginTop: 10 }} onClick={onAdd}>
        + Add transfer
      </button>
    </div>
  );
}
