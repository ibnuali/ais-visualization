import type {
  WorkerAction,
  WorkerControl,
  WorkerSummary,
} from "../../../types.ts";
import { formatTimestamp } from "../utils.ts";

interface WorkerControlPanelProps {
  controlToken: string;
  error: string;
  isControlConfigured: boolean;
  isSubmitting: boolean;
  onAction: (action: WorkerAction) => void | Promise<void>;
  onTokenChange: (value: string) => void;
  summary: WorkerSummary;
  worker: WorkerControl | null;
}

export default function WorkerControlPanel({
  controlToken,
  error,
  isControlConfigured,
  isSubmitting,
  onAction,
  onTokenChange,
  summary,
  worker,
}: WorkerControlPanelProps) {
  return (
    <section
      className="panel configuration-panel worker-control-panel"
      aria-labelledby="worker-control-title"
    >
      <div className="panel-header">
        <div>
          <span className="panel-kicker">CONTROL / INGESTION</span>
          <h2 id="worker-control-title">AIS stream worker</h2>
        </div>
        <span className={`status-chip status-chip--${summary.tone}`}>
          {summary.label}
        </span>
      </div>

      <div className="worker-control-panel__body">
        <div className="worker-summary" aria-live="polite">
          <span
            className={`status-dot status-dot--${summary.tone}`}
            aria-hidden="true"
          />
          <p>{summary.detail}</p>
        </div>

        <dl className="worker-details">
          <div>
            <dt>Requested state</dt>
            <dd>{worker?.is_enabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Worker heartbeat</dt>
            <dd>{formatTimestamp(worker?.last_heartbeat)}</dd>
          </div>
          <div>
            <dt>Last control change</dt>
            <dd>{formatTimestamp(worker?.updated_at)}</dd>
          </div>
        </dl>

        {!isControlConfigured && worker && (
          <p className="worker-notice worker-notice--error">
            Set <code>WORKER_CONTROL_TOKEN</code> on the API to enable start and
            stop controls.
          </p>
        )}

        <div className={`field ${error ? "field--error" : ""}`}>
          <label htmlFor="worker-control-token">Worker control token</label>
          <div className="input-shell">
            <input
              aria-describedby="worker-control-token-help"
              aria-invalid={Boolean(error)}
              autoComplete="current-password"
              disabled={!isControlConfigured || isSubmitting}
              id="worker-control-token"
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder="Enter token to manage ingestion"
              spellCheck="false"
              type="password"
              value={controlToken}
            />
          </div>
          <p
            className={`field-help ${error ? "field-help--error" : ""}`}
            id="worker-control-token-help"
            aria-live="polite"
          >
            {error ||
              "Used only for this request. It is never saved in the browser."}
          </p>
        </div>

        <div className="form-actions">
          <button
            className="button button--primary"
            disabled={
              !isControlConfigured ||
              isSubmitting ||
              worker?.is_enabled === true
            }
            onClick={() => void onAction("start")}
            type="button"
          >
            {isSubmitting ? "Updating…" : "Start ingestion"}
          </button>
          <button
            className="button button--quiet"
            disabled={
              !isControlConfigured ||
              isSubmitting ||
              worker?.is_enabled !== true
            }
            onClick={() => void onAction("stop")}
            type="button"
          >
            Stop ingestion
          </button>
        </div>
      </div>
    </section>
  );
}
