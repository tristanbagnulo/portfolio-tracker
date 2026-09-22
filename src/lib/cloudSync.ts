import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { PortfolioState } from "../types";

// One Firestore document per signed-in user (users/{uid}), holding the entire
// PortfolioState verbatim — small enough (a handful of holdings/transfers/settings) to
// stay well under Firestore's 1MiB document limit, and simple to reason about: every
// local change while signed in overwrites the whole doc in one setDoc call, and the
// live subscription below is how other tabs/devices (and this one, after a corrupted
// localStorage read) get the latest copy back. Firestore's own offline persistence
// (see lib/firebase.ts) means these reads/writes work offline and reconcile
// automatically once back online.

/** Live subscription to a user's cloud portfolio state. Returns an unsubscribe function. */
export function subscribeCloudState(uid: string, onChange: (state: PortfolioState) => void): () => void {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    const data = snap.data() as PortfolioState | undefined;
    if (data) onChange(data);
  });
}

export async function saveCloudState(uid: string, state: PortfolioState): Promise<void> {
  await setDoc(doc(db, "users", uid), state);
}

/** True if this user has never synced anything to the cloud yet — the signal for
 * whether a first-sign-in migration should upload this device's existing local state
 * rather than adopt (empty) cloud state. */
export async function isCloudStateEmpty(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() as PortfolioState | undefined;
  return !data || !Array.isArray(data.holdings) || data.holdings.length === 0;
}
