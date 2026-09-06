import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import type { MapLayerMouseEvent } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type {
  MapControls,
  PlaybackPosition,
  TrackFeature,
  VesselRecord,
} from "../../../types.ts";
import {
  DEFAULT_MAP_VIEW,
  OSM_STYLE,
  VESSEL_ICON_URL,
  VESSEL_INTERACTION_LAYERS,
} from "../vesselMapConfig.ts";
import {
  createVesselMapController,
  type VesselMapController,
} from "../vesselMapController.ts";

setWorkerUrl(maplibreWorkerUrl);

interface UseVesselMapOptions {
  vessels: VesselRecord[];
  selectedMmsi?: string | number | null;
  trackGeoJson: TrackFeature | null;
  playbackPosition: PlaybackPosition | null;
  onVesselClick?: (mmsi: string) => void;
  onMapReady?: (controls: MapControls) => void;
}

export function useVesselMap({
  vessels,
  selectedMmsi,
  trackGeoJson,
  playbackPosition,
  onVesselClick,
  onMapReady,
}: UseVesselMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<VesselMapController | null>(null);
  const vesselsRef = useRef(vessels);
  const onVesselClickRef = useRef<((mmsi: string) => void) | undefined>(
    onVesselClick,
  );
  const onMapReadyRef = useRef<((controls: MapControls) => void) | undefined>(
    onMapReady,
  );
  const [isReady, setIsReady] = useState(false);

  vesselsRef.current = vessels;
  onVesselClickRef.current = onVesselClick;
  onMapReadyRef.current = onMapReady;

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: DEFAULT_MAP_VIEW.center,
      zoom: DEFAULT_MAP_VIEW.zoom,
      attributionControl: {},
      maxTileCacheSize: 64,
      maxTileCacheZoomLevels: 1,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    const handleVesselClick = (event: MapLayerMouseEvent): void => {
      const feature = event.features?.[0];
      if (feature?.properties?.mmsi !== undefined) {
        onVesselClickRef.current?.(String(feature.properties.mmsi));
      }
    };

    const handleMouseEnter = (): void => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = (): void => {
      map.getCanvas().style.cursor = "";
    };

    const handleMoveEnd = (): void => {
      controllerRef.current?.replaceVessels(vesselsRef.current);
    };

    const handleLoad = (): void => {
      const image = new Image();
      image.onload = () => {
        if (mapRef.current !== map) {
          return;
        }

        if (!map.hasImage("vessel")) {
          map.addImage("vessel", image, { pixelRatio: 2 });
        }

        const controller = createVesselMapController(map);
        controller.initialize(vesselsRef.current);
        controllerRef.current = controller;

        map.on("click", VESSEL_INTERACTION_LAYERS, handleVesselClick);
        map.on("mouseenter", VESSEL_INTERACTION_LAYERS, handleMouseEnter);
        map.on("mouseleave", VESSEL_INTERACTION_LAYERS, handleMouseLeave);
        map.on("moveend", handleMoveEnd);
        setIsReady(true);
        onMapReadyRef.current?.({
          fitAllVessels: () => controller.fitAllVessels(vesselsRef.current),
          fitTrack: controller.fitTrack,
          replaceVessels: controller.replaceVessels,
          updateVessels: controller.updateVessels,
        });
      };
      image.src = VESSEL_ICON_URL;
    };

    map.once("load", handleLoad);

    return () => {
      map.off("click", VESSEL_INTERACTION_LAYERS, handleVesselClick);
      map.off("mouseenter", VESSEL_INTERACTION_LAYERS, handleMouseEnter);
      map.off("mouseleave", VESSEL_INTERACTION_LAYERS, handleMouseLeave);
      map.off("moveend", handleMoveEnd);
      controllerRef.current?.dispose();
      map.remove();
      mapRef.current = null;
      controllerRef.current = null;
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    controllerRef.current?.setSelectedMmsi(selectedMmsi);
  }, [isReady, selectedMmsi]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    controllerRef.current?.setTrack(trackGeoJson);
  }, [isReady, trackGeoJson]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    controllerRef.current?.setPlayback(playbackPosition);
  }, [isReady, playbackPosition]);

  return containerRef;
}
