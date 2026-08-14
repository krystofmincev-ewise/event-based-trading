import {
  DEFAULT_SIMULATION_INPUT,
  runExploration,
  runKellyComparison,
  runSimulation,
} from "@event-lab/simulation";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLabData } from "../src/hooks/useLabData.js";

const baseInput = {
  ...DEFAULT_SIMULATION_INPUT,
  pathCount: 100,
  horizonWeeks: 2,
  seed: "older",
};

const payloadFor = (path: string, seed: string) => {
  const input = { ...baseInput, seed };
  if (path === "/api/simulate") {
    return { simulation: runSimulation(input) };
  }
  if (path === "/api/explore") {
    return { exploration: runExploration(input) };
  }
  return { comparison: runKellyComparison(input) };
};

const LabHarness = () => {
  const [seed, setSeed] = useState("older");
  const input = useMemo(() => ({ ...baseInput, seed }), [seed]);
  const lab = useLabData(input);
  return (
    <>
      <button type="button" onClick={() => setSeed("newer")}>
        Use newer input
      </button>
      <button type="button" onClick={lab.retry}>
        Retry
      </button>
      <output>{lab.data?.simulation.input.seed ?? lab.status}</output>
      <span>{lab.status}</span>
    </>
  );
};

const OverBudgetHarness = () => {
  const lab = useLabData({
    ...DEFAULT_SIMULATION_INPUT,
    pathCount: 25_000,
    eventsPerWeek: 20,
    horizonWeeks: 104,
  });
  return <output>{lab.error?.kind ?? lab.status}</output>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLabData", () => {
  it("prevents a known over-budget request before contacting the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<OverBudgetHarness />);
    expect(await screen.findByText("input")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores an older request batch that settles after the latest result", async () => {
    const pending: Array<{
      path: string;
      seed: string;
      resolve: (response: Response) => void;
    }> = [];
    const fetchMock = vi.fn(
      (resource: string | URL | Request, options?: RequestInit) => {
        const path =
          typeof resource === "string"
            ? resource
            : resource instanceof URL
              ? resource.pathname
              : new URL(resource.url).pathname;
        if (typeof options?.body !== "string") {
          throw new Error("Expected a serialized simulation request body.");
        }
        const parsedBody = JSON.parse(options.body) as {
          seed: string;
        };
        return new Promise<Response>((resolve) =>
          pending.push({ path, seed: parsedBody.seed, resolve }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LabHarness />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), {
      timeout: 2_000,
    });
    await user.click(screen.getByRole("button", { name: "Use newer input" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6), {
      timeout: 2_000,
    });
    expect(pending.filter(({ seed }) => seed === "newer")).toHaveLength(3);
    expect(pending.filter(({ seed }) => seed === "older")).toHaveLength(3);

    await act(async () => {
      for (const request of pending.filter(({ seed }) => seed === "newer")) {
        request.resolve(
          new Response(JSON.stringify(payloadFor(request.path, "newer"))),
        );
      }
      await Promise.resolve();
    });
    expect(await screen.findByText("newer")).toBeInTheDocument();

    await act(async () => {
      for (const request of pending.filter(({ seed }) => seed === "older")) {
        request.resolve(
          new Response(JSON.stringify(payloadFor(request.path, "older"))),
        );
      }
      await Promise.resolve();
    });
    expect(screen.getByText("newer")).toBeInTheDocument();
  });

  it("retains stale data on failure and replaces it after retry", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((resource: string | URL | Request) => {
        callCount += 1;
        const path =
          typeof resource === "string"
            ? resource
            : resource instanceof URL
              ? resource.pathname
              : new URL(resource.url).pathname;
        if (callCount > 3 && callCount <= 6) {
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify(
              payloadFor(path, callCount <= 3 ? "older" : "newer"),
            ),
          ),
        );
      }),
    );
    const user = userEvent.setup();
    render(<LabHarness />);

    expect(await screen.findByText("older")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use newer input" }));
    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(screen.getByText("older")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("newer")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });
});
