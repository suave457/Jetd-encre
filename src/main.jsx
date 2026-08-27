import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { DemoProvider } from "./demoStore.jsx";
import "./styles.css";
import "./pen-aligned-pages.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DemoProvider>
      <App />
    </DemoProvider>
  </React.StrictMode>,
);
