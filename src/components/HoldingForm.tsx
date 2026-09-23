import { useState } from "react";
import {
  ASSET_CLASS_LABELS,
  AssetClass,
  CURRENCIES,
  ContributionFrequency,
  ContributionSchedule,
  defaultTaxTreatmentForClass,
  EntryMode,
  FREQUENCY_LABELS,
  Holding,
  TAX_TREATMENT_LABELS,
  TaxTreatment,
} from "../types";
import { newId } from "../lib/id";
import { convert } from "../lib/fx";
import { formatMoney } from "../lib/format";

type DraftContribution = ContributionSchedule;
type Draft = Omit<Holding, "id"> | Holding;

function defaultModeForClass(cls: AssetClass): EntryMode {
  return cls === "cash_savings" || cls === "other" ? "value" : "quantity";
}

// Common coin names -> their CoinGecko id, so typing a well-known name auto-fills
// the live lookup symbol instead of leaving it as a blank field nobody knows to fill in.
const COMMON_COINGECKO_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  btc: "bitcoin",
  ethereum: "ethereum",
  eth: "ethereum",
  solana: "solana",
  sol: "solana",
  cardano: "cardano",
  ada: "cardano",
  dogecoin: "dogecoin",
  doge: "dogecoin",
  litecoin: "litecoin",
  ltc: "litecoin",
  ripple: "ripple",
  xrp: "ripple",
  polkadot: "polkadot",
  dot: "polkadot",
  avalanche: "avalanche-2",
  avax: "avalanche-2",
  chainlink: "chainlink",
  link: "chainlink",
  polygon: "matic-network",
  matic: "matic-network",
  "usd coin": "usd-coin",
  usdc: "usd-coin",
  tether: "tether",
  usdt: "tether",
  "binance coin": "binancecoin",
  bnb: "binancecoin",
  // Gold has no dedicated spot-price API that's both free and CORS-open, but PAX Gold
  // (PAXG) is a token pegged 1:1 to a fine troy ounce of physical gold and trades on
  // CoinGecko like any other coin — close enough to spot for a projection tool, with a
  // small premium/discount possible. Silver has no equivalent liquid token, so it's
  // left off this list (stays manual).
  gold: "pax-gold",
  "pax gold": "pax-gold",
  xau: "pax-gold",
};

function guessCoingeckoId(name: string): string | null {
  return COMMON_COINGECKO_IDS[name.trim().toLowerCase()] ?? null;
}

// The common case — Bitcoin, Ethereum, gold — shouldn't need a name field, an asset
// class picker, a currency picker, and a manual price: pick the asset, type a quantity,
// done. Everything else here (stocks, cash accounts, anything not in this short list)
// still uses the full form below — this is a shortcut for the common case, not a
// replacement for it.
interface QuickAsset {
  key: string;
  label: string;
  assetClass: AssetClass;
  lookupSymbol: string;
  currency: string; // how this asset is conventionally quoted
}
const QUICK_ASSETS: QuickAsset[] = [
  { key: "bitcoin", label: "Bitcoin", assetClass: "crypto", lookupSymbol: "bitcoin", currency: "USD" },
  { key: "ethereum", label: "Ethereum", assetClass: "crypto", lookupSymbol: "ethereum", currency: "USD" },
  { key: "gold", label: "Gold", assetClass: "precious_metal", lookupSymbol: "pax-gold", currency: "USD" },
];

function matchingQuickAsset(h: Draft | null): QuickAsset | null {
  if (!h || h.entryMode !== "quantity") return null;
  return QUICK_ASSETS.find((q) => q.lookupSymbol === h.lookupSymbol && q.assetClass === h.assetClass) ?? null;
}

// A controlled number input showing a literal 0 isn't a placeholder — it's real text
// sitting in the field, so typing "5" lands next to it ("05") instead of replacing it.
// Showing an empty string instead lets typing start clean; the onChange handlers below
// already turn an empty string back into 0 (Number("") === 0), so nothing round-trips
// incorrectly when the field is left blank.
function emptyIfZero(n: number | undefined): string | number {
  return n ? n : "";
}

function blankHolding(baseCurrency: string): Draft {
  return {
    name: "",
    assetClass: "equity",
    currency: baseCurrency,
    entryMode: "quantity",
    lookupSymbol: "",
    quantity: 0,
    price: 0,
    priceSource: "manual",
    value: 0,
    valueUpdatedAt: new Date().toISOString(),
    contributions: [],
    taxTreatment: defaultTaxTreatmentForClass("equity"),
    notes: "",
  };
}

