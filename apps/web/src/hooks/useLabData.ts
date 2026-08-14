import type { SimulationInput } from "@event-lab/simulation";
import { useEffect, useState } from "react";

import { loadLabData } from "../lib/api.js";
import type { LabData } from "../lib/api.js";

interface LabState {
  data: LabData | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

export const useLabData = (input: SimulationInput): LabState => {
  const [state, setState] = useState<LabState>({
    data: null,
    status: "idle",
    error: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      void loadLabData(input, controller.signal)
        .then((data) => setState({ data, status: "ready", error: null }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState((current) => ({
            ...current,
            status: "error",
            error:
              error instanceof Error ? error.message : "Simulation failed.",
          }));
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [input]);

  return state;
};
