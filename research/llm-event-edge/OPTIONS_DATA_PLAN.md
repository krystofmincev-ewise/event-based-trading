# Executable options-data plan

## Decision

Use **Databento OPRA** for the next narrow historical pilot, subject to the account owner accepting its terms and cost estimate. It provides consolidated U.S. equity-option NBBO data since 2013, point-in-time instrument definitions, and daily statistics including open interest. Historical usage starts at a published per-GB price; estimate every request before download. Databento does not supply precomputed IV or Greeks, so those must be calculated transparently.

[Cboe DataShop Option Quote Intervals](https://datashop.cboe.com/option-quote-intervals) is the authoritative cross-check and offers NBBO, size, volume, optional IV/Greeks, and optional open interest. OptionMetrics is the institutional end-of-day benchmark; ORATS and Alpha Vantage are lower-cost end-of-day alternatives. Aggregated OHLC without historical bid/ask is insufficient for executable P&L.

## Locked contract grid

Do not search all strikes and report the winner. Pre-register:

- long call and long put;
- approximately 25-delta and 10-delta contracts;
- fixed terminal thresholds of ±5% and ±10% for distribution scoring;
- first expiry after a next-session event with at least one complete trading day;
- first expiry at least 12 sessions after a 10-session target;
- expiry at least five sessions beyond a 20/40-session rebound target.

For the scheduled pre-event arm, packet data is cut off at 15:30 ET, the forecast must be complete and immutable by 15:44 ET, and entry is the first valid quote at or after 15:45 ET on the pre-event session. The existing V1 packet's 16:00 completed-close features are ineligible for this intraday execution study. Intraday and unscheduled clinical news is excluded from the pre-event arm unless the forecast and exact pre-release quote were already frozen.

For post-release interpretation, record the verified announcement timestamp, `releaseIngestedAt`, and `forecastCompletedAt`. Apply a locked 60-second operational buffer and enter only at the first valid executable quote at or after `forecastCompletedAt + 60 seconds` and after any halt reopening. Never credit the initial gap or any move before forecast completion and the buffer.

Require nonzero bid and ask, displayed ask size sufficient for at least one whole contract, a locked maximum relative spread, and positive open interest or recent trading. Exclude adjusted/nonstandard deliverables in the first study. OCC states that a standard equity-option contract generally represents 100 shares, while corporate actions can change deliverables.

## P&L

For a long call held to expiry:

```text
P&L = 100 * max(ST - K, 0) - 100 * entryAsk - fees
```

For a pre-expiry exit:

```text
P&L = 100 * (exitBid - entryAsk) - fees
```

Use the entry ask and exit bid, never midpoint or last trade. Add a stress case that worsens both sides by 25% of the quoted spread. Missing or illiquid quotes remain coverage failures; they are not dropped from the eligible universe.

A vanilla OTM option cannot be valued from hit rate alone because payoff above/below the strike is variable. The forecast must be a coherent terminal-return distribution. For an actual fixed-payout binary priced at `c` per `$1` payout, expected profit is `p - c` and the unconstrained premium-fraction Kelly value is `(p - c) / (1 - c)`. That formula does not apply to vanilla calls and puts.

## Anti-bias controls

- point-in-time contract definitions, underlying quotes, and corporate actions;
- exact forecast, event, quote, and settlement timestamps;
- ask-to-bid execution with size, fees, and spread stress;
- every eligible event retained, including abstentions and unavailable options;
- locked strike/expiry/entry/exit/liquidity policy;
- comparison with the option-implied distribution, a deterministic realized-volatility model, the same contract selector without the LLM, and no trade;
- date-block and issuer clustering plus multiplicity correction across event arm, horizon, direction, strike, and expiry.

Until net executable P&L has a positive multiplicity-adjusted lower confidence bound on a prospective cohort, recommended live option allocation is **0%**.
