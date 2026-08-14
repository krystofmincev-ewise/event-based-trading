# Methodology and sources

This document defines Event Edge Lab v2. The implementation is educational scenario analysis, not an execution engine, forecast, option-pricing system, or recommendation.

## 1. Held-to-settlement contract economics

Inputs are observed purchase price `a > 0`, winning settlement payout `S > 0`, and round-trip costs `k ≥ 0`. Costs should include commissions, exchange fees, and a fill/slippage allowance. Valid contracts require `a + k < S`.

```text
maximum loss L       = a + k
net winning profit G = S − a − k
net odds b           = G / L
break-even pBE       = L / S
EV per contract      = pS − L
EV / capital at risk = (pS − L) / L
```

Therefore 50% is not a universal edge threshold. A long contract has positive expected value when `p > pBE`, which can occur below 50% for a sufficiently low acquisition cost. Reversing direction requires separate terms for the opposite contract; bid/ask spread and fees make it incorrect to assume a costless inverse.

The model cannot derive a barrier-hit probability or price a path-dependent option from a win rate alone.

## 2. Kelly and uncertainty policy

For stationary known `p` and `b`, expected log growth under continuous fraction `f` is:

```text
g(f) = p ln(1 + fb) + (1 − p) ln(1 − f)
raw fK = (bp − (1 − p)) / b
```

The actionable long fraction is clamped to `[0,1]`. A negative result means no long allocation; it does not authorize the opposite side.

Because `p` is estimated, the app requires an explicit probability haircut `h` and reports both scenarios:

```text
estimated p    = p
conservative p = max(0, p − h)
```

Estimated-p Kelly reports both the signed formula result and its actionable long-only value; conservative Kelly uses conservative `p`. The haircut is a judgmental stress bound, not a Normal standard deviation, confidence interval, Bayesian posterior, or proof of calibration. A production agent should source `h` from held-out calibration error, regime-specific backtests, or a stricter risk policy and record that provenance externally.

## 3. Whole events and whole contracts

`eventsPerWeek` and `horizonWeeks` are positive integers. Total events equal their exact product; no event-count rounding and no partial trades occur.

Before every event, a target fraction becomes an integer contract count:

```text
n_t = floor(W_t f / L)
win:  W_{t+1} = W_t + n_t G
loss: W_{t+1} = W_t − n_t L
```

Unused risk budget remains cash. If `n_t = 0`, the event produces no position. The engine reports the initial whole-contract count, actual initial deployed fraction, and probability that the terminal bankroll cannot execute one contract under the selected target fraction. This state is distinct from practical ruin.

For extreme simulated wealth above JavaScript's exact integer range, one-contract rounding is numerically immaterial and the target-fraction recurrence is used. Metadata counts such approximations and a warning is emitted.

## 4. Continuous-fraction reference

For context, the engine returns:

```text
W_0 [1 + f(bp − (1 − p))]^N
```

This is explicitly a **continuous-fraction, unstopped reference**. It is not the exact expected terminal wealth of the executable simulation because whole-contract flooring depends on each path's bankroll. It also ignores the practical-ruin stop. Tests and response metadata preserve this distinction.

## 5. Path generation and aggregation

- Outcomes are IID Bernoulli draws using a deterministic counter-based pseudorandom function keyed by seed, path, and event.
- Common path/event coordinates are reused across size comparisons.
- Main runs accept 100–25,000 paths and 1–104 weeks.
- At most 65 checkpoint columns and six sample paths are retained.
- A conservative four-million path-event budget covers the main run, preview grids, and three staked sizing comparisons.
- Fan bands are pointwise cross-path R-7 quantiles, not individual trajectories.

Practical ruin occurs when post-event capital is at or below the configured share of starting capital. The remaining positive balance is retained and the path freezes. This is not literal bankruptcy.

Pathwise maximum drawdown is:

```text
MDD = max_t(1 − W_t / max_{s≤t} W_s)
```

Terminal statistics include mean, p05/p25/median/p75/p95, total return, implied CAGR, probability below start, practical-ruin probability, and probability of no executable position at the selected risk budget.

## 6. Risk-adjusted statistics

Trades occur sequentially within calendar weeks. The engine pools simulated end-of-week path returns. With weekly observations `R_i` and geometrically converted weekly risk-free rate `r_w`:

```text
annualized volatility = sampleSD(R) × sqrt(52)
Sharpe = (mean(R) − r_w) / sampleSD(R) × sqrt(52)
downside deviation = sqrt[Σ min(R_i − r_w, 0)² / n]
Sortino = (mean(R) − r_w) / downside deviation × sqrt(52)
```

Ratios are `null` when denominators are zero. These are ensemble scenario statistics, not a historical strategy return series. Square-root-of-time annualization assumes no serial correlation.

## 7. Agent sizing decision

The pure `calculatePositionSizing` function and `POST /api/size` accept bankroll, contract terms, estimated probability, haircut, sizing policy, custom fraction, and an independent maximum-position cap.

