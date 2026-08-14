import {
  DEFAULT_SIMULATION_INPUT,
  runExploration,
  runKellyComparison,
  runSimulation,
} from "@event-lab/simulation";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App.js";

const testInput = {
  ...DEFAULT_SIMULATION_INPUT,
  pathCount: 100,
  horizonWeeks: 2,
};
const responseBodies = {
  "/api/simulate": { simulation: runSimulation(testInput) },
  "/api/explore": { exploration: runExploration(testInput) },
  "/api/kelly": { comparison: runKellyComparison(testInput) },
} as const;

const installFetchMock = () => {
  const fetchMock = vi.fn((resource: string | URL | Request) => {
    const path =
      typeof resource === "string"
        ? resource
        : resource instanceof URL
          ? resource.pathname
          : new URL(resource.url).pathname;
    const body = responseBodies[path as keyof typeof responseBodies];
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: body ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("loads the local model and renders decision metrics", async () => {
    const fetchMock = installFetchMock();
    render(<App />);
    expect(
      screen.getByText("Building seeded paths and pathwise risk statistics…"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Expected terminal")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      screen.getByText("Typical growth is not the mean"),
    ).toBeInTheDocument();
  });

  it("recomputes after an accessible numeric control changes", async () => {
    const fetchMock = installFetchMock();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Expected terminal");
    const positionInput = screen.getByLabelText("Current bankroll at risk");
    await user.clear(positionInput);
    await user.type(positionInput, "12");
    await waitFor(
      () => expect(fetchMock.mock.calls.length).toBeGreaterThan(3),
      {
        timeout: 2_000,
      },
    );
    expect(positionInput).toHaveValue(12);
  });

  it("surfaces local API errors without removing the controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Model offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(<App />);
    expect(
      await screen.findByText("Local simulation unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Event hit probability")).toBeEnabled();
  });
});
