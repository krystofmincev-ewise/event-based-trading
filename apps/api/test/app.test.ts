import { DEFAULT_SIMULATION_INPUT } from "@event-lab/simulation";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleRequest } from "../src/app.js";

describe("HTTP API", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

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
    const kelly = (await kellyResponse.json()) as { comparison: unknown[] };
    expect(exploration.exploration.sweep.length).toBeGreaterThan(15);
    expect(exploration.exploration.heatmap.length).toBeGreaterThan(30);
    expect(kelly.comparison).toHaveLength(4);
  });

  it("rejects malformed and invalid inputs without leaking internals", async () => {
    const malformed = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...DEFAULT_SIMULATION_INPUT,
        netWinMultiple: 0,
      }),
    });
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({
      error: "Simulation input is invalid.",
      details: expect.arrayContaining([
        expect.stringContaining("netWinMultiple"),
      ]),
    });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    expect(response.status).toBe(404);
  });
});
