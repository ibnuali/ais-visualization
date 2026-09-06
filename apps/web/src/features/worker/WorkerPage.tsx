import WorkerControlPanel from "./components/WorkerControlPanel.tsx";
import WorkerHeader from "./components/WorkerHeader.tsx";
import WorkerIntro from "./components/WorkerIntro.tsx";
import { useWorkerControl } from "./hooks/useWorkerControl.ts";
import { getWorkerSummary } from "./utils.ts";

export default function WorkerPage() {
  const {
    activityByWorker,
    controlToken,
    error,
    isControlConfigured,
    isSubmitting,
    sendWorkerAction,
    setControlToken,
    workers,
  } = useWorkerControl();

  return (
    <div className="app-shell worker-page">
      <WorkerHeader />

      <main className="workspace">
        <WorkerIntro />

        <section
          className="workbench-grid worker-grid"
          aria-label="Worker management"
        >
          {workers?.map((worker) => (
            <WorkerControlPanel
              key={worker.worker_id}
              activities={activityByWorker[worker.worker_id] ?? []}
              controlToken={controlToken}
              error={error}
              isControlConfigured={isControlConfigured}
              isSubmitting={isSubmitting}
              onAction={sendWorkerAction}
              onTokenChange={setControlToken}
              summary={getWorkerSummary(worker)}
              worker={worker}
            />
          ))}
          {!workers && (
            <p
              className={`worker-notice ${error ? "worker-notice--error" : ""}`}
              aria-live="polite"
            >
              {error || "Loading regional worker status…"}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
