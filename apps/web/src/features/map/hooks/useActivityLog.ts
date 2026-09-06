import { useCallback, useState } from "react";
import type { ActivityEvent, ActivityType } from "../../../types.ts";
import { MAX_ACTIVITY_EVENTS } from "../constants.ts";
import { createActivityEvent } from "../utils.ts";

export interface ActivityLogState {
  addActivity: (type: ActivityType, title: string, detail: string) => void;
  clearActivityLog: () => void;
  logs: ActivityEvent[];
}

export function useActivityLog(): ActivityLogState {
  const [logs, setLogs] = useState<ActivityEvent[]>(() => [
    createActivityEvent(
      "info",
      "Map ready",
      "Loading positions through the API from the database.",
    ),
  ]);

  const addActivity = useCallback(
    (type: ActivityType, title: string, detail: string): void => {
      setLogs((currentLogs) =>
        [createActivityEvent(type, title, detail), ...currentLogs].slice(
          0,
          MAX_ACTIVITY_EVENTS,
        ),
      );
    },
    [],
  );

  const clearActivityLog = useCallback((): void => {
    setLogs([
      createActivityEvent(
        "info",
        "Activity log cleared",
        "The map will continue refreshing from the database.",
      ),
    ]);
  }, []);

  return { addActivity, clearActivityLog, logs };
}
