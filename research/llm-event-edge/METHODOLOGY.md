# Methodology

## Cohort construction

The development cohort starts from the Nasdaq earnings calendar, joins current Nasdaq issuer metadata, and requires a same-date SEC 8-K containing Item 2.02 with an acceptance time before the open or after the close. It includes foreign-domiciled U.S. listings when both Nasdaq and SEC identifiers resolve.

This is not a point-in-time investable universe. Current market capitalization and sector labels were reconstructed after the events; that creates survivorship and size-threshold selection bias. Capitalization is therefore omitted from model packets and retained only for descriptive audit fields. A confirmatory study must freeze membership and capitalization before the first forecast.

Within each capitalization bucket, version one deterministically selects the earliest eligible `eventDate:ticker` rows after a current-cap top-90 preselection. This makes reruns stable but overweights the earlier part of the window and gives older cases more outcome maturity. It is a development cohort, not a representative random sample; a confirmatory cohort must include every prospectively eligible event or use a precommitted sampling hash.

## Information cutoff

The packet cutoff is the last completed regular-session close at the return anchor, not the later release acceptance time.

- Company Facts observations with only a filing date are admitted only when `filed date < cutoff date`. Same-day observations are excluded because an acceptance time cannot be established.
- Filing metadata requires `acceptedAt < informationCutoff`.
- Actual EPS, surprise, outcomes, post-cutoff filings, and post-retrieved consensus fields are omitted.
- Market features use data no later than the completed anchor close.

Because the completed close is observable only after the bar finishes, the study treats it as a forecast boundary and does not pretend the strategy filled at that exact price. This is a probability-forecasting diagnostic, not an executable P&L backtest.

## Outcomes

- `up-1d`: raw terminal return above zero at the next regular-session close.
- `up-10d` and `up-40d`: raw terminal return above zero at the 10th or 40th subsequent regular-session close.
- Absolute thresholds use terminal absolute return, not an intraday touch or barrier event.
- SPY-adjusted returns are retained for audit but the primary binary target is raw return because listed contract settlement would follow its stated underlying rule.

`outcomeObservationDate` is separate from the event-window end. Outcome refreshes update only settlements and their versioned response hashes; forecast packets remain frozen.

## Forecast generation

Two independent sector analysts receive identical outcome-blinded packets. One emphasizes fundamental continuation and quality; the other emphasizes expectations, mean reversion, and already-priced narratives. A synthesis node reconciles them conservatively.

Runtime validation enforces:

- exactly one response per expected sector-case;
- probabilities in `[0.02, 0.98]`;
- `P(|R1d| >= 5%) <= P(|R1d| >= 2%)`;
- bounded expected returns and enumerated confidence;
- packet, schema, prompt, CLI, node, and output hashes before scoring.

## Scoring

Brier score is primary and log loss is secondary. The baseline is prequential: it starts from a Jeffreys-smoothed 50% prior and admits a previous label only after that target had settled before the later case's decision cutoff. That avoids using a ten-day outcome to forecast an event that occurred before those ten days elapsed.

The report includes pooled and sector-view results. Pooled results deduplicate the overlapping pharma/biotech view; health care is the canonical pooled forecast for overlapping cases. Simple bootstrap and Wilson intervals are descriptive only. They do not correct date clustering, repeated issuers, overlapping horizons, or multiple comparisons.

## Evidence status

Retrospective forecasts from a current model are pipeline-development evidence, even when events follow the documented model knowledge cutoff. Reconstructed data, selected anecdotes, prompt iteration, and cohort construction can still leak or overfit.

The first capital-authorizing evidence must be an immutable prospective cohort with timestamped inputs, forecasts, candidate quotes, both sides of the market, depth, fees, decisions, abstentions, and outcomes. Missing forecasts count as baseline forecasts; missing quotes remain in coverage statistics.
