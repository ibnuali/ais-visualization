import type { DataState } from "../../../types.ts";
import { formatTimestamp } from "../utils.ts";
import StatusDot from "./StatusDot.tsx";

interface MapStatusProps {
    connectionState: DataState;
    lastUpdateAt: string | null;
    snapshotCount: number;
    vesselCount: number;
}

export default function MapStatus({
    connectionState,
    lastUpdateAt,
    snapshotCount,
    vesselCount,
}: MapStatusProps) {
    return (
        <div className="map-status" aria-live="polite">
            <div className="map-status__headline">
                <StatusDot state={connectionState} />
                <strong>{vesselCount.toLocaleString()} vessels tracked</strong>
            </div>
            <div className="map-status__metrics">
                <span>{snapshotCount.toLocaleString()} refreshes</span>
                <span>Database snapshot</span>
                <span>Last {formatTimestamp(lastUpdateAt)}</span>
            </div>
        </div>
    );
}
