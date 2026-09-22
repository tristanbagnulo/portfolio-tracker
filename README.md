# Portfolio Tracker

A personal dashboard for tracking current wealth and projecting it forward, across
holdings denominated in different currencies (e.g. Bitcoin/gold in USD, ASX shares
or a high-interest savings account in AUD).

## What it does

- **Holdings** are entered manually, either as a plain value ("this is worth $X
  right now") or as quantity + price per unit — whichever you actually know.
  Currency defaults to your display currency so most entries need no FX at all.
- **Contributions** are entered per holding: how much, how often, from when.
- **Prices**: crypto refreshes live from CoinGecko (free, no key). Equities attempt
  a best-effort live lookup that can fail (an unauthenticated API with no
  guarantees) and fall back to manual. Precious metals and any value-mode holding
  have no free live source, so they're manual only. Every holding shows when its
  value was last updated, and flags anything over 30 days stale.
- **FX**: exchange rates refresh from [Frankfurter](https://www.frankfurter.app/)
  (free, ECB-sourced, no key) to convert each holding into your chosen display
  currency.
- **Auto-refresh**: prices and FX refresh automatically every 5 minutes while the
  tab is open and visible (toggle it off in Settings), plus a manual "Refresh now"
  button.
- **Projections** are a separate tab from your holdings — growth assumptions are
  never attached to a holding, since nobody knows future returns. Instead you
  build named **scenarios** (e.g. "Conservative", "Bull run"), each a set of
  sliders — one per asset class — and compare as many as you like on the same
  chart. Time horizon is a 1–50 year slider. Compounding (monthly) is always on.
- **History** is a placeholder tab, deliberately not faked: a real "value over
  time" chart needs transaction/price history pulled from your actual platforms,
  which manual entry can't reconstruct.
- **Storage**: everything lives in this browser's `localStorage`. Use "Export
  backup" to save a JSON snapshot and "Import backup" to restore it — this is
  also how you'd move data to another device.

## Running it

```bash
npm install
npm run dev       # dev server, e.g. http://localhost:5173
```

Or build once and run the static output:

```bash
npm run build
npm run preview   # serves dist/, e.g. http://localhost:4173
```

Pushes to `main` also build and deploy to GitHub Pages automatically (see
`.github/workflows/deploy.yml`) once the repo is public and Pages is enabled with
source "GitHub Actions" under Settings → Pages — that's what makes this reachable
from a phone. The app's **code** is then public; your actual holdings, amounts and
scenarios never leave whichever browser you're using — they live only in that
browser's `localStorage` and are never sent to GitHub, Claude, or anywhere else
except the anonymous CoinGecko/Frankfurter price lookups described above.

Your data lives in that browser's `localStorage`, tied to whichever origin
(`localhost:5173`, the Pages URL, or a different machine) you open it from. Use
**Export backup** regularly and **Import backup** to move data between origins —
it's also your only backup if browser data gets cleared.

## Roadmap

This is v1: manual holdings and contributions with live price/FX lookups layered
in where free public APIs allow it, and scenario-based projections. Natural next
steps: real brokerage/exchange/bank integrations to pull holdings and transactions
automatically (which would also unlock the History tab), and Monte Carlo-style
projections instead of a deterministic path per scenario.
