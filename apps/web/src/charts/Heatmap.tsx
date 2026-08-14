import type { ExplorationResult } from "@event-lab/simulation";

import { formatPercent } from "../lib/format.js";

export const Heatmap = ({
  exploration,
}: {
  exploration: ExplorationResult;
}) => {
  const cellByCoordinate = new Map(
    exploration.heatmap.map((cell) => [
      `${cell.winProbability}:${cell.fraction}`,
      cell,
    ]),
  );
  return (
    <section
      className="chart-section chart-wide"
      aria-labelledby="heatmap-title"
    >
      <div className="chart-heading">
        <div>
          <span className="eyebrow">Two-variable stress grid</span>
          <h3 id="heatmap-title">Hit rate × position size</h3>
        </div>
        <p>
          Color blends median CAGR with practical-ruin probability. Every cell
          shares payout, horizon, threshold, and seed.
        </p>
      </div>
      <div
        className="heatmap-scroll"
        tabIndex={0}
        aria-label="Scrollable heatmap"
      >
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `80px repeat(${exploration.heatmapFractions.length}, minmax(66px, 1fr))`,
          }}
          role="grid"
          aria-labelledby="heatmap-title"
        >
          <div className="heatmap-corner" />
          {exploration.heatmapFractions.map((fraction) => (
            <div
              className="heatmap-axis-label"
              role="columnheader"
              key={fraction}
            >
              {formatPercent(fraction, 0)} size
            </div>
          ))}
          {exploration.heatmapProbabilities.flatMap((probability) => [
            <div
              className="heatmap-axis-label row"
              role="rowheader"
              key={`label-${probability}`}
            >
              {formatPercent(probability, 0)} hit
            </div>,
            ...exploration.heatmapFractions.map((fraction) => {
              const cell = cellByCoordinate.get(`${probability}:${fraction}`)!;
              const danger = cell.probabilityOfPracticalRuin;
              const positive = Math.max(
                0,
                Math.min(1, (cell.medianCagr + 0.5) / 1.5),
              );
              const red = 35 + danger * 210;
              const green = 58 + positive * 155 - danger * 85;
              return (
                <button
                  className="heatmap-cell"
                  type="button"
                  role="gridcell"
                  style={{
                    background: `rgb(${red.toFixed(0)} ${green.toFixed(0)} 108 / 0.72)`,
                  }}
                  aria-label={`${formatPercent(probability)} hit rate, ${formatPercent(
                    fraction,
                  )} position: median CAGR ${formatPercent(
                    cell.medianCagr,
                  )}, practical ruin ${formatPercent(cell.probabilityOfPracticalRuin)}`}
                  key={`${probability}:${fraction}`}
                >
                  <strong>{formatPercent(cell.medianCagr, 0)}</strong>
                  <span>
                    {formatPercent(cell.probabilityOfPracticalRuin, 0)} ruin
                  </span>
                </button>
              );
            }),
          ])}
        </div>
      </div>
      <span className="sample-caption">
        Median CAGR shown · {exploration.heatmapPathCount.toLocaleString()}{" "}
        paths/cell · cells are finite-sample estimates
      </span>
    </section>
  );
};
