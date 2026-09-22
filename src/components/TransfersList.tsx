import { FREQUENCY_LABELS, Holding, Transfer } from "../types";
import { formatMoney } from "../lib/format";

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
        account. Reallocates your portfolio in the projection; never counted as a contribution.
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
