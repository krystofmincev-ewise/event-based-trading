import type { SimulationResult } from "@event-lab/simulation";

import { formatCurrency, formatPercent, formatRatio } from "../lib/format.js";

export const MetricStrip = ({ result }: { result: SimulationResult }) => {
  const { metrics } = result;
  const metricsList = [
    {
      label: "Expected terminal",
      value: formatCurrency(metrics.expectedTerminalCapital),
      detail: `${formatPercent(metrics.expectedTotalReturn)} total`,
      tone: "positive",
    },
    {
      label: "Median terminal",
      value: formatCurrency(metrics.terminalCapital.median),
      detail: `${formatPercent(metrics.medianTotalReturn)} total`,
      tone: metrics.medianTotalReturn < 0 ? "danger" : "neutral",
    },
    {
      label: "Practical ruin",
      value: formatPercent(metrics.probabilityOfPracticalRuin),
      detail: `≤ ${formatCurrency(result.metadata.practicalRuinCapital)}`,
      tone: "danger",
    },
    {
      label: "Median max drawdown",
      value: formatPercent(metrics.medianMaxDrawdown),
      detail: `p90 ${formatPercent(metrics.p90MaxDrawdown)}`,
      tone: "warning",
    },
    {
      label: "Weekly Sharpe",
      value: formatRatio(metrics.annualized.sharpe),
      detail: `${formatPercent(metrics.annualized.annualizedVolatility)} ann. vol`,
      tone: "neutral",
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
