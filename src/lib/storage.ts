import { defaultState, defaultTaxTreatmentForClass, Holding, PortfolioState } from "../types";

// Every path data can enter this app through (local load, file import, and the
// Firestore cloud subscription in context/PortfolioContext.tsx) needs the SAME
// backward-compatible defaults applied — a state object missing a field a newer version
// of the app now depends on is exactly as "old" whether it came from disk, a backup
// file, or another device's earlier cloud copy. Splitting this migration across each
// call site separately is how a real bug happened: the cloud path got missed when
// taxTreatment was added, and a holding with no taxTreatment silently poisoned every
// projection with NaN (lib/tax.ts's switch had no case for `undefined`). One function,
// called from every entry point, is the fix.
export function sanitizeState(parsed: {
  holdings?: unknown;
  transfers?: unknown;
  settings?: Partial<PortfolioState["settings"]>;
}): PortfolioState {
  const d = defaultState();
  const holdings: Holding[] = Array.isArray(parsed.holdings) ? parsed.holdings : [];
  const settings = { ...d.settings, ...parsed.settings };
  if (!settings.scenarios?.length) settings.scenarios = d.settings.scenarios;
  if (!settings.visibleScenarioIds?.length) settings.visibleScenarioIds = settings.scenarios.map((s) => s.id);
  if (typeof settings.marginalTaxRatePct !== "number") settings.marginalTaxRatePct = 0;
  return {
    holdings: holdings.map((h) => (h.taxTreatment ? h : { ...h, taxTreatment: defaultTaxTreatmentForClass(h.assetClass) })),
    transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
    settings,
  };
}

const STORAGE_KEY = "portfolio-tracker:state:v2";
// One generation of history behind the primary key, rolled forward on every successful
// save. If the primary value is ever corrupted/truncated (a storage hiccup, a write
// interrupted mid-way), this is the fallback loadState() tries before giving up.
const BACKUP_KEY = "portfolio-tracker:state:v2:backup";

export interface LoadResult {
  state: PortfolioState;
  recoveredFromBackup: boolean;
  /** Set only when neither the primary nor the backup slot could be read, despite the
   * primary slot not being empty. The caller MUST NOT persist `state` in this case until
   * the user has explicitly acknowledged data loss — see App.tsx's load-issue gate. */
  loadError: boolean;
  /** The raw text we couldn't make sense of, preserved verbatim so nothing is silently
   * discarded — the user can at least copy it out and inspect it by hand. */
  unparseable: string | null;
}

function tryParse(raw: string | null): PortfolioState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PortfolioState>;
    if (!Array.isArray(parsed.holdings)) return null;
    return sanitizeState(parsed);
  } catch {
    return null;
  }
}

export function loadState(): LoadResult {
  const primaryRaw = localStorage.getItem(STORAGE_KEY);
  const primary = tryParse(primaryRaw);
  if (primary) return { state: primary, recoveredFromBackup: false, loadError: false, unparseable: null };

  // Nothing there at all — a genuinely fresh start, not a failure. Safe to persist
  // immediately; there's nothing to lose.
  if (primaryRaw == null) {
    return { state: defaultState(), recoveredFromBackup: false, loadError: false, unparseable: null };
  }

  // Primary exists but couldn't be read. Try the one-generation-back backup before
  // concluding anything is actually lost.
  const backup = tryParse(localStorage.getItem(BACKUP_KEY));
  if (backup) {
    return { state: backup, recoveredFromBackup: true, loadError: false, unparseable: primaryRaw };
  }

  // Neither slot is readable. Returning an empty default here is fine — what matters is
  // that the caller must NOT write it back over the primary key until the person using
  // the app has actually seen this and chosen to start fresh.
  return { state: defaultState(), recoveredFromBackup: false, loadError: true, unparseable: primaryRaw };
}

export function saveState(state: PortfolioState): void {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) localStorage.setItem(BACKUP_KEY, current);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportStateAsFile(state: PortfolioState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `portfolio-tracker-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedState(text: string): PortfolioState {
  const parsed = JSON.parse(text) as Partial<PortfolioState>;
  if (!Array.isArray(parsed.holdings) || typeof parsed.settings !== "object") {
    throw new Error("File doesn't look like a portfolio-tracker backup.");
  }
  return sanitizeState(parsed);
}
