import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Holding, PortfolioSettings, PortfolioState, Transfer } from "../types";
import { loadState, saveState, exportStateAsFile, parseImportedState } from "../lib/storage";
import { fetchFxRates } from "../lib/fx";
import { refreshLivePrices, PriceRefreshResult } from "../lib/prices";
import { newId } from "../lib/id";

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export interface LoadIssue {
  recoveredFromBackup: boolean;
  loadError: boolean;
  unparseable: string | null;
}

interface PortfolioContextValue {
  state: PortfolioState;
  addHolding: (holding: Omit<Holding, "id">) => void;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  saveHolding: (holding: Omit<Holding, "id"> | Holding) => void;
  deleteHolding: (id: string) => void;
  saveTransfer: (transfer: Omit<Transfer, "id"> | Transfer) => void;
  deleteTransfer: (id: string) => void;
  updateSettings: (patch: Partial<PortfolioSettings>) => void;
  refreshAll: () => Promise<void>;
  fxStatus: "idle" | "loading" | "error";
  fxError: string | null;
  priceStatus: "idle" | "loading";
  lastRefreshedAt: string | null;
  lastPriceResult: PriceRefreshResult | null;
  exportData: () => void;
  importData: (text: string) => void;
  /** Set when the saved data existed but couldn't be read (and no backup generation
   * saved it either). The app MUST show this to the person before any further save
   * happens — see `dismissLoadIssue`, the only thing allowed to clear it. */
  loadIssue: LoadIssue | null;
  dismissLoadIssue: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const initialLoad = useRef(loadState()).current;
  const [state, setState] = useState<PortfolioState>(initialLoad.state);
  const [loadIssue, setLoadIssue] = useState<LoadIssue | null>(
    initialLoad.loadError || initialLoad.recoveredFromBackup
      ? {
          recoveredFromBackup: initialLoad.recoveredFromBackup,
          loadError: initialLoad.loadError,
          unparseable: initialLoad.unparseable,
        }
      : null,
  );
  const [fxStatus, setFxStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fxError, setFxError] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading">("idle");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [lastPriceResult, setLastPriceResult] = useState<PriceRefreshResult | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dismissLoadIssue = useCallback(() => setLoadIssue(null), []);

  useEffect(() => {
    // Never write over the primary key while an unresolved load failure means we might
    // be persisting an empty state on top of data that's still sitting there unreadable.
    // A "recovered from backup" case is safe to save immediately — we already have a
    // good state, and doing so re-establishes both the primary and backup slots as good.
    if (loadIssue?.loadError) return;
    saveState(state);
  }, [state, loadIssue]);

  const addHolding = useCallback((holding: Omit<Holding, "id">) => {
    setState((s) => ({ ...s, holdings: [...s.holdings, { ...holding, id: newId() }] }));
  }, []);

  const updateHolding = useCallback((id: string, patch: Partial<Holding>) => {
    setState((s) => ({
      ...s,
      holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  }, []);

  const deleteHolding = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      holdings: s.holdings.filter((h) => h.id !== id),
      // A transfer referencing a deleted holding on either end can't mean anything.
      transfers: s.transfers.filter((t) => t.fromHoldingId !== id && t.toHoldingId !== id),
    }));
  }, []);

  const saveTransfer = useCallback((transfer: Omit<Transfer, "id"> | Transfer) => {
    setState((s) => {
      if ("id" in transfer) {
        return { ...s, transfers: s.transfers.map((t) => (t.id === transfer.id ? transfer : t)) };
      }
      return { ...s, transfers: [...s.transfers, { ...transfer, id: newId() }] };
    });
  }, []);

  const deleteTransfer = useCallback((id: string) => {
    setState((s) => ({ ...s, transfers: s.transfers.filter((t) => t.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<PortfolioSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  // Fetches live crypto/equity prices and FX rates for exactly the holdings/base
  // currency passed in, then merges results into state. Pulled out from refreshAll
  // so a just-added holding can be refreshed immediately using the array the caller
  // already knows is current, rather than the possibly-stale state snapshot React
  // hasn't re-rendered with yet.
  const performRefresh = useCallback(async (holdings: Holding[], baseCurrency: string) => {
    setPriceStatus("loading");
    let holdingsAfterPrices = holdings;
    try {
      const { holdings: updated, result } = await refreshLivePrices(holdings);
      holdingsAfterPrices = updated;
      setLastPriceResult(result);
      setState((s) => ({
        ...s,
        holdings: s.holdings.map((h) => updated.find((u) => u.id === h.id) ?? h),
      }));
    } finally {
      setPriceStatus("idle");
    }

    setFxStatus("loading");
    setFxError(null);
    try {
      const currencies = Array.from(new Set(holdingsAfterPrices.map((h) => h.currency)));
      const rates = await fetchFxRates(baseCurrency, currencies);
      setState((s) => ({
        ...s,
        settings: { ...s.settings, fxRates: { ...s.settings.fxRates, ...rates }, fxRatesUpdatedAt: new Date().toISOString() },
      }));
      setFxStatus("idle");
    } catch (err) {
      setFxStatus("error");
      setFxError(err instanceof Error ? err.message : "FX refresh failed");
    }
    setLastRefreshedAt(new Date().toISOString());
  }, []);

  // Manual/periodic refresh of everything currently held, reading the latest state
  // via ref since there's no racing state update to worry about here.
  const refreshAll = useCallback(async () => {
    await performRefresh(stateRef.current.holdings, stateRef.current.settings.baseCurrency);
  }, [performRefresh]);

  // Add or update a holding and immediately try to fetch a live price/rate for it,
  // computed from the current render's state rather than a ref, so it's never stale.
  const saveHolding = useCallback(
    (holding: Omit<Holding, "id"> | Holding) => {
      const withId: Holding = "id" in holding ? holding : { ...holding, id: newId() };
      const nextHoldings = "id" in holding
        ? state.holdings.map((h) => (h.id === withId.id ? withId : h))
        : [...state.holdings, withId];
      setState((s) => ({ ...s, holdings: nextHoldings }));
      performRefresh(nextHoldings, state.settings.baseCurrency);
    },
    [state.holdings, state.settings.baseCurrency, performRefresh],
  );

  // Auto-refresh every 5 minutes while the tab is open and the setting is on.
  // Pauses when the page isn't visible so a backgrounded tab doesn't keep hammering
  // the free APIs it depends on.
  useEffect(() => {
    if (!state.settings.autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshAll();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [state.settings.autoRefresh, refreshAll]);

  const exportData = useCallback(() => exportStateAsFile(state), [state]);

  const importData = useCallback((text: string) => {
    const parsed = parseImportedState(text);
    setState(parsed);
    // A successful import is itself a resolution to any unreadable-data situation —
    // safe to resume normal saving with this known-good state.
    setLoadIssue(null);
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      state,
      addHolding,
      updateHolding,
      saveHolding,
      deleteHolding,
      saveTransfer,
      deleteTransfer,
      updateSettings,
      refreshAll,
      fxStatus,
      fxError,
      priceStatus,
      lastRefreshedAt,
      lastPriceResult,
      exportData,
      importData,
      loadIssue,
      dismissLoadIssue,
    }),
    [
      state,
      addHolding,
      updateHolding,
      saveHolding,
      deleteHolding,
      saveTransfer,
      deleteTransfer,
      updateSettings,
      refreshAll,
      fxStatus,
      fxError,
      priceStatus,
      lastRefreshedAt,
      lastPriceResult,
      exportData,
      importData,
      loadIssue,
      dismissLoadIssue,
    ],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return ctx;
}
