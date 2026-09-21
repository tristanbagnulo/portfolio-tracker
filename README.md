# Portfolio Tracker

A personal dashboard for tracking current wealth and projecting it forward, across
holdings denominated in different currencies (e.g. Bitcoin/gold in USD, ASX shares
or a high-interest savings account in AUD).

## What it does

- **Holdings** are entered manually: name, asset class, native currency, quantity,
  current price, and an assumed annual growth rate.
- **Contributions** are entered manually too — how much you add, how often, and
  from when — per holding.
- **Prices**: crypto refreshes live from CoinGecko (free, no key). Equities attempt
  a best-effort live lookup that can fail (an unauthenticated API with no
  guarantees) and fall back to manual. Precious metals have no free live source
  yet, so they're manual only. Every price shows whether it's live or manual and
  when it was last updated.
- **FX**: exchange rates refresh from [Frankfurter](https://www.frankfurter.app/)
  (free, ECB-sourced, no key) to convert each holding into your chosen display
  currency.
- **Projection**: simulates each holding compounding monthly at its own growth
  rate, with contributions applied on schedule, out to a 5/10/20/30-year horizon.
  FX rates are held at today's snapshot for the whole projection — a known
  simplification, since nobody can predict future exchange rates.
- **Storage**: everything lives in this browser's `localStorage`. Use "Export
  backup" to save a JSON snapshot and "Import backup" to restore it — this is
  also how you'd move data to another device for now.

## Local development

```bash
npm install
npm run dev
```

## Roadmap

This is v1: fully manual holdings and contributions, with live price/FX lookups
layered in where free public APIs allow it. Natural next steps: real brokerage/
exchange/bank integrations to pull holdings and transactions automatically,
historical price tracking (so "gain since inception" can be computed rather than
assumed), and Monte Carlo-style projections instead of a single deterministic
growth-rate path.

## Deploy

Pushes to `main` build and deploy to GitHub Pages automatically (see
`.github/workflows/deploy.yml`). Enable Pages for this repo with source "GitHub
Actions" under Settings → Pages.
