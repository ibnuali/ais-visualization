export const MAP_REFRESH_INTERVAL_MS = 5000;
export const MAX_ACTIVITY_EVENTS = 120;
export const TRACK_PLAYBACK_INTERVAL_MS = 700;

export const DATA_STATE_COPY = {
  connecting: {
    label: "Syncing",
    detail: "Loading the latest database snapshot",
  },
  connected: {
    label: "Current",
    detail: "Showing positions stored by the worker",
  },
  stopped: {
    label: "Paused",
    detail: "Worker stopped; vessel polling is paused",
  },
  error: {
    label: "Attention",
    detail: "The database snapshot could not be loaded",
  },
};
