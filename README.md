# Event Edge Lab

Event Edge Lab is a local Monte Carlo laboratory for studying position sizing across repeated binary event contracts. It combines executable contract economics, whole-contract units, pathwise risk, a versioned public market-context catalog, and optional stochastic calibration/regime/execution stress. It does not execute trades or produce personalized financial advice.

> Educational scenario analysis only. No broker connection, credentials, telemetry, live market data, execution, or personalized financial advice.

## What the lab answers

- Is the probability estimate above the contract's **all-in break-even probability**?
- What are signed theoretical Kelly, actionable long-only Kelly, and probability-haircut conservative Kelly?
- How many whole contracts fit inside the selected dollar risk budget?
- What finite-horizon terminal, drawdown, practical-ruin, Sharpe, and Sortino distributions follow?
- How sensitive are results to hit probability and position size?
- How do sector, NYSE-relative size-volatility context, 1/10-day horizon, and 0/2/5/10% terminal thresholds change a long-run unconditional market-frequency proxy?
- How much wider do outcomes become under integer Poisson opportunity flow, path-level calibration uncertainty, weekly regimes, and right-skewed cost stress?

A hit rate does **not** need to exceed 50%. The correct long-side edge test is estimated hit probability versus `(purchase price + costs) / settlement payout`. A 45% hit estimate can be positive-EV when all-in break-even is 40%. “Doing the opposite” requires a separately observed opposite-side quote, payout, costs, and probability; it is not a free transformation.

## Quick start

Requires Node.js 22.12 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local API listens on port `8787`; Vite proxies browser `/api` requests.

The initial screen resolves the Information Technology / NYSE top-30% size-volatility / one-day / positive-return context from public 2000–2025 Fama–French portfolio returns. Raw knot frequencies and Jeffreys-smoothed research frequencies are distinguished. Model lift and initial position both default to zero. The probability-scaled hypothetical price, illustrative single-side XSPBX Customer fee, and $0.50 fill-cost stress are visibly separated and machine-labelled non-executable. The simulation starts with Poisson whole-opportunity flow, mean-preserving Beta calibration stress, mean-preserving weekly regimes, and right-skewed execution-cost stress.

See [Empirical context catalog](docs/EMPIRICAL_CONTEXT.md) for exact definitions, mappings, sources, and evidence tiers.

## Contract and execution model

For purchase price `a`, round-trip fees/slippage `k`, and winning settlement payout `S`:

```text
maximum loss per contract L = a + k
net win profit G            = S − a − k
net odds b                  = G / L
break-even probability      = L / S
expected profit / contract  = pS − L
```

Before each event, target fraction `f` is converted to an executable integer position:

```text
n = floor(current bankroll × f / L)
win:  W′ = W + nG
loss: W′ = W − nL
```

The unused risk budget remains cash. Kelly fractions are bankroll allocations, not fractional trades.

For known stationary `p` and `b`:

```text
signed Kelly formula = (bp − (1 − p)) / b
conservative p       = max(0, p − probability haircut)
conservative Kelly   = Kelly evaluated at conservative p
actionable long size = clamp(Kelly, 0, 1)
```

The haircut is a transparent stress assumption—not a confidence interval, calibrated forecast, or guarantee. The model shows raw and conservative results separately.

## Agent-facing sizing endpoint

`POST /api/size` returns a typed, runtime-validated sizing decision without running Monte Carlo. Example request:

```json
{
  "bankroll": 10000,
  "winProbability": 0.55,
  "probabilityHaircut": 0.03,
  "contractPurchasePrice": 49,
  "settlementPayout": 100,
  "roundTripCosts": 1,
  "sizingPolicy": "conservative-kelly",
  "customFraction": 0,
  "maximumPositionFraction": 0.03
}
```

Key response fields include break-even probability, signed and actionable Kelly, the uncapped and capped target fraction, dollar risk budget, floored whole-contract count, actual deployed risk fraction, maximum loss/profit, estimated/conservative EV, and the `bindingReason`. A zero recommendation distinguishes non-positive selected-policy edge, a zero custom target, a zero hard cap, and whole-contract rounding. Conservative Kelly can therefore return `non-positive-edge` even when the unadjusted estimate remains positive-EV.

The policy is one of `conservative-kelly`, `estimated-kelly`, or `custom`. `maximumPositionFraction` is an independent hard cap; a Kelly result does not override it.

Before execution, an agent must separately cap the returned quantity by current quoted depth, venue/product limits, and remaining portfolio-wide open-risk capacity. It must also persist the venue, symbol, settlement rule, probability source, quote timestamp, and calibration provenance. This local endpoint sizes supplied terms; it does not verify that a product is tradable.

## Why the app asks for an observed quote

