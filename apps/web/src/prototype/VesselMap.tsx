import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coordinate, MockVessel } from "../types.ts";

interface VesselFeatureProperties {
  mmsi: number;
  heading: number;
  ship_name: string;
  sog: number;
  nav_status: string;
}

type VesselFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: Coordinate;
  };
  properties: VesselFeatureProperties;
};

type VesselFeatureCollection = {
  type: "FeatureCollection";
  features: VesselFeature[];
};

type TrackFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: Coordinate[];
  };
  properties: Record<string, never>;
};

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const VESSEL_ICON = `
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/>
  </svg>
`;

function getGeoJsonSource(
  map: MapLibreMap,
  sourceId: string,
): GeoJSONSource | null {
  const source = map.getSource(sourceId);
  return source instanceof GeoJSONSource ? source : null;
}

function useMap(
  containerRef: RefObject<HTMLDivElement | null>,
): MapLibreMap | null {
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const nextMap = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [111.0, -5.5],
      zoom: 6,
      attributionControl: {},
    });

    nextMap.on("load", () => {
      const image = new Image();
      image.onload = () => {
        if (!nextMap.hasImage("vessel")) {
          nextMap.addImage("vessel", image);
        }
      };
      image.src = `data:image/svg+xml;base64,${btoa(VESSEL_ICON)}`;
    });

    setMap(nextMap);

    return () => {
      nextMap.remove();
      setMap(null);
    };
  }, [containerRef]);

  return map;
}

function updateVesselSource(
  map: MapLibreMap,
  vessels: readonly MockVessel[],
): void {
  const source = getGeoJsonSource(map, "vessels");
  if (!source) {
    return;
  }

  const features: VesselFeature[] = vessels.map((vessel) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [vessel.longitude, vessel.latitude],
    },
    properties: {
      mmsi: vessel.mmsi,
      heading: vessel.heading,
      ship_name: vessel.ship_name,
      sog: vessel.sog,
      nav_status: vessel.nav_status,
    },
  }));

  const data: VesselFeatureCollection = {
    type: "FeatureCollection",
    features,
  };
  void source.setData(data);
}

function drawTrack(map: MapLibreMap, vessel: MockVessel): void {
  if (map.getLayer("vessel-track")) {
    map.removeLayer("vessel-track");
  }
  if (map.getSource("vessel-track")) {
    map.removeSource("vessel-track");
  }

  const steps = 20;
  const coordinates: Coordinate[] = [];
  for (let index = steps; index >= 0; index -= 1) {
    const offset = index * 0.01;
    const angle = (vessel.heading * Math.PI) / 180;
    coordinates.push([
      vessel.longitude - Math.cos(angle) * offset,
      vessel.latitude - Math.sin(angle) * offset,
    ]);
  }

  const track: TrackFeature = {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {},
  };

  map.addSource("vessel-track", {
    type: "geojson",
    data: track,
  });

  map.addLayer({
    id: "vessel-track",
    type: "line",
    source: "vessel-track",
    paint: {
      "line-color": "#3498db",
      "line-width": 3,
      "line-dasharray": [2, 1],
    },
  });
}

function setupVesselLayer(
  map: MapLibreMap,
  vessels: readonly MockVessel[],
  onVesselClick: (mmsi: number) => void,
): void {
  map.addSource("vessels", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  map.addLayer({
    id: "vessels",
    type: "symbol",
    source: "vessels",
    layout: {
      "icon-image": "vessel",
      "icon-rotate": ["get", "heading"],
      "icon-rotation-alignment": "map",
      "icon-size": 0.8,
    },
  });
  updateVesselSource(map, vessels);

  map.on("click", "vessels", (event: MapLayerMouseEvent) => {
    const mmsi = event.features?.[0]?.properties?.mmsi;
    if (mmsi !== undefined) {
      onVesselClick(Number(mmsi));
    }
  });

  map.on("mouseenter", "vessels", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "vessels", () => {
    map.getCanvas().style.cursor = "";
  });
}

interface VesselMapProps {
  vessels: MockVessel[];
  selectedMmsi: number | null;
  onVesselClick: (mmsi: number | null) => void;
}

export function VesselMap({
  vessels,
  selectedMmsi,
  onVesselClick,
}: VesselMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const map = useMap(containerRef);
  const [ready, setReady] = useState(false);
  const vesselsRef = useRef(vessels);
  const onVesselClickRef = useRef(onVesselClick);

  vesselsRef.current = vessels;
  onVesselClickRef.current = onVesselClick;

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const onLoad = (): void => {
      if (!map.getLayer("vessels")) {
        setupVesselLayer(map, vesselsRef.current, (mmsi) => {
          onVesselClickRef.current(mmsi);
        });
      }
      setReady(true);
    };

    if (map.getLayer("vessels")) {
      onLoad();
    } else {
      map.once("load", onLoad);
    }

    return () => {
      map.off("load", onLoad);
      setReady(false);
    };
  }, [map]);

  useEffect(() => {
    if (ready && map) {
      updateVesselSource(map, vessels);
    }
  }, [map, vessels, ready]);

  useEffect(() => {
    if (!ready || !selectedMmsi || !map) {
      return;
    }
    const vessel = vessels.find((candidate) => candidate.mmsi === selectedMmsi);
    if (vessel) {
      drawTrack(map, vessel);
    }
  }, [map, selectedMmsi, vessels, ready]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

export { OSM_STYLE };
export default VesselMap;
