import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { DemoProvider } from "./demoStore.jsx";
import { AppErrorBoundary } from "./AppErrorBoundary.jsx";
import { applyAccessibilityPreferences, readAccessibilityPreferences } from "./accessibilityPreferences.js";
import "./styles.css";
import "./pen-aligned-pages.css";
import "./launch-preparation.css";

applyAccessibilityPreferences(readAccessibilityPreferences());

const PilotApp = lazy(() => import("./features/pilote/PilotApp.jsx"));
const AccessAdmin = lazy(() => import('./features/pilote/AccessAdmin.jsx'));
function ApplicationRoot() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => { const update = () => setPath(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  if (path === "/pilote" || path === "/pilote/") return <Suspense fallback={<p role="status">Chargement du pilote…</p>}><PilotApp /></Suspense>;
  if (path === '/admin/ecoles-acces') return <Suspense fallback={<p role="status">Chargement de l’administration…</p>}><AccessAdmin /></Suspense>;
  return <DemoProvider><App /></DemoProvider>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
    <ApplicationRoot />
    </AppErrorBoundary>
  </React.StrictMode>,
);
