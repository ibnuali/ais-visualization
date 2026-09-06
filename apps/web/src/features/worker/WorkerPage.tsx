import WorkerControlPanel from "./components/WorkerControlPanel.tsx";
import WorkerHeader from "./components/WorkerHeader.tsx";
import WorkerIntro from "./components/WorkerIntro.tsx";
import { useWorkerControl } from "./hooks/useWorkerControl.ts";
import { getWorkerSummary } from "./utils.ts";

export default function WorkerPage() {
  const {
    controlToken,
    error,
    isControlConfigured,
    isSubmitting,
    sendWorkerAction,
    setControlToken,
    worker,
  } = useWorkerControl();
  const summary = getWorkerSummary(worker);

  return (
    <div className="app-shell worker-page">
      <WorkerHeader />

      <main className="workspace">
        <WorkerIntro />

        <section className="workbench-grid" aria-label="Worker management">
          <WorkerControlPanel
            controlToken={controlToken}
            error={error}
            isControlConfigured={isControlConfigured}
            isSubmitting={isSubmitting}
            onAction={sendWorkerAction}
            onTokenChange={setControlToken}
            summary={summary}
            worker={worker}
          />
        </section>
      </main>
    </div>
  );
}
