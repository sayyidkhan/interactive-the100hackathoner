import type { WorldDefinition } from "../../engine/world";
import { loadKingdomProgress, saveKingdomProgress } from "../../engine/progress";
import { loadDiscovered } from "../../systems/storage";
import { loadTownSchemaDraft } from "../../data/townSchema";
import { DISCOVERIES } from "../../data/discoveries";
import { COASTAL_LANDMARKS } from "../kairui/content";

export const UNIFIED_WORLD: WorldDefinition = {
  id: "unified",
  name: "The 100 Hackathoner",
  description: "An island portal for the playable parts of the operator archive.",
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
    <main class="island-portal">
      <header class="portal-header">
        <div class="portal-brand"><span>The 100 Hackathoner</span><i aria-hidden="true"></i><span>Island map</span></div>
        <div class="portal-intro">
          <div>
            <h1><span>Explore</span> <em>the island.</em></h1>
            <p>Follow a serial hackathoner—build in the Village, uncover the story at the Beach.</p>
          </div>
        </div>
      </header>

      <section class="island-map-panel" aria-label="Island destinations">
        <aside class="map-side-menu" aria-label="Places on the island">
          <header class="map-menu-summary">
            <span>Your island</span>
            <strong>${totalCount}<small> / ${total}</small></strong>
            <p>discoveries collected</p>
            <div class="map-progress-track"><span style="width:${total ? totalCount / total * 100 : 0}%"></span></div>
          </header>
          <nav class="map-place-menu" aria-label="Choose a place">
            <span class="map-menu-heading">Places to visit</span>
            <a class="map-menu-item village" href="/worlds/shawn">
              <i aria-hidden="true">01</i><span><strong>Village</strong><small>Build &amp; experiment</small></span><em>${villageCount} / ${villageTotal}<b aria-hidden="true">↗</b></em>
            </a>
            <a class="map-menu-item beach" href="/worlds/kairui">
              <i aria-hidden="true">02</i><span><strong>Beach</strong><small>Stories &amp; field notes</small></span><em>${coastalCount} / ${coastalTotal}<b aria-hidden="true">↗</b></em>
            </a>
          </nav>
          <footer class="map-menu-footer"><b>19</b> hackathons shipped<br />Target: 100</footer>
        </aside>

        <div class="island-map" aria-label="A stylised island map with destinations for the Village and the Beach">
          <i class="map-wave wave-one" aria-hidden="true"></i>
          <i class="map-wave wave-two" aria-hidden="true"></i>
          <i class="map-wave wave-three" aria-hidden="true"></i>
          <i class="map-current current-one" aria-hidden="true"></i><i class="map-current current-two" aria-hidden="true"></i>
          <i class="map-boat" aria-hidden="true"></i><i class="map-star star-one" aria-hidden="true"></i><i class="map-star star-two" aria-hidden="true"></i>
          <div class="island-shadow" aria-hidden="true"></div>
          <div class="island-landmass" aria-hidden="true">
            <i class="island-hill hill-one"></i><i class="island-hill hill-two"></i><i class="island-hill hill-three"></i>
            <i class="island-grove grove-one"></i><i class="island-grove grove-two"></i><i class="island-grove grove-three"></i>
            <i class="island-peak peak-one"></i><i class="island-peak peak-two"></i><i class="island-peak peak-three"></i>
            <i class="island-lagoon"></i><i class="island-shore"></i><i class="island-road"></i><i class="island-river"></i>
            <i class="village-shapes"></i><i class="beach-umbrellas"></i><i class="beach-hut"></i><i class="island-campfire"></i>
          </div>
          <a class="map-place map-place-village" href="/worlds/shawn" aria-label="Enter the Village, ${villageCount} of ${villageTotal} discoveries found">
            <span class="map-pin"><i aria-hidden="true"></i></span>
            <span class="map-place-label"><small>01 · build &amp; experiment</small><strong>Village <b aria-hidden="true">↗</b></strong></span>
          </a>
          <a class="map-place map-place-beach" href="/worlds/kairui" aria-label="Visit the Beach, ${coastalCount} of ${coastalTotal} field notes found">
            <span class="map-pin"><i aria-hidden="true"></i></span>
            <span class="map-place-label"><small>02 · stories &amp; field notes</small><strong>Beach <b aria-hidden="true">↗</b></strong></span>
          </a>
          <span class="map-compass" aria-hidden="true"><i>N</i><b></b><em></em></span>
        </div>
      </section>

      <footer class="portal-footer">
        <span>Follow the paths. New places will appear as the island grows.</span>
        <small>Inspired by Shawnville &amp; Kairui</small>
      </footer>
    </main>
  `;
}
