import React from "react";
import ReactDOM from "react-dom/client";
import { SessionProvider } from "./app/SessionProvider";
import { Router } from "./app/router";
import "./styles/index.css";
import "./styles/tokens.css";
import { AppShell } from "./app/AppShell";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionProvider>
      <AppShell>
        <Router />
      </AppShell>
    </SessionProvider>
  </React.StrictMode>,
);
