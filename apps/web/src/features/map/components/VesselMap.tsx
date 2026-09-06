import "maplibre-gl/dist/maplibre-gl.css";
import type {
  MapControls,
  PlaybackPosition,
  TrackFeature,
  VesselRecord,
} from "../../../types.ts";
import { useVesselMap } from "../hooks/useVesselMap.ts";

interface VesselMapProps {
  vessels?: VesselRecord[];
  selectedMmsi?: string | number | null;
  trackGeoJson: TrackFeature | null;
  playbackPosition: PlaybackPosition | null;
  onVesselClick?: (mmsi: string) => void;
  onMapReady?: (controls: MapControls) => void;
}

export default function VesselMap({
  vessels = [],
  selectedMmsi,
  trackGeoJson,
  playbackPosition,
  onVesselClick,
  onMapReady,
}: VesselMapProps) {
  const containerRef = useVesselMap({
    vessels,
    selectedMmsi,
    trackGeoJson,
    playbackPosition,
    onVesselClick,
    onMapReady,
  });

  return <div ref={containerRef} className="vessel-map" />;
}
