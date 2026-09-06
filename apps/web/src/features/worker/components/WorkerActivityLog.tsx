import type { ActivityEvent } from "../../../types.ts";
import { formatTimestamp } from "../utils.ts";

interface WorkerActivityLogProps {
  activities: readonly ActivityEvent[];
  workerId: string;
}

export default function WorkerActivityLog({
  activities,
  workerId,
}: WorkerActivityLogProps) {
  const titleId = `worker-activity-title-${workerId}`;

  return (
    <section className="worker-activity" aria-labelledby={titleId}>
      <div className="worker-activity__header">
        <div>
          <span className="panel-kicker">LIVE AIS DATA</span>
          <h3 id={titleId}>Vessel activity</h3>
        </div>
        <span className="worker-activity__count">
          {activities.length} {activities.length === 1 ? "event" : "events"}
        </span>
      </div>

      <ol className="activity-list worker-activity__list" aria-live="polite">
        {activities.map((activity) => (
          <li
            className="activity-entry"
            data-tone={activity.type}
            key={activity.id}
          >
            <span className="activity-marker" aria-hidden="true" />
            <div>
              <div className="activity-entry__heading">
                <span className="activity-type">{activity.type}</span>
                <strong>{activity.title}</strong>
                <time dateTime={activity.timestamp}>
                  {formatTimestamp(activity.timestamp)}
                </time>
              </div>
              <p>{activity.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
