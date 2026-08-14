# Event Edge Lab

Event Edge Lab is a local Monte Carlo laboratory for studying position sizing across repeated binary event contracts. It uses executable contract economics, whole-contract units, pathwise risk, and an explicit probability-uncertainty haircut. It does not execute trades or produce personalized financial advice.

> Educational scenario analysis only. No broker connection, credentials, telemetry, live market data, execution, or personalized financial advice.

## What the lab answers

- Is the probability estimate above the contract's **all-in break-even probability**?
- What are raw Kelly and probability-haircut conservative Kelly?
- How many whole contracts fit inside the selected dollar risk budget?
- What finite-horizon terminal, drawdown, practical-ruin, Sharpe, and Sortino distributions follow?
- How sensitive are results to hit probability and position size?

A hit rate does **not** need to exceed 50%. The correct long-side edge test is estimated hit probability versus `(purchase price + costs) / settlement payout`. A 45% hit estimate can be positive-EV when all-in break-even is 40%. “Doing the opposite” requires a separately observed opposite-side quote, payout, costs, and probability; it is not a free transformation.

## Quick start

Requires Node.js 22.12 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local API listens on port `8787`; Vite proxies browser `/api` requests.

The default scenario is intentionally restrained: 5,000 paths, one year, two whole events per week, $100,000 starting capital, 54% estimated hit probability, a 3 percentage-point probability haircut, $0.49 observed purchase price, $1 settlement payout, $0.01 costs, and a 2% target risk budget.

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
raw Kelly            = (bp − (1 − p)) / b
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

Key response fields include break-even probability, raw and conservative Kelly, the uncapped and capped target fraction, dollar risk budget, floored whole-contract count, actual deployed risk fraction, maximum loss/profit, estimated/conservative EV, and the binding constraint.

The policy is one of `conservative-kelly`, `estimated-kelly`, or `custom`. `maximumPositionFraction` is an independent hard cap; a Kelly result does not override it.

## Outputs

- Expected, median, and p05/p25/p75/p95 terminal capital
- Implied CAGR, probability of loss, practical ruin, and inability to execute one contract at the selected risk budget
- Median/p90 pathwise maximum drawdown and severe-drawdown probability
- Weekly pooled volatility, Sharpe, and Sortino annualized by `√52`
- Pointwise fan chart, deterministic sample paths, and histograms
- Position-size sweep with raw and conservative Kelly markers
- Hit-probability × size heatmap
- Same-path no-stake, current-size, conservative-Kelly, and raw-Kelly comparisons
- Configurable modeled market context (not historical S&P 500 data)

The engine also reports a closed-form **continuous-fraction reference**. It ignores whole-contract rounding and the practical-ruin stop, so it is explicitly not an exact expectation for the executable simulation.

## Architecture

```text
apps/web                 React + Vite client
apps/api                 local Node HTTP API and runtime boundary
packages/simulation      dependency-free typed domain/math library
docs/METHODOLOGY.md      formulas, conventions, sources, limitations
```

API routes:

| Route           | Purpose                                                       |
| --------------- | ------------------------------------------------------------- |
| `/api/size`     | Deterministic whole-contract sizing decision for agents/tools |
| `/api/simulate` | Main Monte Carlo paths, metrics, histograms, and warnings     |
| `/api/explore`  | Position-size and hit-probability sensitivity surfaces        |
| `/api/kelly`    | Whole-contract finite-horizon sizing comparison               |

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

Outcomes are IID with stationary supplied probabilities and terms. The app does not estimate probabilities from research, calibrate the haircut, model clustered outcomes/regime shifts, guarantee fills, model limited depth or changing spreads, apply taxes, infer an underlying price process, or price a path-dependent barrier option. Enter an executable ask/acquisition cost—not a midpoint—and include conservative slippage/fees.

Increasing path count reduces Monte Carlo sampling noise; it does not make the inputs correct. See [Methodology](docs/METHODOLOGY.md) for exact definitions.

## License status

No software license is granted yet. The owner should make an explicit license choice before public redistribution.
