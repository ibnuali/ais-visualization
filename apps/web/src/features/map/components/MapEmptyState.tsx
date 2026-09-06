import type { EmptyState } from "../../../types.ts";
import Icon from "./Icon.tsx";

interface MapEmptyStateProps {
  emptyState: EmptyState;
  onRefresh: () => void;
}

export default function MapEmptyState({
  emptyState,
  onRefresh,
}: MapEmptyStateProps) {
  return (
    <div className="map-empty-state">
      <span className="panel-kicker">{emptyState.kicker}</span>
      <h1>{emptyState.title}</h1>
      <p>{emptyState.detail}</p>
      <button
        className="map-empty-state__action"
        onClick={onRefresh}
        type="button"
      >
        <Icon name="refresh" size={15} />
        Refresh vessel data
      </button>
    </div>
  );
}