export function HoldingForm({
  initial,
  baseCurrency,
  fxRates,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Holding | null;
  baseCurrency: string;
  fxRates: Record<string, number>;
  onSave: (holding: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initial ?? blankHolding(baseCurrency));
  const [quickAsset, setQuickAsset] = useState<QuickAsset | null>(() => matchingQuickAsset(initial));
  // Gold's `quantity` is always stored in grams (lib/prices.ts converts the live PAXG
  // price, which is per troy ounce, to per-gram before it ever reaches here) — this is
  // purely which unit the input itself is showing right now, nobody outside the US
  // thinks in troy ounces for physical gold.
  const [goldUnit, setGoldUnit] = useState<"g" | "kg">("g");

  function set<K extends keyof Holding>(key: K, value: Holding[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function pickQuickAsset(q: QuickAsset) {
    setQuickAsset(q);
    setDraft((d) => ({
      ...d,
      name: q.label,
      assetClass: q.assetClass,
      entryMode: "quantity",
      lookupSymbol: q.lookupSymbol,
      currency: q.currency,
      taxTreatment: initial && initial.assetClass === q.assetClass ? d.taxTreatment : defaultTaxTreatmentForClass(q.assetClass),
      quantity: initial && matchingQuickAsset(initial)?.key === q.key ? d.quantity : 0,
    }));
  }

  // Auto-fills the live lookup symbol for a recognizable coin/metal name once the
  // holding is (or becomes) crypto or a precious metal, but never overwrites one the
  // user already typed themselves. Name and asset class can be set in either order, so
  // both setters check it.
  function suggestSymbol(name: string, cls: AssetClass, existing: string | undefined): string | undefined {
    if ((cls !== "crypto" && cls !== "precious_metal") || existing) return existing;
    return guessCoingeckoId(name) ?? existing;
  }

  function setName(name: string) {
    setDraft((d) => ({ ...d, name, lookupSymbol: suggestSymbol(name, d.assetClass, d.lookupSymbol) }));
  }

  function setAssetClass(cls: AssetClass) {
    setDraft((d) => ({
      ...d,
      assetClass: cls,
      entryMode: initial ? d.entryMode : defaultModeForClass(cls),
      taxTreatment: initial ? d.taxTreatment : defaultTaxTreatmentForClass(cls),
      lookupSymbol: suggestSymbol(d.name, cls, d.lookupSymbol),
    }));
  }

  function setEntryMode(mode: EntryMode) {
    setDraft((d) => ({ ...d, entryMode: mode }));
  }

  function setTaxTreatment(treatment: TaxTreatment) {
    setDraft((d) => ({ ...d, taxTreatment: treatment }));
  }

  function addContribution() {
    const c: DraftContribution = {
      id: newId(),
      amount: 0,
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
    };
    setDraft((d) => ({ ...d, contributions: [...d.contributions, c] }));
  }

  function updateContribution(id: string, patch: Partial<ContributionSchedule>) {
    setDraft((d) => ({
      ...d,
      contributions: d.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeContribution(id: string) {
    setDraft((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== id) }));
  }

  const canFetchLive =
    draft.entryMode === "quantity" &&
    (draft.assetClass === "crypto" ||
      draft.assetClass === "precious_metal" ||
      draft.assetClass === "equity" ||
      draft.assetClass === "other");

  const quantityValuePreview =
    draft.entryMode === "quantity" && draft.quantity && draft.price
      ? formatMoney(draft.quantity * draft.price, draft.currency)
      : null;

  const convertedPreview =
    draft.currency !== baseCurrency
      ? convert(draft.entryMode === "value" ? draft.value : (draft.quantity ?? 0) * (draft.price ?? 0), draft.currency, baseCurrency, fxRates)
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const value = draft.entryMode === "value" ? draft.value : (draft.quantity ?? 0) * (draft.price ?? 0);
    const valueChanged = !initial || initial.value !== value;
    onSave({
      ...draft,
      value,
      valueUpdatedAt: valueChanged ? new Date().toISOString() : draft.valueUpdatedAt,
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Edit holding" : "Add holding"}</h2>

        <div className="form-field span-2" style={{ marginBottom: 14 }}>
          <label>Quick add</label>
          <div className="chips">
            {QUICK_ASSETS.map((q) => (
              <button
                key={q.key}
                type="button"
                className={`chip${quickAsset?.key === q.key ? " active" : ""}`}
                onClick={() => pickQuickAsset(q)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <span className="help">
            Pick one and you'll only need to enter a quantity — price and value update automatically. Anything
            else (stocks, cash accounts, ...) uses the full form below.
          </span>
        </div>

        {quickAsset ? (
          <div className="form-grid">
            <div className="form-field span-2">
              <div className="sr-top">
                <span className="name">{quickAsset.label}</span>
                <button type="button" className="link-btn" onClick={() => setQuickAsset(null)}>
                  Not this — enter manually
                </button>
              </div>
              <span className="help">
                Live price fetched from CoinGecko automatically after saving, refreshed every 5 minutes — you don't
                need to enter one.
              </span>
            </div>

            <div className="form-field">
              <label>Quantity{quickAsset.key === "gold" ? ` (${goldUnit})` : ""}</label>
              <input
                type="number"
                step="any"
                autoFocus
                value={
                  quickAsset.key === "gold"
                    ? emptyIfZero(goldUnit === "kg" ? (draft.quantity ?? 0) / 1000 : draft.quantity)
                    : emptyIfZero(draft.quantity)
                }
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set("quantity", quickAsset.key === "gold" && goldUnit === "kg" ? n * 1000 : n);
                }}
                placeholder="e.g. 0.5"
              />
            </div>
            {quickAsset.key === "gold" ? (
              <div className="form-field">
                <label>Unit</label>
                <div className="seg-toggle">
                  <button type="button" className={goldUnit === "g" ? "active" : ""} onClick={() => setGoldUnit("g")}>
                    Grams
                  </button>
                  <button type="button" className={goldUnit === "kg" ? "active" : ""} onClick={() => setGoldUnit("kg")}>
                    Kilograms
                  </button>
                </div>
              </div>
            ) : (
              <div className="form-field">
                <label>Currency</label>
                <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {quickAsset.key === "gold" && (
              <div className="form-field span-2">
                <label>Currency</label>
                <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {convertedPreview != null && (
              <div className="form-field span-2 help">≈ {formatMoney(convertedPreview, baseCurrency)}</div>
            )}

            <div className="form-field span-2">
              <label>Tax treatment</label>
              <select value={draft.taxTreatment} onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}>
                {(Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((t) => (
                  <option key={t} value={t}>
                    {TAX_TREATMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field span-2">
              <label>Notes (optional)</label>
              <input value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <div className="form-field span-2">
              <label>Asset</label>
              <input
                required
                value={draft.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bitcoin, VAS, ING Savings Maximiser"
              />
            </div>

            <div className="form-field span-2">
              <label>Asset class</label>
              <select value={draft.assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
                {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((cls) => (
                  <option key={cls} value={cls}>
                    {ASSET_CLASS_LABELS[cls]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field span-2">
              <label>Tax treatment</label>
              <select value={draft.taxTreatment} onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}>
                {(Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((t) => (
                  <option key={t} value={t}>
                    {TAX_TREATMENT_LABELS[t]}
                  </option>
                ))}
              </select>
              <span className="help">
                How this holding's projected growth is taxed — never applied to contributions, that's already your
                post-tax money. Set your rate in Settings. Not tax advice — check anything unusual (like an informal
                family arrangement) with an accountant.
              </span>
            </div>

            <div className="form-field span-2">
              <label>How do you want to enter it?</label>
              <div className="seg-toggle">
                <button
                  type="button"
                  className={draft.entryMode === "value" ? "active" : ""}
                  onClick={() => setEntryMode("value")}
                >
                  By value
                </button>
                <button
                  type="button"
                  className={draft.entryMode === "quantity" ? "active" : ""}
                  onClick={() => setEntryMode("quantity")}
                >
                  By quantity
                </button>
              </div>
              <span className="help">
                {draft.entryMode === "value"
                  ? "You type the current value yourself — simplest, but there's nothing to auto-lookup since no unit price is involved."
                  : "For crypto with a recognized name, the live price fills in automatically after saving — you only need the quantity."}
              </span>
            </div>

            {draft.entryMode === "value" ? (
              <>
                <div className="form-field">
                  <label>Current value</label>
                  <input
                    type="number"
                    step="any"
                    value={emptyIfZero(draft.value)}
                    onChange={(e) => set("value", Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label>Currency</label>
                  <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={emptyIfZero(draft.quantity)}
                    onChange={(e) => set("quantity", Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label>Price per unit</label>
                  <input
                    type="number"
                    step="any"
                    value={emptyIfZero(draft.price)}
                    onChange={(e) => set("price", Number(e.target.value))}
                  />
                </div>
                <div className="form-field span-2">
                  <label>Currency</label>
                  <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                {quantityValuePreview && <div className="form-field span-2 help">= {quantityValuePreview}</div>}
              </>
            )}

            {convertedPreview != null && (
              <div className="form-field span-2 help">
                ≈ {formatMoney(convertedPreview, baseCurrency)}
              </div>
            )}
            {draft.currency !== baseCurrency && convertedPreview == null && (
              <div className="form-field span-2 help">
                No exchange rate set for {draft.currency} yet — one will be fetched automatically, or add one manually.
              </div>
            )}

            {canFetchLive && (
              <div className="form-field span-2">
                <label>Live lookup symbol (optional)</label>
                <input
                  value={draft.lookupSymbol ?? ""}
                  onChange={(e) => set("lookupSymbol", e.target.value)}
                  placeholder={
                    draft.assetClass === "crypto"
                      ? "CoinGecko id, e.g. bitcoin"
                      : draft.assetClass === "precious_metal"
                        ? "pax-gold for gold — leave blank for silver etc."
                        : "Ticker, e.g. VAS.AX or AAPL"
                  }
                />
                <span className="help">
                  {draft.assetClass === "crypto"
                    ? "Reliable — fetched from CoinGecko's free public API, refreshed automatically."
                    : draft.assetClass === "precious_metal"
                      ? "Gold only, via PAX Gold (PAXG) — a token pegged 1:1 to a troy ounce, converted automatically to a price per GRAM (so quantity below should be grams, not troy ounces). Can carry a small premium or discount vs spot. Other metals have no free live source; leave blank and update manually."
                      : "Best-effort — an unauthenticated lookup that can fail; value will stay manual if it does."}
                </span>
              </div>
            )}

            <div className="form-field span-2">
              <label>Notes (optional)</label>
              <input value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
        )}

        <h2 style={{ fontSize: 14, marginTop: 20 }}>Contributions</h2>
        <p className="help" style={{ marginTop: -6, marginBottom: 10 }}>
          How much, how often, and from when you plan to keep adding to this. Add as many rows as you like.
        </p>
        {draft.contributions.map((c) => {
          const isWithdraw = c.amount < 0;
          return (
          <div className="contribution-row" key={c.id}>
            <div className="form-field">
              <label>Amount ({draft.currency})</label>
              <input
                type="number"
                step="any"
                min={0}
                value={emptyIfZero(Math.abs(c.amount))}
                onChange={(e) => {
                  const magnitude = Math.abs(Number(e.target.value));
                  updateContribution(c.id, { amount: isWithdraw ? -magnitude : magnitude });
                }}
              />
            </div>
            <div className="form-field">
              <label>Direction</label>
              <div className="seg-toggle">
                <button
                  type="button"
                  className={!isWithdraw ? "active" : ""}
                  onClick={() => updateContribution(c.id, { amount: Math.abs(c.amount) })}
                >
                  Add
                </button>
                <button
                  type="button"
                  className={isWithdraw ? "active" : ""}
                  onClick={() => updateContribution(c.id, { amount: -Math.abs(c.amount) })}
                >
                  Withdraw
                </button>
              </div>
            </div>
            <div className="form-field">
              <label>Frequency</label>
              <select
                value={c.frequency}
                onChange={(e) => updateContribution(c.id, { frequency: e.target.value as ContributionFrequency })}
              >
                {(Object.keys(FREQUENCY_LABELS) as ContributionFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Start date</label>
              <input
                type="date"
                value={c.startDate}
                onChange={(e) => updateContribution(c.id, { startDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>End date (optional)</label>
              <input
                type="date"
                disabled={c.frequency === "once"}
                value={c.endDate ?? ""}
                onChange={(e) => updateContribution(c.id, { endDate: e.target.value || undefined })}
              />
            </div>
            <button type="button" className="danger" onClick={() => removeContribution(c.id)}>
              Remove
            </button>
          </div>
          );
        })}
        <button type="button" onClick={addContribution}>
          + Add contribution
        </button>

        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete holding
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