Policies are `conservative-kelly`, `estimated-kelly`, and `custom`. The result includes:

- contract economics and both Kelly analyses;
- uncapped policy fraction and fraction after the independent cap;
- dollar risk budget and floored contract count;
- actual deployed risk fraction;
- maximum loss/profit and estimated/conservative EV;
- the binding reason: selected-policy non-positive edge, zero custom target, position cap, whole-contract floor, or none.

An automated caller should default to `conservative-kelly`, apply a separately governed maximum-position cap, reject stale/non-executable quotes, and log the source and timestamp of every probability and price. Those operational controls are outside this local app.

The returned whole-contract count must still be bounded externally by current quoted depth, the venue/product position limit, and remaining portfolio-wide open-risk capacity. The caller should attach venue, symbol, exact settlement rule, quote timestamp, probability provenance, and calibration version to its own auditable decision record.

## 8. US market context and instrument boundaries

The visible small/mid/large-cap references are deliberately outside `SimulationInput`; changing context does not recompute or alter a financial result.

The July 2026 S&P U.S. Indices methodology lists these total company market-capitalization guidelines for additions to the S&P Composite 1500 components:

- S&P SmallCap 600: $1.2B–$8.0B
- S&P MidCap 400: $8.0B–$22.7B
- S&P 500: $22.7B+

S&P reviews the ranges and may update them. They are index-eligibility guidelines, not universal legal definitions of company size.

The UI also displays trailing three-year standard deviations for broad investable proxies as of June 30, 2026: IJR 19.42%, IJH 15.85%, and IVV 13.05%. These values give broad cross-sectional risk context only. They are not individual-stock event volatilities, historical earnings moves, forecast probabilities, option prices, or evidence for a universal spread assumption.

This engine represents a genuinely two-state, fixed-payout, held-to-settlement binary contract. A conventional US listed equity call or put usually represents 100 shares and has a variable payoff. Its realized payoff requires strike, settlement price, multiplier, and exercise/settlement mechanics; valuation additionally uses time to expiry, volatility, rates, and dividends. It belongs in a separate option engine and should not be normalized into this binary abstraction. A one-touch barrier also requires a path-hit probability; terminal direction alone is insufficient, and both an up and down barrier may be touched.

Product availability is not assumed. Cboe's June 23, 2026 Cboe Predicts launch described Mini-S&P 500 Index binary options settling at $100 or zero, not a general single-stock earnings contract. A user or agent must verify the regulated venue, product symbol, availability, and settlement rule before treating a simulation record as executable.

## 9. Numerical and model limitations

Log capital remains canonical for compounding, drawdown, and weekly returns. `log1p`, Welford variance, and finite display caps protect numerical integrity. Histograms use linear observed domains.

The model omits probability calibration, serial dependence, cross-position correlation, regime changes, changing quotes/payouts, limited liquidity, market impact, early exits, taxes, assignment/exercise details, and tail model breaks. Only genuinely fixed, two-state contracts belong in this abstraction; ordinary stock options and path-dependent barrier products require separate payoff and pricing models.

The modeled benchmark panel is a configurable lognormal model, not historical S&P 500 data. It is not subtracted from strategy Sharpe. The separate market-cap context section is static reference data and never enters the simulator.

## Primary sources and project conventions

- John L. Kelly Jr., “[A New Interpretation of Information Rate](https://doi.org/10.1002/j.1538-7305.1956.tb03809.x),” 1956.
- William F. Sharpe, “[Mutual Fund Performance](https://doi.org/10.1086/294846),” 1966.
- Frank A. Sortino and Lee N. Price, “[Performance Measurement in a Downside Risk Framework](https://doi.org/10.3905/joi.3.3.59),” 1994.
- S&P Dow Jones Indices, “[S&P U.S. Indices Methodology](https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf),” July 2026.
- BlackRock iShares fact sheets as of June 30, 2026: [IJR](https://www.ishares.com/us/literature/fact-sheet/ijr-ishares-core-s-p-small-cap-etf-fund-fact-sheet-en-us.pdf), [IJH](https://www.ishares.com/us/literature/fact-sheet/ijh-ishares-core-s-p-mid-cap-etf-fund-fact-sheet-en-us.pdf), and [IVV](https://www.ishares.com/us/literature/fact-sheet/ivv-ishares-core-s-p-500-etf-fund-fact-sheet-en-us.pdf).
- OCC, “[Equity Options Product Specifications](https://www.theocc.com/clearance-and-settlement/clearing/equity-options-product-specifications).”
- Cboe, “[Cboe Introduces Cboe Predicts](https://ir.cboe.com/news/news-details/2026/Cboe-Introduces-Cboe-Predicts-Launching-First-Products-in-New-Prediction-Markets-Suite/default.aspx),” June 23, 2026.

Whole-contract flooring, haircut semantics, weekly pooling, practical ruin, operation limits, and the agent DTO are project conventions encoded in tests.
