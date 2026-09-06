import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { requestJson } from "../../../lib/api.ts";
import { getErrorMessage } from "../../../lib/errors.ts";
import type { WorkerAction, WorkerControl } from "../../../types.ts";
import { WORKER_STATUS_INTERVAL_MS } from "../constants.ts";

export interface WorkerControlState {
  controlToken: string;
  error: string;
  isControlConfigured: boolean;
  isSubmitting: boolean;
  sendWorkerAction: (action: WorkerAction) => Promise<void>;
  setControlToken: Dispatch<SetStateAction<string>>;
  worker: WorkerControl | null;
}

export function useWorkerControl(): WorkerControlState {
  const [worker, setWorker] = useState<WorkerControl | null>(null);
  const [controlToken, setControlToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  const loadWorker = useCallback(async (): Promise<void> => {
    try {
      const payload = await requestJson<WorkerControl>("/api/worker");

      if (!isMountedRef.current) {
        return;
      }

      setWorker(payload);
      setError("");
    } catch (requestError) {
      if (!isMountedRef.current) {
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          "The worker control state could not be loaded.",
        ),
      );
    }
  }, []);

  const sendWorkerAction = useCallback(
    async (action: WorkerAction): Promise<void> => {
      if (!controlToken) {
        setError(
          "Enter the worker control token to change the ingestion state.",
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = await requestJson<WorkerControl>(
          `/api/worker/${action}`,
          {
            method: "POST",
            headers: {
              "X-Worker-Control-Token": controlToken,
            },
          },
        );

        if (isMountedRef.current) {
          setWorker({
            ...payload,
            control_configured: true,
          });
          setError("");
        }
      } catch (requestError) {
        if (isMountedRef.current) {
          setError(
            getErrorMessage(
              requestError,
              "The worker control state could not be updated.",
            ),
          );
        }
      } finally {
        if (isMountedRef.current) {
          setControlToken("");
          setIsSubmitting(false);
        }
      }
    },
    [controlToken],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadWorker();
    const statusTimer = window.setInterval(() => {
      void loadWorker();
    }, WORKER_STATUS_INTERVAL_MS);

    return () => window.clearInterval(statusTimer);
  }, [loadWorker]);

  return {
    controlToken,
    error,
    isControlConfigured: worker?.control_configured === true,
    isSubmitting,
    sendWorkerAction,
    setControlToken,
    worker,
  };
}
