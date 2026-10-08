import { Holding, PortfolioState, Transfer } from "../types";
import { convert } from "./fx";
import { occurrencesBetween } from "./schedule";

// Applying a delta to a "quantity" mode holding (crypto/gold) has to move `quantity`,
// not `value` directly — value is derived (quantity * price) and gets silently
// overwritten by the next live price refresh otherwise, which would make a real
// transfer's effect vanish the moment prices update. "value" mode holdings (cash,
// stocks entered by value) have no quantity/price to keep in sync, so they're simpler.
function applyDeltaToHolding(h: Holding, nativeDelta: number): Holding {
  const now = new Date().toISOString();
  if (h.entryMode === "quantity" && h.price) {
    const quantity = (h.quantity ?? 0) + nativeDelta / h.price;
    return { ...h, quantity, value: quantity * h.price, valueUpdatedAt: now };
  }
  return { ...h, value: h.value + nativeDelta, valueUpdatedAt: now };
}

/**
 * Applies every transfer occurrence that's become due since it was last checked as a
 * REAL change to the actual current holding values/quantities — not just the
 * projection. Trusts the schedule completely: a transfer whose startDate is months
 * back, never checked before, catches up every occurrence between then and today in
 * one go, on the assumption that what's entered genuinely happened in real life.
 * `lastAppliedDate` is the idempotency guard — re-running this before the next real
 * occurrence is due is always a safe no-op, and running it late (the app was closed for
 * a while) correctly catches up everything that was missed rather than only the latest.
 *
 * Known simplification: if a transfer's `amount` changes while occurrences are still
 * unapplied (e.g. edited between infrequent app opens), every pending occurrence gets
 * applied at the CURRENT amount rather than whatever amount was in effect on each
 * historical date — tracking amount history would be real added complexity for a case
 * that's rare in practice (checked at least once per session, via the same live-refresh
 * cycle that runs on every app open).
 *
 * Each occurrence is applied one at a time rather than as one lump sum, and clamped to
 * whatever the source actually holds at that point — real money can't be moved out
 * faster than it's there, so a source that runs dry partway through a catch-up just
 * stops contributing from that occurrence on, instead of going negative.
 */
export function applyDueTransfers(state: PortfolioState): PortfolioState {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const holdingsById = new Map(state.holdings.map((h) => [h.id, h]));
  let changedAny = false;

  const nextTransfers = state.transfers.map((t: Transfer) => {
    const from = holdingsById.get(t.fromHoldingId);
    const to = holdingsById.get(t.toHoldingId);
    if (!from || !to) return t; // dangling reference (a deleted holding) — nothing to apply

    const after = t.lastAppliedDate ? new Date(`${t.lastAppliedDate}T00:00:00`) : null;
    const occurrences = occurrencesBetween(t, after, today);
    if (occurrences.length === 0) return t;

    // Checked once up front: if this currency pair has no rate at all, bail without
    // advancing lastAppliedDate so every occurrence gets retried (and still catches up
    // correctly) once a rate exists, rather than silently dropping them.
    if (convert(t.amount, from.currency, to.currency, state.settings.fxRates) == null) return t;

    let currentFrom = from;
    let currentTo = to;
    for (let i = 0; i < occurrences.length; i++) {
      const available = Math.max(0, currentFrom.value);
      const amount = Math.min(t.amount, available);
      if (amount === 0) continue;
      const convertedToDest = convert(amount, currentFrom.currency, currentTo.currency, state.settings.fxRates) ?? 0;
      currentFrom = applyDeltaToHolding(currentFrom, -amount);
      currentTo = applyDeltaToHolding(currentTo, convertedToDest);
    }

    changedAny = true;
    holdingsById.set(from.id, currentFrom);
    holdingsById.set(to.id, currentTo);
    return { ...t, lastAppliedDate: today.toISOString().slice(0, 10) };
  });

  if (!changedAny) return state;
  // Map iteration order preserves original insertion order for keys that already
  // existed (only re-`set`, never newly added), so this doesn't reorder the list.
  return { ...state, holdings: Array.from(holdingsById.values()), transfers: nextTransfers };
}
