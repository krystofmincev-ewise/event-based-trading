# Methodology and sources

This document defines Event Edge Lab v1 precisely enough to reproduce or review its output. The implementation is educational scenario analysis, not an execution engine, forecast, option-pricing system, or recommendation.

## 1. Contract and bankroll semantics

Each path contains sequential trades. Before every trade, the premium/capital at risk is fraction `f ∈ [0,1]` of the **current** bankroll `W`. With user-supplied hit probability `p` and net profit `b > 0` per unit stake:

```text
P(win)  = p       W′ = W(1 + fb)
P(loss) = 1 − p   W′ = W(1 − f)
```

For a `$1` total-payout contract bought at all-in price `c ∈ (0,1)`, `b = (1 − c)/c` and:

```text
W′ = W(1 − f + (f/c)X), X ∈ {0,1}
```

Payout-notional share `h = f/c` is not the bankroll fraction at risk. At `f < 1`, fixed-fraction losses leave a positive mathematical balance. At `f = 1`, one loss yields literal zero.

The model can represent a user-supplied event or one-touch binary hit probability and payout abstractly. It cannot derive a path-dependent barrier probability or price a barrier option from win rate alone.

## 2. Kelly quantities

Expected log growth per trade is:

```text
g(f) = p ln(1 + fb) + (1 − p) ln(1 − f)
```

For known stationary `p` and `b`, its unconstrained optimizer is:

```text
raw fK = (bp − (1 − p)) / b
```

For the `$1` price form:

```text
fK = (p − c) / (1 − c)
```

The actionable long fraction is clamped to `[0,1]`. Negative raw Kelly means no long position under these inputs, not an automatic short of the opposite contract. The opposite contract requires its own probability and price.

Full, half, and quarter Kelly are analytical fractions. Monte Carlo applies those fractions to common seeded outcomes to compare finite-horizon terminal and drawdown distributions; it does not estimate Kelly. Fractional Kelly is a robustness control for misspecified inputs, not a recommendation.

Arithmetic expectation and typical growth can point in opposite directions. At `p = 0.6`, `c = 0.5`, and `f = 0.8`, expected simple return is `+16%` per trade, while:

```text
g = 0.6 ln(1.8) + 0.4 ln(0.2) ≈ −0.291103
```

This is why the UI places expected wealth beside median outcomes and drawdown/ruin risk.

## 3. Time and path generation

- Trade count is `round(tradesPerWeek × horizonWeeks)`, with at least one trade. Metadata and the run manifest report both that whole-trade count and its realized rate `tradeCount / horizonWeeks`; a warning appears when it differs from the requested rate.
- Outcomes use a deterministic counter-based pseudorandom function keyed by seed, path index, and trade index.
- The same seed and inputs return identical results.
- Sweep, heatmap, and Kelly comparisons reuse path/trade random coordinates. This common-random-number design reduces visual comparison noise.
- The main run accepts 100–25,000 paths and a 1–104 week horizon.
- At most 65 checkpoint columns and six deterministic sample paths are retained. Terminal values, drawdowns, histograms, and metrics are aggregated without retaining every full path.
- Before any API route computes, validation applies a conservative four-million path-trade budget across the requested main run, upper-bound exploratory grids, and three simulated Kelly stakes. The no-stake baseline is exact. Over-budget combinations return HTTP 422 with guidance; displayed estimates and returned sample counts are not silently reduced.

Fan quantiles are computed independently across paths at each shared checkpoint. They are pointwise summaries and do not describe a single realizable path.

## 4. Practical ruin and drawdown

Practical ruin is the first post-trade capital at or below `ruinThresholdFraction × startingCapital`. The default threshold is 1%. The positive threshold-crossing balance is stored and repeated at later checkpoints; the stopped state is tracked separately. All paths—including stopped paths—remain in quantiles and other aggregates, avoiding survivor bias.

Pathwise maximum drawdown is:

```text
MDD = max_t(1 − W_t / max_{s≤t} W_s)
```

The starting bankroll and threshold-crossing observation are included. Maximum drawdown is calculated on each path before its median, p90, distribution, and severe-breach probability are aggregated. The nominal drawdown for an individual path is peak capital minus the later trough at its maximum fractional drawdown.

## 5. Terminal summaries

- Expected terminal capital is the arithmetic mean across all simulated terminal balances.
- Terminal p05/p25/median/p75/p95 use R-7 linear interpolation.
- Expected and median total returns divide their corresponding terminal measure by starting capital and subtract one.
- Implied CAGR is `(terminal / starting)^(1 / horizonYears) − 1`.
- Probability of loss is the share of paths finishing below starting capital.

Histograms use linear-width bins over the observed finite domain. With highly
skewed terminal outcomes, far-right tail values can compress the central mass
visually. The chart exposes full-precision bin bounds and counts for inspection;
v1 does not apply a logarithmic transform or an overflow-bin policy.

- Histogram domains and counts include the complete path sample.

The engine also returns the closed-form **unstopped** arithmetic expectation:

```text
E[W_N] = W_0 [1 + f(bp − (1 − p))]^N
```

It is labeled separately because it is not directly comparable with the stopped simulation when practical ruin binds. Rare right-tail paths can dominate both simulated and analytical expected wealth.

