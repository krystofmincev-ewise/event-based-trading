import type {
  ExplorationResult,
  SimulationResult,
} from "@event-lab/simulation";
import { useState } from "react";

import { FanChart } from "../charts/FanChart.js";
import { FrontierChart } from "../charts/FrontierChart.js";
import { Heatmap } from "../charts/Heatmap.js";
import { HistogramChart } from "../charts/HistogramChart.js";
import { BenchmarkPanel } from "./BenchmarkPanel.js";

interface AnalyticsDashboardProps {
  simulation: SimulationResult;
  exploration: ExplorationResult;
}

export const AnalyticsDashboard = ({
  simulation,
  exploration,
}: AnalyticsDashboardProps) => {
  const [view, setView] = useState<"nominal" | "percentage">("nominal");
  return (
    <div className="analytics-dashboard">
      <div
        className="view-toggle"
        role="group"
        aria-label="Bankroll and terminal value scale"
      >
        <span>Bankroll &amp; terminal scale</span>
        <button
          type="button"
          className={view === "nominal" ? "active" : undefined}
          aria-pressed={view === "nominal"}
          onClick={() => setView("nominal")}
        >
          Nominal
        </button>
        <button
          type="button"
          className={view === "percentage" ? "active" : undefined}
          aria-pressed={view === "percentage"}
          onClick={() => setView("percentage")}
        >
          Percentage
        </button>
      </div>
      <FanChart result={simulation} view={view} />
      <div className="chart-pair">
        <HistogramChart
          id="terminal-histogram-title"
          eyebrow="Terminal distribution"
          title="Where paths finish"
          description="Arithmetic right tails can pull the expected value far above the typical outcome."
          histogram={simulation.terminalReturnHistogram}
          kind="terminal-return"
          view={view}
          startingCapital={simulation.input.startingCapital}
        />
        <HistogramChart
          id="drawdown-histogram-title"
          eyebrow="Pathwise drawdown"
          title="Pain, not just destination"
          description="Maximum drawdown is calculated inside each path before aggregation."
          histogram={simulation.maxDrawdownHistogram}
          kind="drawdown"
          view="percentage"
          startingCapital={simulation.input.startingCapital}
        />
      </div>
      <FrontierChart exploration={exploration} simulation={simulation} />
      <Heatmap exploration={exploration} />
      <BenchmarkPanel result={simulation} />
    </div>
  );
};
