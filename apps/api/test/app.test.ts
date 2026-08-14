import { DEFAULT_SIMULATION_INPUT } from "@event-lab/simulation";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleRequest } from "../src/app.js";

describe("HTTP API", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  const sizingInput = {
    bankroll: 10_000,
    winProbability: 0.55,
    probabilityHaircut: 0.03,
    contractPurchasePrice: 49,
    settlementPayout: 100,
    roundTripCosts: 1,
    sizingPolicy: "conservative-kelly",
    customFraction: 0,
    maximumPositionFraction: 0.03,
  };

  beforeEach(async () => {
    server = createServer((request, response) => {
      void handleRequest(request, response);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("reports health and no-store headers", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "event-edge-api",
      version: "0.1.0",
    });
  });

  it("returns a deterministic validated simulation contract", async () => {
    const input = {
      ...DEFAULT_SIMULATION_INPUT,
      pathCount: 100,
      horizonWeeks: 4,
    };
    const request = () =>
      fetch(`${baseUrl}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
  });

  it("exposes exploration and Kelly comparison endpoints", async () => {
    const input = {
      ...DEFAULT_SIMULATION_INPUT,
      pathCount: 100,
      horizonWeeks: 2,
    };
    const post = (path: string) =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

    const [exploreResponse, kellyResponse] = await Promise.all([
      post("/api/explore"),
      post("/api/kelly"),
    ]);
    const exploration = (await exploreResponse.json()) as {
      exploration: { sweep: unknown[]; heatmap: unknown[] };
    };
    const kelly = (await kellyResponse.json()) as {
      comparison: Array<{ pathCount: number }>;
    };
    expect(exploration.exploration.sweep.length).toBeGreaterThan(15);
    expect(exploration.exploration.heatmap.length).toBeGreaterThan(30);
    expect(kelly.comparison).toHaveLength(4);
    expect(kelly.comparison.map((point) => point.pathCount)).toEqual([
      0, 100, 100, 100,
    ]);
  });

  it("exposes an agent-ready whole-contract sizing endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/size`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sizingInput),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sizing: {
        wholeContractCount: 6,
        actualCapitalAtRisk: 300,
        bindingReason: "position-cap",
        economics: { breakEvenProbability: 0.5 },
      },
    });
  });

  it("returns agent-safe no-edge and zero-contract decisions", async () => {
    const postSizing = (input: object) =>
      fetch(`${baseUrl}/api/size`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    const noEdge = await postSizing({
      ...sizingInput,
      winProbability: 0.6,
      probabilityHaircut: 0,
      contractPurchasePrice: 70,
      roundTripCosts: 0,
      sizingPolicy: "estimated-kelly",
      maximumPositionFraction: 1,
    });
    const roundedToZero = await postSizing({
      ...sizingInput,
      bankroll: 100,
      sizingPolicy: "custom",
      customFraction: 0.25,
      maximumPositionFraction: 1,
    });
    expect(noEdge.status).toBe(200);
    await expect(noEdge.json()).resolves.toMatchObject({
      sizing: {
        wholeContractCount: 0,
        actualCapitalAtRisk: 0,
        bindingReason: "non-positive-edge",
      },
    });
    expect(roundedToZero.status).toBe(200);
    await expect(roundedToZero.json()).resolves.toMatchObject({
      sizing: {
        wholeContractCount: 0,
        bindingReason: "whole-contract-rounding",
      },
    });
  });

  it("rejects invalid sizing policies and impossible contract terms", async () => {
    const response = await fetch(`${baseUrl}/api/size`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sizingInput,
        sizingPolicy: "auto-opposite",
        contractPurchasePrice: 100,
      }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Position sizing input is invalid.",
      details: expect.arrayContaining([
        expect.stringContaining("sizingPolicy must be"),
        expect.stringContaining("contractPurchasePrice + roundTripCosts"),
      ]),
    });
  });

  it("keeps extreme short-horizon CAGR values finite across JSON", async () => {
    const input = {
      ...DEFAULT_SIMULATION_INPUT,
      winProbability: 1,
      positionFraction: 1,
      contractPurchasePrice: 1,
      settlementPayout: 21,
      roundTripCosts: 0,
      eventsPerWeek: 20,
      horizonWeeks: 1,
      startingCapital: 100,
      pathCount: 100,
    };
    const post = (path: string) =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

    const simulationResponse = await post("/api/simulate");
    const simulationBody = (await simulationResponse.json()) as {
      simulation: {
        metrics: {
          impliedCagrFromExpectedTerminal: number;
          impliedCagrFromMedianTerminal: number;
        };
        metadata: { cagrOutputCapped: boolean };
      };
    };
    expect(simulationResponse.status).toBe(200);
    expect(
      Number.isFinite(
        simulationBody.simulation.metrics.impliedCagrFromExpectedTerminal,
      ),
    ).toBe(true);
    expect(
      Number.isFinite(
        simulationBody.simulation.metrics.impliedCagrFromMedianTerminal,
      ),
    ).toBe(true);
    expect(simulationBody.simulation.metadata.cagrOutputCapped).toBe(true);

    const explorationResponse = await post("/api/explore");
    const explorationBody = (await explorationResponse.json()) as {
      exploration: { sweep: Array<{ medianCagr: number }> };
    };
    expect(explorationResponse.status).toBe(200);
    expect(
      explorationBody.exploration.sweep.every((point) =>
        Number.isFinite(point.medianCagr),
      ),
    ).toBe(true);
  });

  it("rejects malformed and invalid inputs without leaking internals", async () => {
    const malformed = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...DEFAULT_SIMULATION_INPUT,
        contractPurchasePrice: 1,
        settlementPayout: 1,
      }),
    });
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({
      error: "Simulation input is invalid.",
      details: expect.arrayContaining([
        expect.stringContaining("contractPurchasePrice + roundTripCosts"),
      ]),
    });

    const excessive = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...DEFAULT_SIMULATION_INPUT,
        pathCount: 25_000,
        eventsPerWeek: 20,
        horizonWeeks: 104,
      }),
    });
    expect(excessive.status).toBe(422);
    await expect(excessive.json()).resolves.toMatchObject({
      details: expect.arrayContaining([
        expect.stringContaining("path-events exceeds"),
      ]),
    });
  });

  it("rejects cross-origin and non-JSON compute requests before simulation", async () => {
    const unsupported = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(DEFAULT_SIMULATION_INPUT),
    });
    expect(unsupported.status).toBe(415);

    const crossOrigin = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.com",
      },
      body: JSON.stringify(DEFAULT_SIMULATION_INPUT),
    });
    expect(crossOrigin.status).toBe(403);
  });

  it("returns 404 for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    expect(response.status).toBe(404);
  });
});
