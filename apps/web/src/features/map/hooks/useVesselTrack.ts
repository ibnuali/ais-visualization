import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "../../../lib/api.ts";
import { getErrorMessage } from "../../../lib/errors.ts";
import type {
  ActivityType,
  PlaybackPosition,
  TrackFeature,
  TrackState,
  VesselRecord,
} from "../../../types.ts";
import { TRACK_PLAYBACK_INTERVAL_MS } from "../constants.ts";
import {
  getTrackCoordinates,
  getTrackPlaybackPosition,
  isTrackFeature,
} from "../utils.ts";

const INITIAL_TRACK_STATE: TrackState = {
  status: "idle",
  data: null,
  points: 0,
  error: "",
};

interface UseVesselTrackOptions {
  addActivity: (type: ActivityType, title: string, detail: string) => void;
  vessels: VesselRecord[];
}

export interface VesselTrackState {
  clearSelectedVessel: () => void;
  isTrackPlaying: boolean;
  pauseTrack: () => void;
  playbackIndex: number;
  playbackPosition: PlaybackPosition | null;
  playTrack: () => void;
  selectVessel: (mmsi: string | number) => boolean;
  selectedMmsi: string | null;
  selectedVessel: VesselRecord | null;
  seekTrack: (value: string | number) => void;
  trackState: TrackState;
}

function createTrackState(): TrackState {
  return { ...INITIAL_TRACK_STATE };
}

export function useVesselTrack({
  addActivity,
  vessels,
}: UseVesselTrackOptions): VesselTrackState {
  const [selectedMmsi, setSelectedMmsi] = useState<string | null>(null);
  const [trackState, setTrackState] = useState<TrackState>(createTrackState);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isPlaybackVisible, setIsPlaybackVisible] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const trackAbortRef = useRef<AbortController | null>(null);
  const trackRequestRef = useRef(0);
  const isMountedRef = useRef(true);

  const resetTrackPlayback = useCallback((): void => {
    setIsTrackPlaying(false);
    setIsPlaybackVisible(false);
    setPlaybackIndex(0);
  }, []);

  const clearSelectedVessel = useCallback((): void => {
    trackAbortRef.current?.abort();
    trackAbortRef.current = null;
    trackRequestRef.current += 1;
    setSelectedMmsi(null);
    setTrackState(createTrackState());
    resetTrackPlayback();
  }, [resetTrackPlayback]);

  const selectVessel = useCallback(
    (mmsi: string | number): boolean => {
      const key = String(mmsi);
      const vesselExists = vessels.some(
        (vessel) => String(vessel.mmsi) === key,
      );

      if (!vesselExists) {
        return false;
      }

      trackAbortRef.current?.abort();
      const requestId = trackRequestRef.current + 1;
      trackRequestRef.current = requestId;
      resetTrackPlayback();
      setSelectedMmsi(key);
      setTrackState({
        status: "loading",
        data: null,
        points: 0,
        error: "",
      });

      const controller = new AbortController();
      trackAbortRef.current = controller;

      void requestJson<TrackFeature>(
        `/api/tracks/${encodeURIComponent(key)}?hours=24`,
        { signal: controller.signal },
      )
        .then((track) => {
          if (!isMountedRef.current || trackRequestRef.current !== requestId) {
            return;
          }

          if (!isTrackFeature(track)) {
            throw new Error("The API returned an invalid track.");
          }

          const points = getTrackCoordinates(track).length;
          setTrackState({ status: "ready", data: track, points, error: "" });
          addActivity(
            "result",
            "Track loaded",
            `${points.toLocaleString()} positions loaded for MMSI ${key}.`,
          );
        })
        .catch((error: unknown) => {
          if (
            !isMountedRef.current ||
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "AbortError") ||
            trackRequestRef.current !== requestId
          ) {
            return;
          }

          setTrackState({
            status: "error",
            data: null,
            points: 0,
            error: "The last 24-hour track could not be loaded.",
          });
          addActivity(
            "error",
            "Track unavailable",
            getErrorMessage(error, "The vessel track could not be loaded."),
          );
        });

      return true;
    },
    [addActivity, resetTrackPlayback, vessels],
  );

  const playTrack = useCallback((): void => {
    if (trackState.status !== "ready" || trackState.points < 2) {
      return;
    }

    if (playbackIndex >= trackState.points - 1) {
      setPlaybackIndex(0);
    }
    setIsPlaybackVisible(true);
    setIsTrackPlaying(true);
  }, [playbackIndex, trackState.points, trackState.status]);

  const pauseTrack = useCallback((): void => {
    setIsTrackPlaying(false);
  }, []);

  const seekTrack = useCallback(
    (value: string | number): void => {
      if (trackState.points < 2) {
        return;
      }

      const requestedIndex = Number(value);
      if (!Number.isInteger(requestedIndex)) {
        return;
      }

      setIsPlaybackVisible(true);
      setIsTrackPlaying(false);
      setPlaybackIndex(
        Math.min(Math.max(requestedIndex, 0), trackState.points - 1),
      );
    },
    [trackState.points],
  );

  const selectedVessel = useMemo(
    () =>
      selectedMmsi
        ? vessels.find((vessel) => String(vessel.mmsi) === selectedMmsi) || null
        : null,
    [selectedMmsi, vessels],
  );

  const playbackPosition = useMemo(
    () =>
      isPlaybackVisible
        ? getTrackPlaybackPosition(trackState.data, playbackIndex)
        : null,
    [isPlaybackVisible, playbackIndex, trackState.data],
  );

  useEffect(() => {
    if (!isTrackPlaying || trackState.points < 2) {
      return undefined;
    }

    const playbackTimer = window.setInterval(() => {
      setPlaybackIndex((currentIndex) =>
        Math.min(currentIndex + 1, trackState.points - 1),
      );
    }, TRACK_PLAYBACK_INTERVAL_MS);

    return () => window.clearInterval(playbackTimer);
  }, [isTrackPlaying, trackState.points]);

  useEffect(() => {
    if (
      isTrackPlaying &&
      trackState.points > 1 &&
      playbackIndex >= trackState.points - 1
    ) {
      setIsTrackPlaying(false);
    }
  }, [isTrackPlaying, playbackIndex, trackState.points]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      trackAbortRef.current?.abort();
    };
  }, []);

  return {
    clearSelectedVessel,
    isTrackPlaying,
    pauseTrack,
    playbackIndex,
    playbackPosition,
    playTrack,
    selectVessel,
    selectedMmsi,
    selectedVessel,
    seekTrack,
    trackState,
  };
}
