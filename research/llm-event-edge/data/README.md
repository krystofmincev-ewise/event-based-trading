# Generated study data

`npm run edge:ingest` writes provider snapshots under `raw/`, a private case ledger under `private/`, and a redistribution-safe case index and aggregate manifest beside this file. Raw Nasdaq and SEC responses are intentionally ignored by Git; their URLs, retrieval timestamps, response hashes, and derived calculations are recorded so a rerun can be audited without republishing provider payloads.

`npm run edge:packets` creates outcome-blinded model packets under `private/packets/`. `npm run edge:forecast` stores locked model outputs under `forecasts/`. Neither folder should be committed because packets can contain substantial third-party source material and forecasts may be expensive to regenerate.

`npm run edge:score` emits aggregate, commit-safe reports, a public case index
with derived terminal outcomes, and a public locked-probability index without
analyst prose. `pilot-results.json` binds both public indexes and the private
locked forecast ledger by SHA-256 and records the model/CLI/isolation metadata.
Do not publish raw market data unless you have independently confirmed
redistribution rights.

`npm run edge:audit-volatility` reconstructs RV20 from ignored Nasdaq response
snapshots and emits the aggregate, redistribution-safe
[`VOLATILITY_BASELINE_AUDIT.md`](VOLATILITY_BASELINE_AUDIT.md) and
`volatility-baseline-audit.json`. The public
[`volatility-baseline-source-manifest.json`](volatility-baseline-source-manifest.json)
binds every successful Nasdaq input by URL, timestamp provenance, and response
SHA-256 while raw provider bodies remain ignored. Exact fetch-completion times
and reconstructed older-cache filesystem mtimes are explicitly distinguished.
Its purged return-window
cross-fit is a retrospective explanatory diagnostic, not a deployable or
capital-authorizing forecast; no inferential p-values or confidence intervals
are reported for this short, overlapping cohort.
