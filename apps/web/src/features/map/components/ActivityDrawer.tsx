import type { ActivityEvent } from "../../../types.ts";
import { formatTimestamp } from "../utils.ts";
import Icon from "./Icon.tsx";

interface ActivityDrawerProps {
  logs: ActivityEvent[];
  onClear: () => void;
  onClose: () => void;
}

export default function ActivityDrawer({
  logs,
  onClear,
  onClose,
}: ActivityDrawerProps) {
  return (
    <aside className="activity-drawer" aria-labelledby="activity-drawer-title">
      <div className="activity-drawer__header">
        <div>
          <span className="panel-kicker">DIAGNOSTICS</span>
          <h2 id="activity-drawer-title">Activity</h2>
        </div>
        <div className="activity-drawer__actions">
          <span className="activity-count">{logs.length} events</span>
          <button
            className="panel-close"
            aria-label="Close activity"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className="activity-drawer__toolbar">
        <span>Worker, database, and map events</span>
        <button className="text-button" onClick={onClear} type="button">
          <Icon name="trash" size={14} />
          Clear
        </button>
      </div>
      <ol className="activity-list">
        {logs.map((entry) => (
          <li className="activity-entry" data-tone={entry.type} key={entry.id}>
            <span className="activity-marker" aria-hidden="true" />
            <div>
              <div className="activity-entry__heading">
                <span className="activity-type">{entry.type}</span>
                <strong>{entry.title}</strong>
                <time dateTime={entry.timestamp}>
                  {formatTimestamp(entry.timestamp)}
                </time>
              </div>
              <p>{entry.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
