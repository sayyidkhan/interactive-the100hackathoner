import { WorldRegistry } from "./engine/world";
import { renderDevDiscoveries } from "./ui/devDiscoveries";
import { SHAWN_WORLD } from "./worlds/shawn";
import { KAIRUI_WORLD } from "./worlds/kairui";

const worldRegistry = new WorldRegistry()
  .register(SHAWN_WORLD)
  .register(KAIRUI_WORLD);

export function mountApplication(root: HTMLElement, pathname = window.location.pathname): void {
  if (pathname === "/dev/discoveries") {
    renderDevDiscoveries(root);
    return;
  }

  const resolved = worldRegistry.resolve(pathname);
  if (!resolved) {
    renderNotFound(root, pathname);
    return;
  }

  document.title = `${resolved.world.name} · The 100 Hackathoner`;
  resolved.world.mount(root, { route: resolved.route });
}

export function getWorldRegistry(): WorldRegistry {
  return worldRegistry;
}

function renderNotFound(root: HTMLElement, pathname: string): void {
  root.className = "app-error";
  root.innerHTML = `
    <main>
      <p>Unknown kingdom route.</p>
      <pre>${escapeHtml(pathname)}</pre>
      <p><a href="/">Return to Shawn Kingdom</a></p>
    </main>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}
