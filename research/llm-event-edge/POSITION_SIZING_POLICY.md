# Position-sizing policy

## Current decision

**Live allocation: 0%.** The current pilot is retrospective, non-executable, and too small for sector authorization.

## Instrument policy

| Signal                         | Research benchmark                             | Plausible defined-risk implementation                                          | Requirement before sizing                                                                        |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| One-session company direction  | Shares, close-to-close diagnostic              | Narrow bull-call or bear-put debit spread expiring after the reaction session  | Timestamped combo ask, maximum loss, depth, multiplier, exercise/settlement terms, and all fees  |
| Ten-session direction          | Shares with chronological open-position ledger | Debit vertical around a predeclared threshold                                  | Full volatility surface and quote history; no immediate settlement of overlapping positions      |
| Exact company KPI/call phrase  | No share proxy                                 | Exact prediction-market contract when its resolution rule matches the forecast | Both sides, fee schedule, resolution source, and venue eligibility                               |
| Absolute move or barrier touch | Terminal absolute-return forecast              | Long straddle/strangle or exact listed/dealer barrier only after quote capture | Full move distribution and path-dependent pricing; terminal probability is not touch probability |

There is no verified broadly listed U.S. single-stock post-earnings price-direction binary in this study. Cboe's currently described binary is Mini-SPX; Kalshi company contracts resolve exact questions rather than stock direction. Standard listed equity options are the present executable approximation.

## Prospective gates

- First 20 events per sector / 240 pooled: shadow feasibility only.
- First formal pooled test: normally at least 400–600 events and 50 independent event dates for a large effect; set the final size from the locked baseline's variance and date/issuer design effect.
- Fifty events per sector is a calibration and pipeline checkpoint, not an activation gate. Sector authorization normally requires hundreds and a power calculation for the minimum economically useful score/P&L improvement.
- At least 90% forecast coverage and 90% quote coverage.
- Multiplicity-adjusted one-sided 97.5% date-block-bootstrap lower bound for Brier/CRPS improvement above zero against the strongest locked non-LLM baseline.
- Log-loss non-inferiority and acceptable pooled calibration intercept/slope.
- Positive ask-to-bid paper P&L in both chronological halves and under spread stress, with no date, issuer, or sector contributing over half of P&L.
- Sector claims require multiplicity control and hierarchical shrinkage.

For scale, V1's paired score-difference variance implies roughly 363 independent observations to detect a two-point Brier improvement and 1,452 for a one-point improvement at 80% power and one-sided 2.5%, before clustering and multiplicity. Re-estimate these requirements from the frozen prospective design; do not treat them as universal constants.

## Conservative Kelly

For payout `S`, all-in acquisition cost `c`, and posterior calibrated win probability `p`:

```text
breakEven = c / S
fullKelly = max(0, (p*S - c) / (S - c))
```

Use joint posterior draws for probability and cost. Let `robustKelly` be the 5th percentile of those Kelly draws. A trade is eligible only when the 5th percentile of `p - c/S` exceeds 3 percentage points and the 5th percentile of expected log growth is positive.

```text
recommendedFraction = min(0.25 * robustKelly, 0.005, remainingCapacity)
wholeContracts = floor(bankroll * recommendedFraction / conservativeContractCost)
```

Initial hard caps after prospective activation:

- 0.50% bankroll at risk per event;
- 1.00% open risk in one sector;
- 2.00% aggregate event risk;
- 1.00% new risk opened on one date;
- zero contracts when flooring cannot fund one complete contract.

Kelly uses the contract's break-even probability, not a claim that every binary event must have at least a 50% hit rate. A rare event can be attractive below 50% when price is sufficiently low; the opposite side may have a different ask and fee burden.

For vanilla calls, puts, and spreads, do not insert a hit rate into the fixed-payout formula. Optimize expected log growth over posterior draws of the full net-payoff distribution, including entry ask, exit bid, fees, slippage, and common event/date shocks; then apply the same quarter-Kelly and hard caps.
