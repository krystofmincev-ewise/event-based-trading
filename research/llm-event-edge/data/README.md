# Generated study data

`npm run edge:ingest` writes provider snapshots under `raw/`, a private case ledger under `private/`, and a redistribution-safe case index and aggregate manifest beside this file. Raw Nasdaq and SEC responses are intentionally ignored by Git; their URLs, retrieval timestamps, response hashes, and derived calculations are recorded so a rerun can be audited without republishing provider payloads.

`npm run edge:packets` creates outcome-blinded model packets under `private/packets/`. `npm run edge:forecast` stores locked model outputs under `forecasts/`. Neither folder should be committed because packets can contain substantial third-party source material and forecasts may be expensive to regenerate.

`npm run edge:score` emits aggregate, commit-safe reports, a public case index
with derived terminal outcomes, and a public locked-probability index without
analyst prose. `pilot-results.json` binds both public indexes and the private
locked forecast ledger by SHA-256 and records the model/CLI/isolation metadata.
Do not publish raw market data unless you have independently confirmed
redistribution rights.
