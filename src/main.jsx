import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <div className="brand-mark">p</div>
          <h1>Let’s get you back on track.</h1>
          <p>
            Momentum hit an unexpected problem. Your saved work has not been
            deleted.
          </p>
          <button onClick={() => location.reload()}>Reload Momentum</button>
          <p>
            If this continues, visit <a href="./support.html">support</a>.
          </p>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
}
