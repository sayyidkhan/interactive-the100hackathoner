import { WorldRegistry } from "./engine/world";
import { renderDevDiscoveries } from "./ui/devDiscoveries";
import { SHAWN_WORLD } from "./worlds/shawn";
import { KAIRUI_WORLD } from "./worlds/kairui";
import { UNIFIED_WORLD } from "./worlds/unified";

const worldRegistry = new WorldRegistry()
  .register(SHAWN_WORLD)
  .register(KAIRUI_WORLD)
  .register(UNIFIED_WORLD);

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

  const isArchive = resolved.world.id === "unified";
  document.documentElement.classList.toggle("operator-archive-page", isArchive);
  document.body.classList.toggle("operator-archive-page", isArchive);

  document.title = `${resolved.world.name} · The 100 Hackathoner`;
  resolved.world.mount(root, { route: resolved.route });
  if (resolved.world.id === "shawn" && resolved.route.mode === "explore") {
    mountKingdomTravelDock(root);
  }
}

function mountKingdomTravelDock(root: HTMLElement): void {
  const nav = document.createElement("nav");
  nav.className = "kingdom-travel-dock";
  nav.setAttribute("aria-label", "Island travel");
  nav.innerHTML = `
    <a href="/worlds/shawn" aria-current="page">Village</a>
    <a href="/worlds/kairui">Beach</a>
    <a href="/kingdoms">Portal</a>
  `;
  root.appendChild(nav);
}

export function getWorldRegistry(): WorldRegistry {
  return worldRegistry;
}

function renderNotFound(root: HTMLElement, pathname: string): void {
  root.className = "app-error";
  root.innerHTML = `
    <main>
      <p>Unknown island route.</p>
      <pre>${escapeHtml(pathname)}</pre>
      <p><a href="/">Return to the archive</a></p>
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
