# Clinical-trial event arm

Clinical readouts are a separate event family, not a health-care sector flag on the earnings study. This folder holds discovery seeds and the design needed to build a leakage-safe, rerunnable corpus.

## Two experiments

1. **Pre-release forecasting** predicts endpoint success, safety, readout timing, and price tails from evidence frozen before the first public announcement.
2. **Post-release interpretation** gives the newly released evidence to the model, records `releaseIngestedAt` and `forecastCompletedAt`, then waits a locked 60-second latency buffer. Its entry is the first valid executable quote at or after `forecastCompletedAt + 60 seconds` (and after a halt reopening, if applicable), with fixed 1-, 5-, and 10-session settlements. It never receives credit for the initial gap or any move before the forecast could have been acted on.

Endpoint success and stock-price reaction are different labels. A trial can meet its prespecified endpoint and still disappoint the market; a failed endpoint can coexist with cash value, a viable subgroup, or restructuring news.

## What is here

- [`seed-events.json`](seed-events.json) contains 14 manually verified 2026 SEC filings/exhibits spanning positive, negative, post-hoc, and exploratory readouts.
- The seeds prove corpus feasibility. They are selected discovery examples and **must not** be used to estimate hit rate, return, or model edge.
- A fully paginated exploratory SEC phrase-search replay across February 17–August 14, 2026 produced 733 unique 8-K/6-K accession candidates. That unfrozen replay is feasibility evidence only: it retained neither the accession list nor raw-page hashes, includes false positives and repeated/old readouts, and cannot estimate edge. [`discovery-manifest.json`](discovery-manifest.json) records the exact phrases, pagination, counts, and filter for the exploratory replay.

## Corpus construction

1. Enumerate every 8-K and 6-K in the locked date window from SEC daily or quarterly indexes.
2. Fetch filing indexes and EX-99 exhibits under the [SEC access policy](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data).
3. Search a frozen vocabulary including `topline`, `top-line`, `met primary endpoint`, `did not meet primary endpoint`, `interim analysis`, and `data monitoring committee`.
4. Deduplicate by issuer, trial/program, cohort, and first-public timestamp.
5. Link NCT identifiers and obtain the latest ClinicalTrials.gov history version posted strictly before the forecast cutoff. Never use the current record retrospectively: it may contain post-readout status, enrollment, or results.
6. Have two outcome adjudicators, blinded to forecasts, label the prespecified endpoint criterion, material safety signal, post-hoc-only positives, and timestamp precision.
7. Keep confirmatory efficacy, interim efficacy, early proof-of-concept, safety/PK/PD, extension, subgroup, and regulatory events as separate strata.

The SEC search backend caps pages at 100 even if a larger size is requested. Fetch `from=0,100,200,...` through `hits.total.value`, save every raw page and SHA-256, and freeze the sorted accession list. Search ranking/index state can change: a same-day replay changed the first-page union by one accession, so a live rerun is not a substitute for the frozen artifact.

The documented [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api) supports study retrieval and sponsor queries. Its public record-history UI is authoritative for version selection; internal archive endpoints may be useful for snapshots but are not a documented API contract and must be hashed when used.

## Required forecast targets

- endpoint success and material safety signal;
- probability that the readout occurs before each candidate option expiry;
- a coherent terminal-return CDF at `-10%, -5%, -2%, 0%, +2%, +5%, +10%`;
- post-release 1/5/10-session abnormal-return distribution for the interpretation arm;
- abstention and evidence-quality grade.

For short-dated options, readout timing is part of the payoff. A useful model must combine `P(readout by expiry)`, scientific-outcome probabilities, and conditional price distributions. A point estimate that the trial “works” is insufficient.

## Evidence gate

Use the first 30–50 adjudicated events only to debug the pipeline. Freeze the prompt, model, packet schema, baselines, quote rule, and primary score before a later holdout. The clinical arm needs at least 100 holdout events to detect only very large effects; modest edge will require several hundred and issuer/date clustering. No live sizing is allowed from the seed set.
