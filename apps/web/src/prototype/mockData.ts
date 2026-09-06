import type { MockVessel, TrackPoint } from "../types.ts";

const SHIP_NAMES = [
  "MV Baruna",
  "MV Sentosa",
  "MV Makmur",
  "MV Bahari",
  "MV Samudra",
  "MV Lautan",
  "MV Nelayan",
  "MV Perawan",
  "MV Garuda",
  "MV Nusantara",
  "MV Pelita",
  "MV Cendrawasih",
  "MV Komodo",
  "MV Merapi",
  "MV Krakatau",
] as const;

const VESSEL_COUNT = 15;
const BASE_LAT = -5.5;
const BASE_LON = 111.0;

function randomHeading(): number {
  return Math.floor(Math.random() * 360);
}

function randomPosition(): TrackPoint {
  return {
    latitude: BASE_LAT + (Math.random() - 0.5) * 3,
    longitude: BASE_LON + (Math.random() - 0.5) * 6,
  };
}

export function generateMockVessels(): MockVessel[] {
  const vessels: MockVessel[] = [];
  for (let index = 0; index < VESSEL_COUNT; index += 1) {
    const position = randomPosition();
    vessels.push({
      mmsi: 525000000 + index,
      ship_name: SHIP_NAMES[index % SHIP_NAMES.length],
      latitude: position.latitude,
      longitude: position.longitude,
      heading: randomHeading(),
      sog: Math.random() * 15 + 2,
      cog: Math.random() * 360,
      vessel_class: Math.random() > 0.5 ? "A" : "B",
      nav_status: ["Under way using engine", "At anchor", "Moored"][index % 3],
    });
  }
  return vessels;
}

export function generateMockTrack(vessel: MockVessel): TrackPoint[] {
  const points: TrackPoint[] = [];
  const steps = 20;
  for (let index = steps; index >= 0; index -= 1) {
    const offset = index * 0.01;
    const angle = (vessel.heading * Math.PI) / 180;
    points.push({
      latitude: vessel.latitude - Math.sin(angle) * offset * index,
      longitude: vessel.longitude - Math.cos(angle) * offset * index,
    });
  }
  return points;
}

export function tickVessels(vessels: readonly MockVessel[]): MockVessel[] {
  return vessels.map((vessel) => {
    const radians = (vessel.heading * Math.PI) / 180;
    const speed = vessel.sog * 0.00005;
    return {
      ...vessel,
      latitude: vessel.latitude + Math.cos(radians) * speed,
      longitude: vessel.longitude + Math.sin(radians) * speed,
    };
  });
}
