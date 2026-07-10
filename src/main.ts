import { initLoopTown } from "./world/loopTown";
import { renderDevDiscoveries } from "./ui/devDiscoveries";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

try {
  if (window.location.pathname === "/dev/discoveries") {
    renderDevDiscoveries(root);
  } else {
    initLoopTown(root);
  }
} catch (error) {
  root.className = "app-error";
  root.innerHTML = `
    <main>
      <p>Runtime initialization failed.</p>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </main>
  `;
  throw error;
}
