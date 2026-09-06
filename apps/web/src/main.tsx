import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import AuthGate from "./features/auth/AuthGate.tsx";
import WorkerPage from "./WorkerPage.tsx";
import MapPrototype from "./prototype/MapPrototype.tsx";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const isPrototype = params.get("prototype") === "map";
const isWorkerPage = window.location.pathname === "/worker";
let Page = App;

if (isPrototype) {
  Page = MapPrototype;
} else if (isWorkerPage) {
  Page = WorkerPage;
}

const rootElement = document.querySelector<HTMLElement>("#root");
if (!rootElement) {
  throw new Error("The application root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      <Page />
    </AuthGate>
  </StrictMode>,
);
