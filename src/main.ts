import { mountApplication } from "./app";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

try {
  mountApplication(root);
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
