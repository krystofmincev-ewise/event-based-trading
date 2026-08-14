import type {
  ExplorationResult,
  KellyComparisonPoint,
  SimulationInput,
  SimulationResult,
} from "@event-lab/simulation";

export interface LabData {
  simulation: SimulationResult;
  exploration: ExplorationResult;
  comparison: KellyComparisonPoint[];
}

class ApiError extends Error {}

const request = async <ResponseBody>(
  path: string,
  input: SimulationInput,
  signal: AbortSignal,
): Promise<ResponseBody> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The local simulation API rejected the request.";
    throw new ApiError(message);
  }
  return body as ResponseBody;
};

export const loadLabData = async (
  input: SimulationInput,
  signal: AbortSignal,
): Promise<LabData> => {
  const [simulationBody, explorationBody, kellyBody] = await Promise.all([
    request<{ simulation: SimulationResult }>("/api/simulate", input, signal),
    request<{ exploration: ExplorationResult }>("/api/explore", input, signal),
    request<{ comparison: KellyComparisonPoint[] }>(
      "/api/kelly",
      input,
      signal,
    ),
  ]);
  return {
    simulation: simulationBody.simulation,
    exploration: explorationBody.exploration,
    comparison: kellyBody.comparison,
  };
};
