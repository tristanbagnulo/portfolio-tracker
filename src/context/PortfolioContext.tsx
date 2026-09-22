import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Holding, PortfolioSettings, PortfolioState } from "../types";
import { loadState, saveState, exportStateAsFile, parseImportedState } from "../lib/storage";
import { fetchFxRates } from "../lib/fx";
import { refreshLivePrices, PriceRefreshResult } from "../lib/prices";
import { newId } from "../lib/id";

const AUTO_REFRESH_MS = 5 * 60 * 1000;

interface PortfolioContextValue {
  state: PortfolioState;
  addHolding: (holding: Omit<Holding, "id">) => void;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;
  updateSettings: (patch: Partial<PortfolioSettings>) => void;
  refreshAll: () => Promise<void>;
  fxStatus: "idle" | "loading" | "error";
  fxError: string | null;
  priceStatus: "idle" | "loading";
  lastRefreshedAt: string | null;
  lastPriceResult: PriceRefreshResult | null;
  exportData: () => void;
  importData: (text: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PortfolioState>(() => loadState());
  const [fxStatus, setFxStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fxError, setFxError] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading">("idle");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [lastPriceResult, setLastPriceResult] = useState<PriceRefreshResult | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

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
    setState((s) => ({ ...s, holdings: s.holdings.filter((h) => h.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<PortfolioSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  // Fetches live crypto/equity prices and FX rates together, since a price refresh
  // can introduce a new currency that then also needs a rate. Silent on auto-refresh
  // ticks — errors surface via fxStatus/fxError for the manual "Refresh" button to show.
  const refreshAll = useCallback(async () => {
    setPriceStatus("loading");
    let holdingsAfterPrices = stateRef.current.holdings;
    try {
      const { holdings, result } = await refreshLivePrices(stateRef.current.holdings);
      holdingsAfterPrices = holdings;
      setLastPriceResult(result);
      setState((s) => ({ ...s, holdings }));
    } finally {
      setPriceStatus("idle");
    }

    setFxStatus("loading");
    setFxError(null);
    try {
      const currencies = Array.from(new Set(holdingsAfterPrices.map((h) => h.currency)));
      const rates = await fetchFxRates(stateRef.current.settings.baseCurrency, currencies);
      setState((s) => ({
        ...s,
        settings: { ...s.settings, fxRates: rates, fxRatesUpdatedAt: new Date().toISOString() },
      }));
      setFxStatus("idle");
    } catch (err) {
      setFxStatus("error");
      setFxError(err instanceof Error ? err.message : "FX refresh failed");
    }
    setLastRefreshedAt(new Date().toISOString());
  }, []);

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
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      state,
      addHolding,
      updateHolding,
      deleteHolding,
      updateSettings,
      refreshAll,
      fxStatus,
      fxError,
      priceStatus,
      lastRefreshedAt,
      lastPriceResult,
      exportData,
      importData,
    }),
    [
      state,
      addHolding,
      updateHolding,
      deleteHolding,
      updateSettings,
      refreshAll,
      fxStatus,
      fxError,
      priceStatus,
      lastRefreshedAt,
      lastPriceResult,
      exportData,
      importData,
    ],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return ctx;
}
