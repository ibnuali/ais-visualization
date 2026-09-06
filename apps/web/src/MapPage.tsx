import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import ActivityDrawer from "./features/map/components/ActivityDrawer.tsx";
import CommandMenu from "./features/map/components/CommandMenu.tsx";
import MapEmptyState from "./features/map/components/MapEmptyState.tsx";
import MapHeader from "./features/map/components/MapHeader.tsx";
import MapStatus from "./features/map/components/MapStatus.tsx";
import VesselDetailCard from "./features/map/components/VesselDetailCard.tsx";
import VesselSearch from "./features/map/components/VesselSearch.tsx";
import { useActivityLog } from "./features/map/hooks/useActivityLog.ts";
import { useCommandMenu } from "./features/map/hooks/useCommandMenu.ts";
import { useVesselSnapshot } from "./features/map/hooks/useVesselSnapshot.ts";
import { useVesselTrack } from "./features/map/hooks/useVesselTrack.ts";
import { DATA_STATE_COPY } from "./features/map/constants.ts";
import { getEmptyState } from "./features/map/utils.ts";
import VesselMap from "./features/map/components/VesselMap.tsx";
import type { Command, MapControls } from "./types.ts";

export default function MapPage() {
  const [vesselSearchQuery, setVesselSearchQuery] = useState("");
  const [vesselSearchError, setVesselSearchError] = useState("");
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const mapControlsRef = useRef<MapControls | null>(null);

  const { addActivity, clearActivityLog, logs } = useActivityLog();
  const { dataState, lastUpdateAt, refreshSnapshot, snapshotCount, vessels } =
    useVesselSnapshot({ addActivity });
  const {
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
  } = useVesselTrack({ addActivity, vessels });

  const handleMapReady = useCallback(
    (controls: MapControls): void => {
      mapControlsRef.current = controls;

      if (trackState.status === "ready" && trackState.points > 0) {
        controls.fitTrack(trackState.data);
      }
    },
    [trackState.data, trackState.points, trackState.status],
  );

  const handleVesselSelect = useCallback(
    (mmsi: string | number): void => {
      if (!selectVessel(mmsi)) {
        return;
      }

      const key = String(mmsi);
      setVesselSearchQuery(key);
      setVesselSearchError("");
    },
    [selectVessel],
  );

  const handleVesselSearchChange = useCallback(
    (value: string): void => {
      setVesselSearchQuery(value);
      if (vesselSearchError) {
        setVesselSearchError("");
      }
    },
    [vesselSearchError],
  );

  const handleVesselSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const query = vesselSearchQuery.trim();

      if (!query) {
        setVesselSearchError("Enter an MMSI to search.");
        return;
      }

      if (!/^\d+$/.test(query)) {
        setVesselSearchError("MMSI must contain digits only.");
        return;
      }

      const vessel = vessels.find((record) => String(record.mmsi) === query);
      if (!vessel) {
        setVesselSearchError(`No tracked vessel found for MMSI ${query}.`);
        return;
      }

      handleVesselSelect(vessel.mmsi);
    },
    [handleVesselSelect, vesselSearchQuery, vessels],
  );

  const fitAllVessels = useCallback((): void => {
    if (!mapControlsRef.current) {
      addActivity(
        "info",
        "Map still loading",
        "Fit all vessels will be available when the map is ready.",
      );
    } else if (!mapControlsRef.current.fitAllVessels()) {
      addActivity(
        "warning",
        "Map unchanged",
        "There are no vessel positions to fit.",
      );
    }
  }, [addActivity]);

  const handleManualRefresh = useCallback((): void => {
    void refreshSnapshot({ isManual: true });
  }, [refreshSnapshot]);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "refresh-snapshot",
        label: "Refresh vessel data",
        detail: "Load a fresh vessel snapshot from the database",
        icon: "refresh",
        run: handleManualRefresh,
      },
      {
        id: "fit-vessels",
        label: "Fit all vessels",
        detail: "Frame every current position on the map",
        icon: "locate",
        disabled: vessels.length === 0,
        run: fitAllVessels,
      },
      {
        id: "clear-track",
        label: "Clear selected track",
        detail: "Remove the active vessel selection and route",
        icon: "route",
        disabled: !selectedMmsi,
        run: clearSelectedVessel,
      },
      {
        id: "activity",
        label: "Open activity log",
        detail: "Review worker, database, and map events",
        icon: "activity",
        run: () => setIsActivityOpen(true),
      },
      {
        id: "clear-activity",
        label: "Clear activity log",
        detail: "Remove the current diagnostics history",
        icon: "trash",
        run: clearActivityLog,
      },
    ],
    [
      clearActivityLog,
      clearSelectedVessel,
      fitAllVessels,
      handleManualRefresh,
      selectedMmsi,
      vessels.length,
    ],
  );
  const {
    activeIndex: activeCommandIndex,
    close: closeCommandMenu,
    filteredCommands,
    inputRef: commandInputRef,
    isOpen: isCommandMenuOpen,
    open: openCommandMenu,
    query: commandQuery,
    setQuery: setCommandQuery,
  } = useCommandMenu(commands);

  useEffect(() => {
    mapControlsRef.current?.replaceVessels(vessels);
  }, [vessels]);

  useEffect(() => {
    if (trackState.status === "ready" && trackState.points > 0) {
      mapControlsRef.current?.fitTrack(trackState.data);
    }
  }, [trackState.data, trackState.points, trackState.status]);

  const emptyState = getEmptyState(dataState);
  const statusCopy = DATA_STATE_COPY[dataState];

  return (
    <div className="map-app">
      <MapHeader
        onOpenCommands={openCommandMenu}
        statusCopy={statusCopy}
        statusState={dataState}
      />

      <main className="map-main" id="map">
        <VesselMap
          vessels={vessels}
          selectedMmsi={selectedMmsi}
          trackGeoJson={trackState.data}
          playbackPosition={playbackPosition}
          onMapReady={handleMapReady}
          onVesselClick={handleVesselSelect}
        />

        <VesselSearch
          error={vesselSearchError}
          onChange={handleVesselSearchChange}
          onSubmit={handleVesselSearchSubmit}
          query={vesselSearchQuery}
          vesselCount={vessels.length}
        />

        <div className="map-panels">
          <VesselDetailCard
            isTrackPlaying={isTrackPlaying}
            onClear={clearSelectedVessel}
            onPauseTrack={pauseTrack}
            onPlayTrack={playTrack}
            onSeekTrack={seekTrack}
            playbackIndex={playbackIndex}
            playbackPosition={playbackPosition}
            selected={selectedVessel}
            trackState={trackState}
          />
        </div>

        {vessels.length === 0 && (
          <MapEmptyState
            emptyState={emptyState}
            onRefresh={handleManualRefresh}
          />
        )}

        <MapStatus
          connectionState={dataState}
          lastUpdateAt={lastUpdateAt}
          snapshotCount={snapshotCount}
          vesselCount={vessels.length}
        />

        {isActivityOpen && (
          <ActivityDrawer
            logs={logs}
            onClear={clearActivityLog}
            onClose={() => setIsActivityOpen(false)}
          />
        )}
      </main>

      {isCommandMenuOpen && (
        <CommandMenu
          activeIndex={activeCommandIndex}
          commands={filteredCommands}
          inputRef={commandInputRef}
          onClose={closeCommandMenu}
          onQueryChange={setCommandQuery}
          query={commandQuery}
        />
      )}
    </div>
  );
}
