import type { SimulationResult } from "@event-lab/simulation";

import { formatCurrency, formatPercent, formatRatio } from "../lib/format.js";

export const MetricStrip = ({ result }: { result: SimulationResult }) => {
  const { metrics } = result;
  const returnTone = (value: number) =>
    value > 0 ? "positive" : value < 0 ? "danger" : "neutral";
  const ruinTone =
    metrics.probabilityOfPracticalRuin === 0
      ? "neutral"
      : metrics.probabilityOfPracticalRuin >= 0.05
        ? "danger"
        : "warning";
  const drawdownTone =
    metrics.medianMaxDrawdown >= result.input.severeDrawdownFraction
      ? "danger"
      : metrics.medianMaxDrawdown >= 0.2
        ? "warning"
        : "neutral";
  const sharpeTone =
    metrics.annualized.sharpe === null
      ? "neutral"
      : returnTone(metrics.annualized.sharpe);
  const metricsList = [
    {
      label: "Expected terminal",
      value: formatCurrency(metrics.expectedTerminalCapital),
      detail: `${formatPercent(metrics.expectedTotalReturn)} total`,
      tone: returnTone(metrics.expectedTotalReturn),
    },
    {
      label: "Median terminal",
      value: formatCurrency(metrics.terminalCapital.median),
      detail: `${formatPercent(metrics.medianTotalReturn)} total`,
      tone: returnTone(metrics.medianTotalReturn),
    },
    {
      label: "Practical ruin",
      value: formatPercent(metrics.probabilityOfPracticalRuin),
      detail: `≤ ${formatCurrency(result.metadata.practicalRuinCapital)}`,
      tone: ruinTone,
    },
    {
      label: "Median max drawdown",
      value: formatPercent(metrics.medianMaxDrawdown),
      detail: `p90 ${formatPercent(metrics.p90MaxDrawdown)}`,
      tone: drawdownTone,
    },
    {
      label: "Annualized Sharpe",
      value: formatRatio(metrics.annualized.sharpe),
      detail: "Pooled weekly observations",
      tone: sharpeTone,
    },
  ];

  return (
    <section className="metric-strip" aria-label="Decision metrics">
      {metricsList.map((metric) => (
        <div className={`metric metric-${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </div>
      ))}
    </section>
  );
};
