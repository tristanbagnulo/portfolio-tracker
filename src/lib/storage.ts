import { DEFAULT_STATE, PortfolioState } from "../types";

const STORAGE_KEY = "portfolio-tracker:state:v1";

export function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as PortfolioState;
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...structuredClone(DEFAULT_STATE.settings), ...parsed.settings },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state: PortfolioState): void {
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
  const parsed = JSON.parse(text) as PortfolioState;
  if (!Array.isArray(parsed.holdings) || typeof parsed.settings !== "object") {
    throw new Error("File doesn't look like a portfolio-tracker backup.");
  }
  return parsed;
}
