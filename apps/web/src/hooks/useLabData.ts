import { estimateLabWork, LAB_OPERATION_BUDGET } from "@event-lab/simulation";
import type { SimulationInput } from "@event-lab/simulation";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeLabFailure, loadLabData } from "../lib/api.js";
import type { LabData, LabFailure } from "../lib/api.js";

interface LabState {
  data: LabData | null;
  status: "idle" | "loading" | "ready" | "error";
  error: LabFailure | null;
  retry: () => void;
}

type InternalLabState = Omit<LabState, "retry">;

export const useLabData = (input: SimulationInput): LabState => {
  const requestGeneration = useRef(0);
  const [requestRevision, setRequestRevision] = useState(0);
  const [state, setState] = useState<InternalLabState>({
    data: null,
    status: "idle",
    error: null,
  });
  useEffect(() => {
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    const work = estimateLabWork(input);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (work.totalPathTrades > LAB_OPERATION_BUDGET) {
        setState((current) => ({
          ...current,
          status: "error",
          error: {
            message: "This experiment exceeds the local compute budget.",
            kind: "input",
            details: [
              `${work.totalPathTrades.toLocaleString()} path-trades requested; limit ${LAB_OPERATION_BUDGET.toLocaleString()}.`,
              "Reduce paths, trades per week, or horizon.",
            ],
          },
        }));
        return;
      }
      setState((current) => ({ ...current, status: "loading", error: null }));
      void loadLabData(input, controller.signal)
        .then((data) => {
          if (
            !controller.signal.aborted &&
            requestGeneration.current === generation
          ) {
            setState({ data, status: "ready", error: null });
          }
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            requestGeneration.current !== generation
          )
            return;
          setState((current) => ({
            ...current,
            status: "error",
            error: describeLabFailure(error),
          }));
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [input, requestRevision]);

  const retry = useCallback(
    () => setRequestRevision((current) => current + 1),
    [],
  );
  return { ...state, retry };
};
