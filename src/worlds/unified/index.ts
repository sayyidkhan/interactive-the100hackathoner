import type { WorldDefinition } from "../../engine/world";
import { loadKingdomProgress, saveKingdomProgress } from "../../engine/progress";
import { loadDiscovered } from "../../systems/storage";
import { loadTownSchemaDraft } from "../../data/townSchema";
import { DISCOVERIES } from "../../data/discoveries";
import { COASTAL_LANDMARKS } from "../kairui/content";

export const UNIFIED_WORLD: WorldDefinition = {
  id: "unified",
  name: "The Hackathon Kingdoms",
  description: "One persistent operator journey across the editable village and cinematic coast.",
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
        <span>The 100 Hackathoner</span>
        <h1>Two kingdoms.<br />One operator journey.</h1>
        <p>Build in the village. Tell the story on the coast. Carry one identity and one body of proof between both.</p>
      </header>

      <section class="kingdom-ledger" aria-label="Combined discovery ledger">
        <div>
          <span>Combined field notes</span>
          <strong>${totalCount} / ${total}</strong>
        </div>
        <div class="kingdom-ledger-track"><span style="width:${total ? totalCount / total * 100 : 0}%"></span></div>
        <small>19 shipped · target 100</small>
      </section>

      <section class="kingdom-cards" aria-label="Choose a kingdom">
        ${renderKingdomCard({
          href: "/worlds/shawn",
          eyebrow: "Creation district",
          title: "Shawn Kingdom",
          summary: "An editable village for assets, residents, animals, weather, seasons and the operator journal.",
          progress: `${villageCount} / ${villageTotal} discoveries`,
          action: "Enter the village",
          className: "village"
        })}
        ${renderKingdomCard({
          href: "/worlds/kairui",
          eyebrow: "Story district",
          title: "Kairui Kingdom",
          summary: "A cinematic archipelago for guided stories, coastal atmosphere, field notes and transport.",
          progress: `${coastalCount} / ${coastalTotal} field notes`,
          action: "Sail to the coast",
          className: "coast"
        })}
      </section>

      <footer class="kingdom-hub-footer">
        <a href="/local-builder">Open village editor</a>
        <span>Player colours and progress persist across districts</span>
      </footer>
    </main>
  `;
}

function renderKingdomCard(card: {
  href: string;
  eyebrow: string;
  title: string;
  summary: string;
  progress: string;
  action: string;
  className: string;
}): string {
  return `
    <a class="kingdom-card ${card.className}" href="${card.href}">
      <span>${card.eyebrow}</span>
      <div class="kingdom-card-art" aria-hidden="true">
        <i></i><i></i><i></i>
      </div>
      <h2>${card.title}</h2>
      <p>${card.summary}</p>
      <small>${card.progress}</small>
      <strong>${card.action} →</strong>
    </a>
  `;
}
