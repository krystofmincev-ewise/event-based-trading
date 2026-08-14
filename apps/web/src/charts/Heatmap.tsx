import type { ExplorationResult } from "@event-lab/simulation";

import { formatPercent } from "../lib/format.js";
import { HorizontalScrollRegion } from "./HorizontalScrollRegion.js";

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
      <HorizontalScrollRegion
        label="Hit rate by position size table"
        className="heatmap-scroll"
      >
        <table className="heatmap-table">
          <caption className="sr-only">
            Hit rate by position size scenario results
          </caption>
          <thead>
            <tr>
              <th className="heatmap-axis-label" scope="col">
                Hit rate
              </th>
              {exploration.heatmapFractions.map((fraction) => (
                <th className="heatmap-axis-label" scope="col" key={fraction}>
                  {formatPercent(fraction, 0)} size
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exploration.heatmapProbabilities.map((probability) => (
              <tr key={probability}>
                <th className="heatmap-axis-label row" scope="row">
                  {formatPercent(probability, 0)} hit
                </th>
                {exploration.heatmapFractions.map((fraction) => {
                  const cell = cellByCoordinate.get(
                    `${probability}:${fraction}`,
                  )!;
                  const danger = cell.probabilityOfPracticalRuin;
                  const positive = Math.max(
                    0,
                    Math.min(1, (cell.medianCagr + 0.5) / 1.5),
                  );
                  const red = 28 + danger * 105;
                  const green = 44 + positive * 85 - danger * 25;
                  return (
                    <td
                      className="heatmap-cell"
                      style={{
                        background: `rgb(${red.toFixed(0)} ${green.toFixed(0)} 64)`,
                      }}
                      aria-label={`Median CAGR ${formatPercent(
                        cell.medianCagr,
                      )}; practical ruin ${formatPercent(cell.probabilityOfPracticalRuin)}`}
                      key={`${probability}:${fraction}`}
                    >
                      <strong>{formatPercent(cell.medianCagr, 0)}</strong>
                      <span>
                        {formatPercent(cell.probabilityOfPracticalRuin, 0)} ruin
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollRegion>
      <span className="sample-caption">
        Median CAGR shown · {exploration.heatmapPathCount.toLocaleString()}{" "}
        paths/cell · cells are finite-sample estimates
      </span>
    </section>
  );
};
