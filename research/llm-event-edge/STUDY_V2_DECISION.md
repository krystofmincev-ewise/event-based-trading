# V2 decision memo

## Outcome

Do not spend more model calls on the current earnings-direction or 10-session-magnitude specification. Keep the latter as a hypothesis for a later, larger distribution-forecast study.

The V1 magnitude row initially looked promising: 241 cases, Brier 0.2308, and AUC 0.6864 for a terminal absolute move of at least 5% over ten sessions. The stricter audit changes its interpretation:

- 195/241 cases occurred from July 20–31, and the full cohort spans only 23 event dates.
- RV20 alone has AUC 0.6791, nearly the same ranking as the LLM.
- A purged return-window cross-fit calibrates RV20 only on observations whose entry-to-settlement intervals do not overlap the target. It scores Brier 0.2490 and AUC 0.6133 versus the LLM's 0.2308 and 0.6864, a descriptive LLM Brier improvement of 0.0181. This keeps the hypothesis worth a prospective test, but overlapping returns, retrospective selection, and the short date span do not support valid p-values or confidence intervals here.

The cross-fitted model is retrospective and not a deployable baseline, but it is enough to show that V1 has not isolated semantic LLM value from volatility. See [`data/VOLATILITY_BASELINE_AUDIT.md`](data/VOLATILITY_BASELINE_AUDIT.md).

## What remains worth exploring

1. **Post-release clinical/scientific interpretation** is the strongest new research arm. GPT-5.6 Sol's published life-science evaluations make this a plausible document-understanding task, and 14 verified SEC seeds plus an exploratory 733-accession phrase-search replay show data feasibility. This is not evidence of market edge; the prospective question is whether the model improves 1/5/10-session distribution forecasts from the first valid quote after forecast completion plus a 60-second buffer, never from the initial gap.
2. **Pre-announced clinical readouts** are worth testing separately. They require a forecast of both endpoint success and whether the readout occurs before option expiry. Unscheduled releases without a frozen pre-event timestamp are ineligible.
3. **Earnings return-distribution forecasting** remains a secondary pooled hypothesis. Forecast a monotone CDF rather than choosing a winning `±2/5/10%` threshold after outcomes. Require incremental improvement over a walk-forward Student-t/earnings-jump baseline and the pre-event option surface.
4. **20/40-session fundamental rebound** best matches the user's WIX/IREN/SNAP-style examples, but the selected anecdotes cannot estimate edge. Use shares first, freeze the eligible oversold universe and decision timestamp, and add options only after the share benchmark works.

## Expected returns and sizing

No defensible expected-return estimate exists yet for any OTM implementation because V1 has no historical option NBBO. The correct current recommendation is **0% live allocation** and zero contracts.

After a prospective study passes:

- require a multiplicity-adjusted one-sided 97.5% lower bound above zero against the strongest non-LLM baseline;
- require positive ask-to-bid paper P&L in both chronological halves and under spread stress;
- size vanilla options from the posterior payoff distribution, not a hit-rate Kelly shortcut;
- use at most quarter Kelly, then apply the existing 0.5% event, 1% sector, and 2% aggregate caps and floor to whole contracts.

Fifty events per sector is now a feasibility checkpoint only. With V1's score-difference variance, a two-point Brier improvement requires roughly 363 independent observations before date/issuer design effects; a one-point improvement needs roughly 1,452. The first formal pooled test should normally contain at least 400–600 events and 50 independent event dates, with its final size determined from the locked baseline's observed variance and design effect.