For sizing a candidate today, an executable ask, fixed payout, and conservative all-in costs are more useful than a hypothetical mean and standard deviation of option price. An independently sampled “average price” can break the relationship between the forecast and the price at which the strategy chooses to trade.

For a future portfolio forecast, the better extension is to resample historical, timestamped event rows so probability, price, liquidity, company size, sector, and market regime remain jointly distributed. Until that dataset exists, the empirical composer uses unconditional public portfolio context with a zero model-skill lift. Its optional stochastic inputs are explicitly sensitivity models rather than observed joint event/quote data.

The US small/mid/large-cap cards are research context only. The July 2026 [S&P U.S. Indices methodology](https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf) lists S&P Composite 1500 addition ranges of $1.2B–$8.0B, $8.0B–$22.7B, and $22.7B+. The displayed 19.42%, 15.85%, and 13.05% three-year standard deviations come from June 30, 2026 IJR, IJH, and IVV fact sheets. Broad ETF volatility is not an individual company earnings move, forecast hit rate, contract cost, or sizing input.

## Outputs

- Expected, median, and p05/p25/p75/p95 terminal capital
- Implied CAGR, probability of loss, practical ruin, and inability to execute one contract at the selected risk budget
- Median/p90 pathwise maximum drawdown and severe-drawdown probability
- Weekly pooled volatility, Sharpe, and Sortino annualized by `√52`
- Pointwise fan chart, deterministic sample paths, and histograms
- Position-size sweep with estimated-p and conservative Kelly markers
- Hit-probability × size heatmap
- Same-path no-stake, current-size, conservative-Kelly, and estimated-p long-only Kelly comparisons
- Expected/realized opportunity counts, path and path-week mean probabilities, and latent-probability distributions for stochastic runs
- Twelve sector/industry profiles, three size contexts, two horizons, and directional/absolute terminal thresholds
- Configurable modeled S&P-style benchmark context (not historical S&P 500 data)

The engine also reports a closed-form **continuous-fraction reference**. It ignores whole-contract rounding and the practical-ruin stop, so it is explicitly not an exact expectation for the executable simulation.

## Architecture

```text
apps/web                 React + Vite client
apps/api                 local Node HTTP API and runtime boundary
packages/simulation      dependency-free typed domain/math library
docs/METHODOLOGY.md      formulas, conventions, sources, limitations
docs/EMPIRICAL_CONTEXT.md data provenance, mappings, evidence tiers, APIs
```

API routes:

| Route                   | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `/api/size`             | Deterministic whole-contract sizing decision for agents/tools |
| `/api/scenarios`        | Versioned empirical context catalog and evidence metadata     |
| `/api/scenario/resolve` | Resolve a sector/cap/horizon/threshold selection              |
| `/api/simulate`         | Main Monte Carlo paths, metrics, histograms, and warnings     |
| `/api/explore`          | Position-size and hit-probability sensitivity surfaces        |
| `/api/kelly`            | Whole-contract finite-horizon sizing comparison               |

The compute API accepts loopback Host/Origin values only. Inputs are runtime validated, non-finite response values are rejected, and an operation budget prevents unsafe local workloads.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

## Important limitations

The fixed mode remains IID. The stochastic mode adds a mean-preserving Beta path-level probability draw, mean-preserving weekly shared log-odds shocks, integer Poisson opportunity counts, and right-skewed execution-cost stress. These are sensitivity models—not a substitute for jointly resampling a timestamped event/outcome/quote ledger. The engine assumes opportunities resolve sequentially before capital is reused; it does not model overlapping open positions, depth, market impact, taxes, an underlying price path, or a path-dependent barrier option. Enter a timestamped executable ask—not a midpoint—and every applicable cost before candidate sizing.

The binary engine is not a conventional listed stock-option engine. A standard US equity option generally represents 100 shares and has a variable payoff. Its realized payoff requires the strike, settlement price, multiplier, and exercise/settlement mechanics; valuation additionally uses time to expiry, volatility, rates, and dividends. Those products require a separate engine rather than the fixed-payout Kelly equations used here. See the [OCC equity-option specifications](https://www.theocc.com/clearance-and-settlement/clearing/equity-options-product-specifications).

The app also does not assert that single-company fixed-payout event contracts are available to a US retail customer. At its June 23, 2026 launch, [Cboe Predicts](https://ir.cboe.com/news/news-details/2026/Cboe-Introduces-Cboe-Predicts-Launching-First-Products-in-New-Prediction-Markets-Suite/default.aspx) described Mini-S&P 500 Index binaries settling at $100 or zero, not a general single-stock earnings product. Verify venue registration, product availability, and settlement rules independently.

Increasing path count reduces Monte Carlo sampling noise; it does not make the inputs correct. See [Methodology](docs/METHODOLOGY.md) for exact definitions.

## License status

No software license is granted yet. The owner should make an explicit license choice before public redistribution.
