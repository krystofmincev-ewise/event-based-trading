# Event Edge Lab

Event Edge Lab is a local, interactive Monte Carlo laboratory for studying bankroll and position sizing across repeated binary-outcome event trades. It is designed to make the tension between expected upside, typical compounded growth, drawdown, and practical ruin visible—not to execute trades or produce personalized advice.

The model is deliberately explicit: on every trade, a fraction `f` of the **current** bankroll is premium/capital at risk. A win earns net profit `b` per unit staked; a loss forfeits the stake. The browser combines seeded simulations, pathwise risk statistics, a position-size frontier, a hit-rate × size heatmap, and synchronized Kelly comparisons in a dark quantitative-research interface.

> Educational scenario analysis only. No broker connection, credentials, telemetry, live market data, execution, or personalized financial advice.

## What the lab answers

- How far apart are expected and median terminal bankrolls?
- What do the 5th–95th percentile range and a few deterministic sample paths look like?
- How often does a path finish below its start, cross a practical-ruin threshold, or breach a severe drawdown?
- How do annualized volatility, Sharpe, and Sortino change as position size grows?
- Where is the analytical Kelly fraction, and what finite-horizon risk appears at quarter-, half-, and full-Kelly?
- How sensitive is typical growth to a joint change in hit probability and position size?
- How does the same-horizon strategy distribution compare with a transparent, configurable market-like model?

## Quick start

Requirements: Node.js 22.12 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local API listens on [http://127.0.0.1:8787](http://127.0.0.1:8787); its health check is `/api/health`. Vite proxies browser `/api` requests to the API.

The default experiment uses 5,000 paths, a one-year horizon, 1.5 trades/week, a 58% hit probability, 1× net payout, 8% of current bankroll at risk, and seed `event-edge-2026`. Controls are recomputed after a short debounce.

The input console shows a conservative total path-trade estimate. Combinations above the local four-million-operation budget are rejected before simulation with guidance to reduce paths, frequency, or horizon. This protects the single-process API from extreme multi-surface work and never silently lowers the main or staked Kelly sample count; the no-stake Kelly baseline is exact and requires no sampling.

## Model in one page

For bankroll `W`, current-bankroll fraction at risk `f`, net win multiple `b > 0`, and binary outcome `X ∈ {0,1}`:

```text
win:   W′ = W(1 + fb)
loss:  W′ = W(1 − f)
```

For a contract that pays `$1` in total and costs all-in price `c`, `b = (1 − c) / c` and equivalently:

```text
W′ = W(1 − f + (f/c)X)
```

`f` is the premium/capital-at-risk fraction. Payout-notional fraction `h = f/c` is a different quantity and the UI labels both explicitly.

For known stationary hit probability `p`, full Kelly is:

```text
raw f* = (bp − (1 − p)) / b
price form = (p − c) / (1 − c)
actionable f* = clamp(raw f*, 0, 1)
```

A negative raw Kelly result means no long allocation under the supplied inputs; it does not imply automatically shorting an opposite contract. Kelly is the analytical expected-log-growth optimum. Monte Carlo is used to visualize finite-horizon risk around that identity, not to estimate the optimum. Fractional Kelly is shown as a robustness comparison, not a recommendation.

Practical ruin is configurable and defaults to 1% of starting capital. When a positive path crosses that threshold, its remaining cash is retained and carried forward while the path is marked stopped. This is not called literal bankruptcy. Literal zero occurs only when `f = 1` and a loss occurs.

See [Methodology](docs/METHODOLOGY.md) for exact aggregation, ratio, quantile, drawdown, benchmark, and numerical-stability definitions.

## Outputs

- Expected, median, p05/p25/p75/p95 terminal capital and total return
- Expected- and median-terminal implied CAGR over the selected calendar horizon
- Probability of loss and probability of crossing practical ruin
- Median and p90 pathwise maximum drawdown plus severe-drawdown probability
- Weekly end-of-week volatility, Sharpe, and Sortino annualized by `√52`
- Pointwise fan quantiles with six deterministic sample paths
- Terminal-return and maximum-drawdown histograms
- Common-random-number position-size sweep with the analytical Kelly marker
- Scrollable semantic hit-probability × size heatmap table
- Same-path no-stake, quarter-, half-, and full-Kelly comparison
- Configurable lognormal market-like context over the same horizon

The market-like panel is a stochastic model with user-editable arithmetic drift and volatility. It is **not historical S&P 500 data**, and its returns are never subtracted in the strategy Sharpe ratio.

## Architecture

```text
apps/web                 React 19 + Vite client
  src/charts             SVG fan, histogram, frontier, and heatmap views
  src/components         controls, metrics, benchmark, and Kelly study
  src/hooks              debounced, abortable local data loading
apps/api                 small Node HTTP adapter and validation boundary
packages/simulation      deterministic dependency-free domain/math library
docs/METHODOLOGY.md      formulas, exact conventions, sources, limitations
scripts/dev.mjs          local API + web process runner
```

The simulation package has no React or server dependency. The API owns runtime validation and returns typed JSON from three POST routes:

| Route           | Response                                                            |
| --------------- | ------------------------------------------------------------------- |
| `/api/simulate` | Main paths, pointwise fan, histograms, metrics, metadata, warnings  |
| `/api/explore`  | Position-size sweep and hit-rate × size heatmap                     |
| `/api/kelly`    | No-stake, quarter-, half-, and full-Kelly finite-horizon comparison |

All three accept the same complete `SimulationInput` JSON object. Invalid input returns HTTP 422 with field-level details; malformed JSON returns 400; non-JSON POSTs return 415; request bodies above 64 KiB return 413. The local API accepts loopback Host/Origin values only and verifies that response DTOs contain no non-finite numbers before serialization.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

Tests cover Kelly identities and edge cases, exact bankroll recurrences, pathwise drawdown, practical-ruin semantics, deterministic seeds, R-7 quantiles and histograms, nominal scaling invariance, numerical overflow/underflow behavior, API contracts, and critical client controls/results states.

## Assumptions and limitations

The strategy model assumes independent, identically distributed binary outcomes with stationary, known `p` and `b`. It does not model probability-estimation error, correlated or clustered outcomes, regime changes, market impact, liquidity, slippage, contract availability, taxes, or broader tail events. Square-root-of-time risk annualization assumes no serial correlation.

The inputs can describe an abstract event or one-touch binary contract only after the user supplies its hit probability and net payout. A path-dependent barrier option cannot be priced from a win rate alone, and this project does not pretend to infer the underlying asset/barrier path.

Fan-chart bands are pointwise cross-path quantiles; they are not realizable individual trajectories. Expected wealth can be dominated by rare right-tail paths and should be read beside the median and risk distributions. Reproducible seeds make comparisons auditable but do not eliminate Monte Carlo sampling error.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.

## License status

No software license is granted in this repository yet. The owner should make an explicit license choice before public redistribution; absence of a `LICENSE` file means the default copyright restrictions apply.
