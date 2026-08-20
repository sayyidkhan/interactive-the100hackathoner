import type { WorldDefinition } from "../../engine/world";
import { loadKingdomProgress, saveKingdomProgress } from "../../engine/progress";
import { loadDiscovered } from "../../systems/storage";
import { loadTownSchemaDraft } from "../../data/townSchema";
import { DISCOVERIES } from "../../data/discoveries";
import { COASTAL_LANDMARKS } from "../kairui/content";

export const UNIFIED_WORLD: WorldDefinition = {
  id: "unified",
  name: "The 100 Hackathoner",
  description: "A single operator journey, expressed through two evolving editions.",
  routes: [
    { path: "/", mode: "explore" },
    { path: "/kingdoms", mode: "explore" },
    { path: "/worlds/unified", mode: "explore" }
  ],
  mount(root) {
    mountKingdomHub(root);
  }
};

export function mountKingdomHub(root: HTMLElement): void {
  root.className = "kingdom-hub-root";
  root.dataset.world = "unified";
  root.dataset.worldMode = "explore";

  const progress = loadKingdomProgress();
  progress.lastWorld = "unified";
  const town = loadTownSchemaDraft();
  const villageDiscoveries = loadDiscovered();
  const coastalProgress = progress.discoveries.filter((id) => id.startsWith("kairui:"));
  progress.discoveries = [...coastalProgress, ...[...villageDiscoveries].map((id) => `shawn:${id}`)];
  progress.playerAppearance = {
    skin: town.player.appearance.skin,
    hair: town.player.appearance.hair,
    shirt: town.player.appearance.shirt,
    trim: town.player.appearance.trim,
    pants: town.player.appearance.pants,
    shoes: town.player.appearance.shoes
  };
  saveKingdomProgress(progress);

  const coastalDiscoveries = new Set(progress.discoveries.filter((id) => id.startsWith("kairui:")));
  const villageTotal = DISCOVERIES.length;
  const coastalTotal = COASTAL_LANDMARKS.length;
  const villageCount = Math.min(villageDiscoveries.size, villageTotal);
  const coastalCount = Math.min(coastalDiscoveries.size, coastalTotal);
  const totalCount = villageCount + coastalCount;
  const total = villageTotal + coastalTotal;

  root.innerHTML = `
    <main class="kingdom-hub">
      <header class="kingdom-hub-header">
        <div class="kingdom-hub-brand"><span>The 100 Hackathoner</span><i aria-hidden="true"></i><span>Operator archive</span></div>
        <h1>One journey.<br /><em>Two editions.</em></h1>
        <p>Not separate worlds—two ways to experience the same work. Build the system, then walk through the proof.</p>
      </header>

      <section class="kingdom-ledger" aria-label="Combined discovery ledger">
        <div class="kingdom-ledger-heading">
          <span>Journey progress</span>
          <strong>${totalCount}<small> / ${total} discoveries</small></strong>
        </div>
        <div class="kingdom-ledger-track"><span style="width:${total ? totalCount / total * 100 : 0}%"></span></div>
        <p><b>19</b> hackathons shipped <i aria-hidden="true">·</i> target 100</p>
      </section>

      <section class="kingdom-cards" aria-label="Choose an edition">
        ${renderKingdomCard({
          href: "/worlds/shawn",
          number: "01",
          eyebrow: "Build the system",
          title: "The maker's edition",
          summary: "Shape the playground: assets, people, weather, seasons and the operator log all respond to your decisions.",
          progress: `${villageCount} / ${villageTotal} discoveries`,
          action: "Open edition 01",
          className: "village"
        })}
        ${renderKingdomCard({
          href: "/worlds/kairui",
          number: "02",
          eyebrow: "Walk the proof",
          title: "The operator's edition",
          summary: "Follow the field journal through a cinematic coast—stories, decisions and lessons become a place you can explore.",
          progress: `${coastalCount} / ${coastalTotal} field notes`,
          action: "Open edition 02",
          className: "coast"
        })}
      </section>

      <footer class="kingdom-hub-footer">
        <a href="/local-builder">Open the world editor <b aria-hidden="true">↗</b></a>
        <span>One player profile and one archive, shared across both editions.</span>
        <small>Inspired by Shawnville &amp; Kairui</small>
      </footer>
    </main>
  `;
}

function renderKingdomCard(card: {
  href: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  progress: string;
  action: string;
  className: string;
}): string {
  return `
    <a class="kingdom-card ${card.className}" href="${card.href}">
      <div class="kingdom-card-topline">
        <span>Edition ${card.number}</span>
        <i aria-hidden="true"></i>
        <small>${card.eyebrow}</small>
      </div>
      <div class="kingdom-card-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <h2>${card.title}</h2>
      <p>${card.summary}</p>
      <div class="kingdom-card-footer"><small>${card.progress}</small><strong>${card.action} <b aria-hidden="true">↗</b></strong></div>
    </a>
  `;
}
