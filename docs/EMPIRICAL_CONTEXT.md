# Empirical context catalog

The scenario composer ships required defaults without pretending that public market context is a validated event-trading edge. Every number is assigned to one of three evidence tiers.

## Evidence tiers

1. **Unconditional context** — long-run public portfolio returns. These describe how diversified industry and size portfolios moved, not how an individual company reacts to earnings or how accurately an LLM predicts an outcome.
2. **Event literature** — published sample sizes and stress magnitudes. These inform warnings and stress tests but do not become event probabilities unless the cited paper reports the same outcome, threshold, horizon, universe, and timing rule.
3. **Product terms** — versioned payout and exchange-fee examples from an exact listed product. A product reference does not establish that an equivalent single-stock contract exists or that its bid/ask is executable.

Only a fourth, future tier—an imported point-in-time event/price/quote ledger with matching outcome definitions—should drive an event-conditioned sizing default.

## Public return catalog

The committed summaries were generated from Kenneth R. French's public value-weighted daily portfolio files:

- [12 Industry Portfolios](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/12_Industry_Portfolios_daily_CSV.zip)
- [49 Industry Portfolios](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/49_Industry_Portfolios_daily_CSV.zip)
- [Portfolios Formed on Market Equity](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Portfolios_Formed_on_ME_daily_CSV.zip)
- [Data Library documentation](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html)

The app bundles calculated summaries, not the source archives. `scripts/build-empirical-context.mjs` records the retrieval date, the 202606 CRSP database vintage reported by the files, and SHA-256 hashes for all three inputs. The source files remain subject to their provider's terms; public download availability is not a project redistribution license.

Definitions:

```text
sample                 = 2000-01-03 through 2025-12-31
one-day return         = published daily portfolio return
ten-day return         = product(1 + daily return) - 1 over 10 trading days
P(up)                  = count(return > 0) / N
P(down)                = count(return < 0) / N
P(up at least x)       = count(return >= x) / N
P(down at least x)     = count(return <= -x) / N
P(absolute at least x) = count(abs(return) >= x) / N
```

There are 6,539 one-day observations and 6,530 overlapping ten-day observations per published cell. Overlapping ten-day returns are not independent; the displayed count must not be read as an effective calibration sample size.

The 11 familiar sector labels are approximate mappings from SIC-based Fama–French portfolios, not licensed point-in-time GICS classifications. Pharma/biotech uses the separate FF49 `Drugs` portfolio. Each mapping is marked `closest-sic-proxy`, `partial-sic-proxy`, or `industry-overlay` in the data.

## Capitalization composition

The size-volatility adjustment uses the ratio of Fama–French NYSE-relative `Lo 30`, `Med 40`, or `Hi 30` return volatility to `Hi 30` volatility for the selected horizon. These are labelled bottom-30%, middle-40%, and top-30% NYSE size-volatility proxies—not S&P dollar-cap classifications. The ratio rescales the threshold evaluated against the selected industry distribution under an explicit scale-family assumption:

```text
effective move scale = size volatility / large-size volatility
                       × company move multiplier

effective threshold = selected threshold / effective move scale
```

Every exact knot uses the Jeffreys-smoothed frequency `(count + 0.5) / (N + 1)` and also exposes the raw observed rate. This prevents a zero count from being silently treated as a literal zero probability. Values between 0%, 2%, 5%, and 10% knots are interpolated in log-probability space using the smoothed knots. Effective thresholds above 10% are rejected rather than extrapolated. These are explicit approximations, not observed joint sector-by-size cells.

The visible dollar labels use the separately sourced [S&P U.S. index eligibility guidelines](https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf): small $1.2B–$8.0B, mid $8.0B–$22.7B, and large at least $22.7B. Those dollar bands are not the Fama–French NYSE-relative portfolio breakpoints.

## Synthetic research terms

For a selected outcome definition with Jeffreys-smoothed unconditional context frequency `p0`, the composer constructs transparent, non-executable research terms:

```text
settlement payout                  = $100
probability-scaled hypothetical price = $100 × p0
scenario probability              = p0 + user/model lift
reference fee                     = one illustrative XSPBX Customer-side fee
fill-cost stress                  = $0.50 user-policy allowance
modeled break-even                = (hypothetical price + modeled costs) / $100
```

The $100 payout and fee bands are grounded in [Cboe's current XSP binary product](https://www.cboe.com/markets/prediction-markets/) and [June 15, 2026 fee filing](https://cdn.cboe.com/resources/regulation/rule_filings/approved/2026/SR-CBOE-2026-056.pdf). The cited fee is per contract side for Customer-capacity XSPBX orders. It excludes broker and other account-specific charges and is not a live fee lookup. XSP is an index product; the proxy does not imply that a corresponding single-company earnings contract is listed. The $0.50 allowance is a stress policy because no universal sector/cap spread is defensible.

An executable decision must replace the proxy with an exact venue, symbol, settlement rule, timestamped ask or book walk, payout, fee schedule, quote age, and depth.

## Event literature

The app links event research without converting unmatched results into probabilities:

- A recent earnings study contains 259,664 firm-quarter observations and demonstrates why pre-market, after-hours, and intraday timestamps require different return alignment. It does not publish the complete sector/cap/threshold grid needed here. [Review of Accounting Studies](https://link.springer.com/article/10.1007/s11142-026-09959-y)
- A biopharma study covers 503,107 releases from 1,012 companies. Event-day abnormal returns for selected categories reached approximately +6% and −13%; those are selected category estimates—not raw returns, typical effects, probabilities, or 10-day outcomes. The study used licensed RavenPack and CRSP inputs. [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0296927)
- A clinical-trial study covers 13,807 trials across 379 U.S. public companies and finds larger reactions for early biotech than large pharma, with substantial unexplained variation. [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272851)

## LLM forecast boundary

An empirical event base rate and a model hit rate are different objects:

```text
event base rate = P(outcome | sector, cap, event type, threshold, horizon)

forecast calibration = P(outcome | model version, issued probability,
                           sector, cap, event type, threshold, horizon)
```

The default model lift is therefore zero. A non-zero lift should require stored, timestamped, out-of-sample forecasts from a named model, plus Brier score, log loss, calibration buckets, coverage period, sample size, and the exact outcome fingerprint. LLM prose confidence is not a probability estimate.

## API

- `GET /api/scenarios` returns the versioned catalog, default selection, and event-literature metadata.
- `POST /api/scenario/resolve` validates a selection and returns smoothed/raw context frequencies, synthetic terms, machine-readable non-executable provenance, warnings, and a research simulation patch.
- A loaded simulation carries the catalog version and exact scenario selection in `researchScenarioManifest`. The simulation API verifies that every scenario-derived number still matches that manifest; edited terms clear it in the UI.
- `POST /api/size` remains the final deterministic whole-contract sizing boundary after an agent replaces proxy terms with a real quote.
