# GPT-5.6 Sol event-edge pilot results

Generated: 2026-08-15T00:45:20.366Z

## Status

**Pipeline-development evidence only. Recommended live position: 0%.** These forecasts were generated retrospectively by a current model from reconstructed point-in-time packets. They are useful for finding failure modes and choosing prospective hypotheses, but they cannot authorize capital.

The primary table scores next-close direction against two no-skill references. The fixed 50% forecast is the transparent direction benchmark. The no-lookahead prequential base rate starts from a Jeffreys-smoothed 50% prior and updates only from outcomes that had settled before each later decision cutoff; it can be volatile in small, temporally clustered sectors, so it must not be read alone. The close anchor is not treated as an executable fill, so this report deliberately computes no trading return.

| Sector                 |   n | Actual up | Model up call | Brier | Improvement vs 50% | Improvement vs settled-history base rate | Accuracy | Naive 95% interval |
| ---------------------- | --: | --------: | ------------: | ----: | -----------------: | ---------------------------------------: | -------: | -----------------: |
| pooled                 | 326 |     48.5% |         69.3% | 0.251 |             -0.001 |                                    0.008 |    49.1% |        43.7%–54.5% |
| communication-services |  26 |     46.2% |         73.1% | 0.252 |             -0.002 |                                    0.026 |    50.0% |        32.1%–67.9% |
| consumer-discretionary |  30 |     33.3% |         70.0% | 0.257 |             -0.007 |                                   -0.003 |    43.3% |        27.4%–60.8% |
| consumer-staples       |  30 |     46.7% |         66.7% | 0.252 |             -0.002 |                                    0.011 |    46.7% |        30.2%–63.9% |
| energy                 |  30 |     46.7% |         60.0% | 0.252 |             -0.002 |                                    0.056 |    40.0% |        24.6%–57.7% |
| financials             |  30 |     46.7% |         93.3% | 0.246 |              0.004 |                                    0.095 |    53.3% |        36.1%–69.8% |
| health-care            |  41 |     58.5% |         65.9% | 0.265 |             -0.015 |                                   -0.013 |    43.9% |        29.9%–59.0% |
| industrials            |  30 |     73.3% |         73.3% | 0.239 |              0.011 |                                   -0.004 |    60.0% |        42.3%–75.4% |
| information-technology |  30 |     40.0% |         76.7% | 0.255 |             -0.005 |                                    0.008 |    43.3% |        27.4%–60.8% |
| materials              |  19 |     42.1% |         42.1% | 0.249 |              0.001 |                                    0.021 |    57.9% |        36.3%–76.9% |
| real-estate            |  30 |     40.0% |         60.0% | 0.251 |             -0.001 |                                    0.029 |    46.7% |        30.2%–63.9% |
| utilities              |  30 |     53.3% |         73.3% | 0.242 |              0.008 |                                    0.048 |    60.0% |        42.3%–75.4% |
| pharma-biotech         |  30 |     60.0% |         63.3% | 0.258 |             -0.008 |                                    0.009 |    43.3% |        27.4%–60.8% |

## Interpretation guardrails

- The pharma-biotech row overlaps health care.
- Sector counts of 20–41 are exploratory and carry very wide uncertainty.
- There are no historical executable option quotes, spreads, depth, or implied-volatility surfaces in this study. It cannot estimate option-strategy returns.
- Daily features include the completed anchor close. That supports a close-to-close forecast diagnostic, not a claim that the strategy could fill at the observed close.
- Ten-day returns overlap and 40-day outcomes are mostly not mature. Use the JSON report for availability by horizon.
- No sector receives a live Kelly allocation from this sample. Fifty events per sector is feasibility only. The first formal pooled test should normally include at least 400–600 events and 50 independent event dates, with final size determined from the locked baseline's variance and date/issuer design effect.
