import { defaultState, PortfolioState } from "../types";

const STORAGE_KEY = "portfolio-tracker:state:v2";

export function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as PortfolioState;
    const d = defaultState();
    const settings = { ...d.settings, ...parsed.settings };
    if (!settings.scenarios?.length) settings.scenarios = d.settings.scenarios;
    if (!settings.visibleScenarioIds?.length) settings.visibleScenarioIds = settings.scenarios.map((s) => s.id);
    return {
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      settings,
    };
  } catch {
    return defaultState();
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
  const d = defaultState();
  if (!parsed.settings.scenarios?.length) {
    parsed.settings.scenarios = d.settings.scenarios;
    parsed.settings.visibleScenarioIds = d.settings.visibleScenarioIds;
  }
  if (!Array.isArray(parsed.transfers)) parsed.transfers = [];
  return parsed;
}
