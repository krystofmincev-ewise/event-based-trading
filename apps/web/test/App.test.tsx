import {
  DEFAULT_SIMULATION_INPUT,
  runExploration,
  runKellyComparison,
  runSimulation,
} from "@event-lab/simulation";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const installDynamicFetchMock = () => {
  const fetchMock = vi.fn(
    (resource: string | URL | Request, options?: RequestInit) => {
      const path =
        typeof resource === "string"
          ? resource
          : resource instanceof URL
            ? resource.pathname
            : new URL(resource.url).pathname;
      if (typeof options?.body !== "string") {
        throw new Error("Expected a serialized request body.");
      }
      const requested = JSON.parse(options.body) as typeof testInput;
      const input = { ...requested, pathCount: 100, horizonWeeks: 2 };
      const body =
        path === "/api/simulate"
          ? { simulation: runSimulation(input) }
          : path === "/api/explore"
            ? { exploration: runExploration(input) }
            : { comparison: runKellyComparison(input) };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  );
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
    expect(
      await screen.findByRole(
        "heading",
        { name: "Bankroll fan" },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Expected terminal").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      screen.getByText("Typical growth is not the mean"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Kelly, with contract costs and uncertainty.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Size changes the evidence you need.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("$1.2B–$8.0B")).toBeInTheDocument();
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(
      screen.getByRole("group", {
        name: "Bankroll and terminal value scale",
      }),
    ).toBeInTheDocument();
  });

  it("recomputes after an accessible numeric control changes", async () => {
    const fetchMock = installFetchMock();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole(
      "heading",
      { name: "Bankroll fan" },
      { timeout: 5_000 },
    );
    const positionInput = screen.getByLabelText("Target bankroll at risk");
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
      await screen.findByText("Simulation refresh failed"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Event hit probability")).toBeEnabled();
  });

  it("rejects malformed successful API payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ unexpected: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(<App />);
    expect(
      await screen.findByText("Simulation refresh failed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/returned a malformed result/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Expected terminal")).not.toBeInTheDocument();
  });

  it("rejects a superficially valid but incomplete simulation envelope", async () => {
    const incomplete = JSON.parse(
      JSON.stringify(responseBodies["/api/simulate"]),
    ) as Record<string, unknown>;
    const simulation = incomplete.simulation as Record<string, unknown>;
    const metrics = simulation.metrics as Record<string, unknown>;
    delete metrics.terminalCapital;
    vi.stubGlobal(
      "fetch",
      vi.fn((resource: string | URL | Request) => {
        const path =
          typeof resource === "string"
            ? resource
            : resource instanceof URL
              ? resource.pathname
              : new URL(resource.url).pathname;
        const body =
          path === "/api/simulate"
            ? incomplete
            : responseBodies[path as keyof typeof responseBodies];
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    render(<App />);
    expect(
      await screen.findByText(/returned a malformed result/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Expected terminal")).not.toBeInTheDocument();
  });

  it("rejects stale Kelly comparison labels at the client boundary", async () => {
    const staleKelly = JSON.parse(
      JSON.stringify(responseBodies["/api/kelly"]),
    ) as { comparison: Array<{ label: string }> };
    staleKelly.comparison[3]!.label = "Raw Kelly";
    vi.stubGlobal(
      "fetch",
      vi.fn((resource: string | URL | Request) => {
        const path =
          typeof resource === "string"
            ? resource
            : resource instanceof URL
              ? resource.pathname
              : new URL(resource.url).pathname;
        const body =
          path === "/api/kelly"
            ? staleKelly
            : responseBodies[path as keyof typeof responseBodies];
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    render(<App />);
    expect(
      await screen.findByText(/returned a malformed result/i),
    ).toBeInTheDocument();
  });

  it("preserves server validation details without claiming the API is offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Simulation input is invalid.",
              details: ["workload path-events exceeds the local limit"],
            }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    render(<App />);
    expect(
      await screen.findByText("workload path-events exceeds the local limit"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Start the local API/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Review the inputs and retry/i),
    ).toBeInTheDocument();
  });

  it("retains explicitly stale results and recovers through Retry", async () => {
    let callCount = 0;
    const fetchMock = vi.fn((resource: string | URL | Request) => {
      callCount += 1;
      if (callCount >= 4 && callCount <= 6) {
        return Promise.reject(new Error("offline"));
      }
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
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bankroll fan" });

    await user.click(
      screen.getByRole("button", { name: "Use estimated-p kelly" }),
    );
    expect(
      await screen.findByText("Simulation refresh failed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/last successful result remains/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Stale results from the last successful simulation",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Expected terminal").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Retry simulation" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Simulation refresh failed"),
      ).not.toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it("applies a synchronized Kelly risk budget", async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);
    const kellyResults = await screen.findByLabelText("Kelly fraction results");
    await user.click(
      within(kellyResults).getByRole("button", {
        name: "Use estimated-p kelly",
      }),
    );
    expect(screen.getByLabelText("Target bankroll at risk")).toHaveValue(8);
    expect(
      within(kellyResults).getByRole("button", { name: "Applied" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Applied · recomputing…")).toBeInTheDocument();
  });

  it("closes the compact section menu after navigation", async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<App />);
    const summary = screen.getByText("Sections");
    const menu = summary.closest("details");
    expect(menu).not.toBeNull();
    await user.click(summary);
    expect(menu).toHaveAttribute("open");
    await user.click(
      within(menu as HTMLElement).getByRole("link", { name: "Kelly sizing" }),
    );
    expect(menu).not.toHaveAttribute("open");
  });

  it("recomputes Kelly fractions from its synchronized probability control", async () => {
    installDynamicFetchMock();
    const user = userEvent.setup();
    render(<App />);
    const probability = await screen.findByLabelText(
      "Kelly success probability",
    );
    await user.clear(probability);
    await user.type(probability, "60");

    const results = screen.getByLabelText("Kelly fraction results");
    const conservative = within(results)
      .getByText("Conservative Kelly")
      .closest(".kelly-lane");
    const raw = within(results)
      .getByText("Estimated-p Kelly")
      .closest(".kelly-lane");
    await waitFor(() => expect(conservative).toHaveTextContent("14.0%"));
    expect(raw).toHaveTextContent("20.0%");
    expect(screen.getByLabelText("Event hit probability")).toHaveValue(60);
  });
});
