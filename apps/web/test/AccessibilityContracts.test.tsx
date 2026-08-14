import {
  DEFAULT_SIMULATION_INPUT,
  runExploration,
  runSimulation,
} from "@event-lab/simulation";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FrontierChart } from "../src/charts/FrontierChart.js";
import { Heatmap } from "../src/charts/Heatmap.js";
import { HistogramChart } from "../src/charts/HistogramChart.js";
import { HorizontalScrollRegion } from "../src/charts/HorizontalScrollRegion.js";
import { FanChart } from "../src/charts/FanChart.js";
import { ControlPanel } from "../src/components/ControlPanel.js";
import { Header } from "../src/components/Header.js";
import { BenchmarkPanel } from "../src/components/BenchmarkPanel.js";
import { MetricStrip } from "../src/components/MetricStrip.js";

const input = {
  ...DEFAULT_SIMULATION_INPUT,
  pathCount: 100,
  horizonWeeks: 2,
};
const simulation = runSimulation(input);
const exploration = runExploration(input);

const StatefulControls = () => {
  const [current, setCurrent] = useState(input);
  return <ControlPanel input={current} onChange={setCurrent} />;
};

describe("accessible analytics contracts", () => {
  it("announces the actual fan-chart week instead of its checkpoint index", () => {
    render(<FanChart result={simulation} view="percentage" />);
    expect(screen.getByLabelText("Fan chart week")).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/^Week 2\.0 of 2; median /),
    );
  });

  it("renders the heatmap as a noninteractive data table", () => {
    render(<Heatmap exploration={exploration} />);
    const table = screen.getByRole("table", {
      name: "Hit rate by position size scenario results",
    });
    expect(within(table).getAllByRole("columnheader").length).toBe(
      exploration.heatmapFractions.length + 1,
    );
    expect(within(table).getAllByRole("rowheader")).toHaveLength(
      exploration.heatmapProbabilities.length,
    );
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes exact histogram and frontier values on demand", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HistogramChart
          id="terminal-distribution"
          eyebrow="Distribution"
          title="Terminal distribution"
          description="Test distribution."
          histogram={simulation.terminalReturnHistogram}
          kind="terminal-return"
          view="percentage"
          startingCapital={input.startingCapital}
        />
        <FrontierChart exploration={exploration} simulation={simulation} />
      </>,
    );

    await user.click(screen.getByText("View exact bin counts"));
    expect(
      screen.getByRole("table", {
        name: "Terminal distribution exact bin counts",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("View exact frontier data"));
    expect(
      screen.getByRole("table", {
        name: "Position-size frontier exact values",
      }),
    ).toBeInTheDocument();
  });

  it("supports keyboard movement in locally scrollable charts", () => {
    const scrollBy = vi.fn();
    const scrollTo = vi.fn();
    render(
      <HorizontalScrollRegion label="Test chart">
        <div>Wide content</div>
      </HorizontalScrollRegion>,
    );
    const region = screen.getByRole("region", {
      name: "Test chart, horizontally scrollable",
    });
    Object.defineProperties(region, {
      clientWidth: { value: 300 },
      scrollWidth: { value: 900 },
      scrollBy: { value: scrollBy },
      scrollTo: { value: scrollTo },
    });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    fireEvent.keyDown(region, { key: "End" });
    expect(scrollBy).toHaveBeenCalledWith({ left: 195, behavior: "auto" });
    expect(scrollTo).toHaveBeenCalledWith({ left: 900, behavior: "auto" });
  });
});

describe("numeric control drafts", () => {
  it("keeps contract price render-safe while clearing, typing, and blurring", async () => {
    const user = userEvent.setup();
    render(<StatefulControls />);
    const payoutInput = screen.getByLabelText(
      "Executable contract purchase price",
    );

    await user.clear(payoutInput);
    expect(payoutInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("$0.500")).toBeInTheDocument();

    await user.type(payoutInput, "0.2");
    await user.tab();
    expect(payoutInput).toHaveValue(0.2);
    expect(screen.getByText("$0.210")).toBeInTheDocument();
  });

  it("does not dispatch an empty intermediate value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlPanel input={input} onChange={onChange} />);
    const positionInput = screen.getByLabelText("Target bankroll at risk");

    await user.clear(positionInput);
    expect(onChange).not.toHaveBeenCalled();
    expect(positionInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a value from 0 to 100."),
    ).toBeInTheDocument();

    await user.type(positionInput, "12");
    expect(onChange).toHaveBeenLastCalledWith({
      ...input,
      positionFraction: 0.12,
    });
    expect(positionInput).not.toHaveAttribute("aria-invalid");
  });

  it("uses an unclipped currency entry without a misleading linear slider", () => {
    render(<StatefulControls />);
    expect(screen.getByLabelText("Starting capital")).toHaveValue(100_000);
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(
      screen.queryByRole("slider", { name: "Starting capital slider" }),
    ).not.toBeInTheDocument();
  });

  it("uses explicit price inputs without a misleading large linear slider", () => {
    render(<StatefulControls />);
    expect(
      screen.queryByRole("slider", {
        name: "Executable contract purchase price slider",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Executable contract purchase price"),
    ).toHaveValue(0.49);
  });

  it("rejects fractional event counts before dispatching them", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlPanel input={input} onChange={onChange} />);
    const events = screen.getByLabelText("Whole events per week");

    await user.clear(events);
    await user.type(events, "2.5");
    expect(events).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a whole number from 1 to 20."),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith({
      ...input,
      eventsPerWeek: 2.5,
    });

    const paths = screen.getByLabelText("Monte Carlo paths");
    await user.clear(paths);
    await user.type(paths, "100.5");
    expect(paths).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalledWith({
      ...input,
      pathCount: 100.5,
    });
  });
});

describe("decision display semantics", () => {
  it("labels a locally prevented workload as an input issue", () => {
    render(<Header status="error" issueKind="input" />);
    expect(screen.getByRole("status")).toHaveTextContent("Input issue");
  });

  it("keeps invalid benchmark drafts from changing the modeled result", async () => {
    const user = userEvent.setup();
    const { container } = render(<BenchmarkPanel result={simulation} />);
    const volatility = screen.getByLabelText("Annual volatility");
    const expectedOutput = container.querySelector(
      ".benchmark-outcomes > div:first-child dd",
    );
    const expectedBefore = expectedOutput?.textContent;

    await user.clear(volatility);
    expect(volatility).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a value from 0% to 100%."),
    ).toBeInTheDocument();
    expect(expectedOutput?.textContent).toBe(expectedBefore);

    await user.type(volatility, "22");
    await user.tab();
    expect(volatility).toHaveValue(22);
    expect(volatility).not.toHaveAttribute("aria-invalid");
  });

  it("derives metric tones from the outcomes", () => {
    const negative = {
      ...simulation,
      metrics: {
        ...simulation.metrics,
        expectedTotalReturn: -0.1,
        probabilityOfPracticalRuin: 0,
      },
    };
    render(<MetricStrip result={negative} />);
    expect(screen.getByText("Expected terminal").parentElement).toHaveClass(
      "metric-danger",
    );
    expect(screen.getByText("Practical ruin").parentElement).toHaveClass(
      "metric-neutral",
    );
  });
});
