# Strategy recommendations

## Bottom line

The most defensible first use of an LLM is not a blanket sector bet. It is a
small set of separately scored workflows in which document synthesis is the
bottleneck and the forecast, quote, and outcome can be frozen before the event.
The current live recommendation is **0%** while those workflows are shadow
tested.

OpenAI's [GPT-5.6 evaluation
tables](https://openai.com/index/gpt-5-6/) report strong professional and
finance-research results for Sol, including 53% on Big Finance Bench. That is
evidence of research ability,
not a 53% stock-direction hit rate. The same release reports 59.9% on
LifeSciBench, 48.3% on its internal MedChemBench, and a large relative gain on
GeneBench Pro. Those results support testing scientific-document workflows, but
they do not show that pharmaceutical securities are less efficiently priced.
OpenAI publishes no earnings-event Brier score, trading return, or Sharpe ratio
for the model. The model documentation also gives a February 16, 2026 knowledge
cutoff, so this pilot uses later events, but the retrospective result still
remains development evidence.

General forecasting research gives the right prior: retrieval-and-aggregation
systems can approach competitive forecasting crowds, while ForecastBench found
expert forecasters still beat the best tested LLM. The useful unit is therefore
a timestamped, scored agent workflow—not the model name by itself.

## What the two-month pilot found

The sealed graph produced 356 sector-case forecasts for 326 unique U.S.-listed
earnings events from June 15 through August 14, 2026. The result does **not**
support trading next-close direction:

- Pooled next-close accuracy was 49.1% (95% Wilson interval 43.7%–54.5%).
- The model called “up” on 69.3% of cases, while only 48.5% went up.
- Pooled Brier score was 0.251, which is 0.001 worse than a fixed 50% forecast;
  the bootstrap interval for the difference was -0.006 to +0.003.
- Information technology scored 43.3% directional accuracy and health care
  43.9%. Pharma/biotech was also below the 50% benchmark on Brier score. Strong
  software or life-science benchmark performance did not transfer to this
  sparse pre-earnings stock-direction task.

The one exploratory positive result was **terminal move magnitude**, not
direction. For a 5% absolute move over ten sessions, the pooled Brier score was
0.231 across 241 mature cases. Improvement was 0.019 versus a fixed 50%
forecast (95% bootstrap interval 0.002–0.036) and 0.044 versus the no-lookahead
settled-history base rate (0.008–0.082). Energy was the strongest small subgroup
at 22 cases, but that is far too small for a sector claim.

This magnitude result may simply reflect the realized-volatility fields already
present in the packet. It must beat a locked volatility-only model and the
option market's implied distribution prospectively before it is called LLM
edge. There are no historical executable option quotes in the pilot, so it does
not imply a profitable straddle, strangle, barrier, or binary trade.

The packet intentionally contained compact point-in-time fundamentals and
market features rather than the complete filing, transcript, news, consensus
revision history, and valuation work of a true deep-research agent. The negative
direction result rejects this sparse workflow; it does not settle whether the
user's richer AMPL/WIX-style process can work.

## What to test first

| Priority | Workflow                                    | Best initial universe                                                               | Fixed horizon                                    | Instrument benchmark                                                     | Why it is plausible                                                                                                                             | Main failure mode                                                                                                                   |
| -------: | ------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|        1 | Earnings move-magnitude forecast            | Pooled liquid U.S. mid/large caps; energy only as a secondary subgroup              | Terminal 5% move over 10 sessions                | Shares diagnostic; captured straddle/strangle and implied-move benchmark | The only positive pooled pilot signal was magnitude rather than direction                                                                       | May be a simple realized-volatility signal already fully priced by options; terminal move is not barrier touch                      |
|        2 | Specialized-disclosure interpretation       | Mid-cap health care, biotech, and cross-sector conference or regulatory disclosures | Release to next close and 10 sessions            | Shares; exact event contract only when the resolution rule matches       | Dense technical evidence rewards retrieval and synthesis; published LLM evidence finds relatively stronger drift after specialized conferences  | Binary clinical outcomes can gap violently, transparent releases may be incorporated immediately, and options can be very expensive |
|        3 | Growth-quality continuation before earnings | Mid-cap software, internet, and semiconductors                                      | Last close to next close; separately 10 sessions | Shares diagnostic; narrow debit vertical with a captured combo ask       | Recurring revenue, margins, guidance, cash conversion, and prior trend form a structured reasoning task resembling the user’s AMPL/WIX examples | “Good numbers” can still disappoint relative to expectations; point-in-time consensus and implied move are essential                |
|        4 | Oversold fundamental rebound                | Liquid mid-cap software/internet and selected cyclicals                             | Predeclared 20 or 40 sessions                    | Shares first; defined-risk call spread second                            | A longer horizon gives valuation and continuing fundamentals time to matter and matches the WIX/IREN-style thesis                               | Market beta, short interest, macro news, and post-selection of fallen stocks can dominate                                           |
|        5 | Standardized KPI and filing analysis        | Financials and mature software                                                      | Next close and 10 sessions                       | Shares/debit vertical                                                    | Filings expose comparable KPIs and balance-sheet evidence                                                                                       | Rate, credit, and regulatory shocks can dominate company analysis                                                                   |

These rankings are hypotheses, not measured sector alpha. The
[published stock-news evidence](https://www.sciencedirect.com/science/article/pii/S0304405X26001066)
is more nuanced than “LLMs predict earnings”: it finds strong alignment
with the immediate reaction but little subsequent drift for earnings and clinical
trial headlines, while more complex insider-transaction and specialized-conference
news showed greater underreaction. It also reports that gross drift returns were
stronger in smaller stocks and after negative news. Its headline next-day
long-short result was 34 basis points per day before costs with a 2.97 annualized
Sharpe for GPT-4, but the authors limit practical exploitability to sufficiently
low-cost traders and report the Sharpe falling to 1.22 in January–May 2024. Those
historical figures are context, not a return prior for GPT-5.6, this event cohort,
or retail options. They point to a liquid mid-cap compromise rather than the
smallest companies.

## Keep the horizons separate

The user examples imply at least three different decisions. They must never be
combined into one hit rate after outcomes are visible.

1. **Last-hour catalyst** — AMPL-like, with the complete forecast and executable
   quote locked roughly one hour before the announcement. The target is the
   first post-release regular-session close.
2. **Multi-day pre-event catalyst** — WIX/IREN-like, with a one-to-five-session
   decision window and separately declared 1- and 10-session outcomes.
3. **Fundamental rebound** — SNAP/WIX/Ubisoft-like valuation or oversold thesis,
   with a fixed 20- or 40-session horizon and a shares benchmark. This is not an
   earnings binary.

A name can enter more than one arm only through distinct, timestamped forecasts.
The horizon may not be chosen after observing when the stock moved.

## Forecast the right target

For pre-earnings work, the model should produce distinct probabilities rather
than one vague “great numbers” label:

- revenue, EPS, margin, and guidance above the **point-in-time** consensus;
- positive versus negative first-session return;
- terminal absolute move above 2% and 5%;
- positive 10-, 20-, and 40-session return;
- abstention and an evidence-quality grade.

Predicting reported growth is easier than predicting the stock response. The
latter requires the expectations already embedded in the quote, positioning,
valuation, implied volatility, and a timestamped executable cost. A prospective
packet should therefore add point-in-time consensus revisions, the complete
pre-cutoff filing/transcript/news corpus, borrow/short-interest context, and an
option-chain snapshot when derivatives are considered.

## Instrument choice

- Use **shares as the research benchmark** for direction and medium-horizon
  rebound hypotheses. They make the forecast-return relationship observable
  without inventing an option payoff.
- Use a **narrow bull-call or bear-put debit spread** only when the exact strikes,
  expiry, multiplier, combo ask, depth, fees, and timestamp are stored. A vertical
  is a defined-risk approximation, not a binary contract.
- Use an **exact KPI prediction contract** only when its resolution language
  matches the forecast. An EPS contract is not a stock-direction contract.
- Do not translate a terminal 5% move probability into a **barrier-touch**
  probability. Barrier payoffs are path-dependent and require an exact contract
  and quote.

Standard U.S. equity options generally cover 100 shares and have variable
payoffs. The currently verified Cboe single-expiry binary product is based on the
Mini-SPX index, not general post-earnings direction for individual stocks.

## Expected return and sizing

No honest expected return can be stated without both a calibrated probability
and an executable cost. For a fixed-payout contract with payout `S`, all-in cost
`c`, and calibrated win probability `p`:

```text
expected profit per contract = p*S - c
break-even probability       = c / S
full Kelly                   = max(0, (p*S - c) / (S - c))
```

Illustration only: if `S = $100`, `c = $52`, and a prospectively calibrated
`p = 58%`, expected profit is `$6` per contract, or `11.5%` of the `$52` at risk.
Full Kelly is `12.5%`. Quarter Kelly would be `3.125%`, but the research policy’s
0.50% event cap binds. At a `$100,000` bankroll, the `$500` risk budget funds nine
whole `$52` contracts (`$468` at risk). At `$10,000`, the `$50` budget funds zero.

The same 58% probability is negative value at a `$60` all-in cost. Conversely, a
probability below 50% can be valuable when the contract costs sufficiently less
than half its payout. Buying the opposite side requires its separately observed
ask, fees, and resolution terms.

After prospective activation, size from the 5th percentile of the joint
probability-and-cost posterior, use quarter Kelly, and cap risk at 0.50% per
event, 1% in one sector, 2% across open event positions, and 1% newly opened on
one date. Until the activation gates pass, the answer is zero contracts.

## Minimum experiment that can change the decision

1. Freeze one primary arm, model snapshot, prompt, calibration method, universe,
   quote time, and outcome rule.
2. Shadow every eligible event, including abstentions and missing quotes.
3. At 240 pooled events, audit feasibility only; at 360, run the first pooled
   go/no-go; wait for roughly 50 events in a sector before a sector claim.
4. Compare Brier and log loss with a settled-history base rate and, where a real
   two-sided market exists, the de-vigged market probability.
5. Require at least 90% forecast and quote coverage, a positive one-sided 95%
   lower bound for Brier improvement, and at least 100 prospective paper trades
   with positive cost-adjusted results in both chronological halves.
6. Any prompt, model, target, sector, threshold, or execution-rule change starts
   a new prospective cohort.

See [POSITION_SIZING_POLICY.md](POSITION_SIZING_POLICY.md) for the formal gates
and [SOURCES.md](SOURCES.md) for primary sources.
