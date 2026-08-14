import type { Histogram } from "@event-lab/simulation";

import { formatCurrency, formatPercent } from "../lib/format.js";
import { linearScale } from "./chartUtils.js";

interface HistogramChartProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  histogram: Histogram;
  kind: "terminal-return" | "drawdown";
  view: "nominal" | "percentage";
  startingCapital: number;
}

const WIDTH = 520;
const HEIGHT = 270;
const MARGIN = { top: 12, right: 12, bottom: 40, left: 16 };

export const HistogramChart = ({
  id,
  eyebrow,
  title,
  description,
  histogram,
  kind,
  view,
  startingCapital,
}: HistogramChartProps) => {
  const maxCount = Math.max(...histogram.bins.map((bin) => bin.count), 1);
  const barWidth = (WIDTH - MARGIN.left - MARGIN.right) / histogram.bins.length;
  const y = linearScale(0, maxCount, HEIGHT - MARGIN.bottom, MARGIN.top);
  const convert = (value: number) =>
    kind === "terminal-return" && view === "nominal"
      ? startingCapital * (1 + value)
      : value;
  const format =
    kind === "terminal-return" && view === "nominal"
      ? formatCurrency
      : formatPercent;
  const [minimum, maximum] = histogram.domain;

  return (
    <section className="chart-section" aria-labelledby={id}>
      <div className="chart-heading compact">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3 id={id}>{title}</h3>
        </div>
      </div>
      <p className="chart-description">{description}</p>
      <div className="svg-wrap">
        <svg
          className="analytics-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={id}
        >
          <line
            className="chart-grid"
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={HEIGHT - MARGIN.bottom}
            y2={HEIGHT - MARGIN.bottom}
          />
          {histogram.bins.map((bin, index) => {
            const height = HEIGHT - MARGIN.bottom - y(bin.count);
            return (
              <rect
                className={
                  kind === "drawdown" ? "histogram-bar danger" : "histogram-bar"
                }
                x={MARGIN.left + index * barWidth + 1}
                y={y(bin.count)}
                width={Math.max(1, barWidth - 2)}
                height={Math.max(0, height)}
                key={`${bin.lower}:${bin.upper}`}
              >
                <title>
                  {format(convert(bin.lower))} to {format(convert(bin.upper))}:{" "}
                  {bin.count.toLocaleString()} paths
                </title>
              </rect>
            );
          })}
          {[minimum, (minimum + maximum) / 2, maximum].map((tick) => (
            <text
              className="chart-axis"
              x={
                MARGIN.left +
                ((tick - minimum) / (maximum - minimum)) *
                  (WIDTH - MARGIN.left - MARGIN.right)
              }
              y={HEIGHT - 12}
              textAnchor="middle"
              key={tick}
            >
              {format(convert(tick))}
            </text>
          ))}
        </svg>
      </div>
      <span className="sample-caption">
        n = {histogram.sampleCount.toLocaleString()} paths · hover bars for
        counts
      </span>
    </section>
  );
};
