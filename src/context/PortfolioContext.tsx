import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Holding, PortfolioSettings, PortfolioState } from "../types";
import { loadState, saveState, exportStateAsFile, parseImportedState } from "../lib/storage";
import { fetchFxRates } from "../lib/fx";
import { refreshLivePrices, PriceRefreshResult } from "../lib/prices";
import { newId } from "../lib/id";

interface PortfolioContextValue {
  state: PortfolioState;
  addHolding: (holding: Omit<Holding, "id">) => void;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;
  updateSettings: (patch: Partial<PortfolioSettings>) => void;
  refreshFx: () => Promise<void>;
  refreshPrices: () => Promise<PriceRefreshResult>;
  fxStatus: "idle" | "loading" | "error";
  fxError: string | null;
  priceStatus: "idle" | "loading";
  exportData: () => void;
  importData: (text: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PortfolioState>(() => loadState());
  const [fxStatus, setFxStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fxError, setFxError] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading">("idle");

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

  const refreshFx = useCallback(async () => {
    setFxStatus("loading");
    setFxError(null);
    try {
      const currencies = Array.from(new Set(state.holdings.map((h) => h.currency)));
      const rates = await fetchFxRates(state.settings.baseCurrency, currencies);
      setState((s) => ({
        ...s,
        settings: { ...s.settings, fxRates: rates, fxRatesUpdatedAt: new Date().toISOString() },
      }));
      setFxStatus("idle");
    } catch (err) {
      setFxStatus("error");
      setFxError(err instanceof Error ? err.message : "FX refresh failed");
    }
  }, [state.holdings, state.settings.baseCurrency]);

  const refreshPrices = useCallback(async () => {
    setPriceStatus("loading");
    try {
      const { holdings, result } = await refreshLivePrices(state.holdings);
      setState((s) => ({ ...s, holdings }));
      return result;
    } finally {
      setPriceStatus("idle");
    }
  }, [state.holdings]);

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
      refreshFx,
      refreshPrices,
      fxStatus,
      fxError,
      priceStatus,
      exportData,
      importData,
    }),
    [state, addHolding, updateHolding, deleteHolding, updateSettings, refreshFx, refreshPrices, fxStatus, fxError, priceStatus, exportData, importData],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return ctx;
}