CAGR is calculated from log capital and calendar years. If annualization of an allowed finite short-horizon terminal value exceeds JavaScript's finite numeric range, the result is capped at `Number.MAX_VALUE`, metadata sets `cagrOutputCapped`, and a warning identifies overflow. The client renders that finite cap in scientific notation rather than interpreting JSON `null` as zero.

## 6. Weekly risk-adjusted metrics

Trades occur sequentially within each calendar week. The engine records each path’s end-of-week equity and pools weekly returns across simulated path-weeks. This is an ensemble scenario statistic, not one observed historical return series.

Let annual risk-free rate be `r_f`, weekly return observations be `R_i`, count be `n`, and:

```text
weekly rf = (1 + r_f)^(1/52) − 1
sample SD = sqrt[Σ(R_i − mean(R))² / (n − 1)]
annualized volatility = sample SD × sqrt(52)
Sharpe = (mean(R) − weekly rf) / sample SD × sqrt(52)
downside deviation = sqrt[Σ min(R_i − weekly rf, 0)² / n]
Sortino = (mean(R) − weekly rf) / downside deviation × sqrt(52)
```

Sortino uses the full-sample minimum-acceptable-return convention. Sharpe or Sortino is returned as `null` when its denominator is zero. The S&P 500—or any benchmark return—is not subtracted in Sharpe. Square-root-of-time annualization assumes IID returns and no serial correlation, an especially important limitation because clustered outcomes are omitted.

## 7. Numerical stability

Log capital is canonical during simulation. Win/loss updates use `log1p`; drawdown is calculated from log-capital differences. Display capital is clamped only when conversion would exceed finite JavaScript range, while log-space drawdown and weekly-return calculations remain intact. Underflow is represented with the smallest positive display value rather than mislabeled zero unless the model produces literal zero at full stake. Welford accumulation avoids cancellation in sample variance.

Metadata counts paths that crossed finite display range and warnings distinguish capped display values from canonical modeled wealth.

## 8. Position-size exploration

The sizing sweep includes a regular grid plus the current, quarter-, half-, and full-Kelly fractions. Each point returns median CAGR, median terminal capital, practical-ruin probability, severe-drawdown probability, p90 maximum drawdown, and analytical expected log growth.

The sweep uses at most 250 paths per fraction and the heatmap uses at most 100 paths per cell so controls remain responsive; both views disclose their exact path counts and are qualitative sensitivity previews. The analytical Kelly marker is authoritative; visual peaks can differ because finite samples, a finite horizon, practical-ruin stopping, and grid resolution affect plotted Monte Carlo summaries. The main simulation and every staked Kelly variant retain the user-selected path count; the exact no-stake baseline uses zero simulated paths. The total-operation budget constrains unsafe combinations before any run starts.

## 9. Modeled benchmark

The optional browser benchmark is a same-horizon lognormal geometric-Brownian-motion context with editable annual arithmetic drift `μ` and volatility `σ`:

```text
median terminal = W_0 exp[(μ − σ²/2)T]
expected terminal = W_0 exp(μT)
p05/p95 = W_0 exp[(μ − σ²/2)T ± z_0.95 σ sqrt(T)]
```

where `z_0.95 ≈ 1.64485`. It is explicitly labeled modeled, configurable, and not historical S&P 500 data. No historical-series claim or data license is involved.

The displayed strategy-median-versus-modeled-median percentage is a relative difference between two independently modeled marginal medians. It is context, not paired pathwise outperformance.

## 10. Omissions

The v1 strategy assumes stationary known inputs and IID outcomes. It omits:

- probability and payout estimation error;
- serial dependence, correlated/clustered outcomes, and regime changes;
- market impact, liquidity, slippage, and contract availability;
- taxes and transaction-specific frictions;
- tail-event model breaks;
- an underlying asset process or path-dependent barrier pricing.

These omissions can make realized risk materially worse than the model. Increasing path count reduces simulation sampling noise; it does not make assumptions correct.

## Primary sources and project conventions

- John L. Kelly Jr., “[A New Interpretation of Information Rate](https://doi.org/10.1002/j.1538-7305.1956.tb03809.x),” _Bell System Technical Journal_ 35(4), 1956, pp. 917–926. Foundational expected-log-growth criterion under betting odds.
- William F. Sharpe, “[Mutual Fund Performance](https://doi.org/10.1086/294846),” _The Journal of Business_ 39(S1), 1966. Foundational reward-to-variability performance measure.
- Frank A. Sortino and Lee N. Price, “[Performance Measurement in a Downside Risk Framework](https://doi.org/10.3905/joi.3.3.59),” _Journal of Investing_ 3(3), 1994. Downside-risk performance framing.
- Fischer Black and Myron Scholes, “[The Pricing of Options and Corporate Liabilities](https://doi.org/10.1086/260062),” _Journal of Political Economy_ 81(3), 1973. Historical source for the lognormal diffusion context; Event Edge Lab does not implement its option-pricing formula.

The exact weekly pooling, full-sample downside-deviation denominator, R-7 quantiles, practical-ruin stop, retained-path limits, and common-random-number grids are project conventions documented above and encoded in tests.
