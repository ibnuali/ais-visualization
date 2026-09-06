import type { StyleSpecification } from "maplibre-gl";
import type { Coordinate } from "../../types.ts";

export const DEFAULT_MAP_VIEW: { center: Coordinate; zoom: number } = {
    center: [111, -5.5],
    zoom: 6,
};

export const VESSEL_DETAIL_ZOOM = 8;
export const MIN_VESSEL_UPDATE_DISTANCE_PX = 1.5;
export const MIN_VESSEL_HEADING_CHANGE_DEGREES = 5;

export const MAP_SOURCE_IDS = {
    vessels: "vessels",
    track: "vessel-track",
    playback: "vessel-playback",
} as const;

export const MAP_LAYER_IDS = {
    track: "vessel-track",
    overview: "vessel-overview",
    selection: "vessel-selection",
    vessels: "vessels",
    playbackHalo: "vessel-playback-halo",
    playbackPoint: "vessel-playback-point",
} as const;

export const VESSEL_INTERACTION_LAYERS = [
    MAP_LAYER_IDS.overview,
    MAP_LAYER_IDS.vessels,
];

const VESSEL_ICON_SVG = `
  <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2 21 23l-7-4-7 4L14 2Z" fill="#e34d61" stroke="#ffffff" stroke-width="1.5"/>
  </svg>
`;

export const VESSEL_ICON_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VESSEL_ICON_SVG)}`;

export const OSM_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
        },
    },
    layers: [
        {
            id: "osm",
            type: "raster",
            source: "osm",
        },
    ],
};
