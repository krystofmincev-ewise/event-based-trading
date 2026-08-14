import {
  calculatePositionSizing,
  runExploration,
  runKellyComparison,
  runSimulation,
  validateSimulationInput,
  validatePositionSizingInput,
} from "@event-lab/simulation";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  assertJsonContentType,
  assertLocalRequest,
  HttpError,
  readJsonBody,
  sendJson,
} from "./http.js";

const parseInput = async (request: IncomingMessage) => {
  assertJsonContentType(request);
  const body = await readJsonBody(request);
  const parsed = validateSimulationInput(body);
  if (!parsed.success) {
    throw new HttpError(422, "Simulation input is invalid.", parsed.errors);
  }
  return parsed.data;
};

const parseSizingInput = async (request: IncomingMessage) => {
  assertJsonContentType(request);
  const body = await readJsonBody(request);
  const parsed = validatePositionSizingInput(body);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "Position sizing input is invalid.",
      parsed.errors,
    );
  }
  return parsed.data;
};

const routePost = async (
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> => {
  if (pathname === "/api/size") {
    const input = await parseSizingInput(request);
    sendJson(response, 200, { sizing: calculatePositionSizing(input) });
    return true;
  }
  if (pathname === "/api/simulate") {
    const input = await parseInput(request);
    sendJson(response, 200, { simulation: runSimulation(input) });
    return true;
  }
  if (pathname === "/api/explore") {
    const input = await parseInput(request);
    sendJson(response, 200, { exploration: runExploration(input) });
    return true;
  }
  if (pathname === "/api/kelly") {
    const input = await parseInput(request);
    sendJson(response, 200, { comparison: runKellyComparison(input) });
    return true;
  }
  return false;
};

export const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  try {
    assertLocalRequest(request);
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "event-edge-api",
        version: "0.1.0",
      });
      return;
    }

    if (
      request.method === "POST" &&
      (await routePost(url.pathname, request, response))
    ) {
      return;
    }

    sendJson(response, 404, { error: "Route not found." });
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, {
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }
    console.error("Unhandled API error", error);
    sendJson(response, 500, {
      error: "Simulation request failed unexpectedly.",
    });
  }
};
