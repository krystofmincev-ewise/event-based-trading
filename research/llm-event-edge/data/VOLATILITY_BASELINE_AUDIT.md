# V1 volatility-baseline audit

Generated: 2026-08-15T03:37:19.316Z

## Decision

**No demonstrated LLM-specific edge and no option-return claim.** The previously highlighted 10-session magnitude forecast was selected after inspecting several outcomes, is concentrated on a small number of event dates, and used realized volatility in the model packet. This audit compares it descriptively with deterministic point-in-time volatility rivals.

Feature reconstruction succeeded for 241/241 mature cases. Missing tickers: none.

The public source manifest binds 242 Nasdaq inputs with URL, timestamp provenance, and response hash. 185 timestamps were recorded at fetch completion; 57 older cache timestamps are explicitly labeled as filesystem-mtime reconstructions rather than exact retrieval times. Manifest SHA-256: e8f0c4986c3db7422d6cbc678d43af5a1585ca20f5c8aa3fed83092c51de4adc.

**Inference is intentionally omitted.** Ten-session return windows overlap and the cohort spans only 23 event dates. Event-level or coarse calendar-block p-values and confidence intervals would overstate the effective sample size.

## Ten-session absolute move of at least 5%

| Metric                                             |           Value |
| -------------------------------------------------- | --------------: |
| Events                                             |             241 |
| Distinct event dates                               |              23 |
| Observed frequency                                 |          0.5768 |
| LLM Brier / AUC                                    | 0.2308 / 0.6864 |
| Gaussian RV20 Brier / AUC                          | 0.2500 / 0.6791 |
| Walk-forward RV20 Brier / AUC                      | 0.2698 / 0.5320 |
| Purged return-window cross-fitted RV20 Brier / AUC | 0.2490 / 0.6133 |
| LLM minus Gaussian RV20 improvement                |          0.0192 |
| LLM minus walk-forward RV20 improvement            |          0.0390 |
| LLM minus purged cross-fitted RV20 improvement     |          0.0181 |

The Gaussian rival is intentionally simple and omits the discrete earnings jump. The walk-forward rival learns only from outcomes that had settled before each later decision. The cross-fitted rival excludes every observation whose entry-to-settlement interval overlaps the target interval; because it can train on chronologically later, non-overlapping windows, it remains a retrospective explanatory diagnostic, not an executable forecast. None substitutes for an option-implied distribution.

## Seven-outcome selection audit versus a fixed 50% forecast

Fixed 50% is a useful direction reference but not a proper climatology for every magnitude event. These descriptive rows expose the seven pooled targets inspected before the magnitude hypothesis was highlighted; they do not correct retrospective selection or the larger sector-by-target search.

| Outcome            |   n | event dates | Brier improvement |
| ------------------ | --: | ----------: | ----------------: |
| up-1d              | 326 |          32 |           -0.0013 |
| up-10d             | 241 |          23 |            0.0050 |
| absolute-2pct-1d   | 326 |          32 |            0.0348 |
| absolute-5pct-1d   | 326 |          32 |            0.0217 |
| absolute-5pct-10d  | 241 |          23 |            0.0192 |
| up-40d             |   1 |           1 |            0.0000 |
| absolute-10pct-40d |   1 |           1 |           -0.1856 |

## Interpretation

- A probability-ranking result is not an executable OTM-option return. Vanilla options have variable payoff beyond the strike and require timestamped entry ask, exit bid, contract multiplier, size, open interest, fees, and corporate-action handling.
- With overlapping returns, repeated market dates, and this short cohort, the values above are descriptive falsification diagnostics rather than statistical confirmation.
- The next valid test must forecast a coherent return CDF and beat a locked volatility-only model plus the pre-event option surface on a later, immutable cohort.
