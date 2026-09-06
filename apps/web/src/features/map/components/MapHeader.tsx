import type { DataState, StatusCopy } from "../../../types.ts";
import Icon from "./Icon.tsx";
import StatusDot from "./StatusDot.tsx";

interface MapHeaderProps {
  onOpenCommands: () => void;
  statusCopy: StatusCopy;
  statusState: DataState;
}

export default function MapHeader({
  onOpenCommands,
  statusCopy,
  statusState,
}: MapHeaderProps) {
  return (
    <header className="map-topbar">
      <div className="map-topbar__inner">
        <a
          className="map-brand"
          href="#map"
          aria-label="AIS anomaly database map"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">ais anomaly</span>
          <span className="brand-divider" aria-hidden="true">
            /
          </span>
          <span className="brand-context">database map</span>
        </a>

        <div className="map-topbar__tools">
          <a className="map-worker-link" href="/worker">
            Worker
          </a>
          <span className="topbar-status" title={statusCopy.detail}>
            <StatusDot state={statusState} />
            <span>{statusCopy.label}</span>
          </span>
          <button
            aria-label="Open command menu"
            className="command-trigger"
            onClick={onOpenCommands}
            type="button"
          >
            <Icon name="command" size={15} />
            <span>Commands</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
