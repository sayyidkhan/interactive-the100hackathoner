import type { CoastalLandmark } from "./content";

export type CoastalHud = {
  isModalOpen(): boolean;
  setNearby(landmark: CoastalLandmark | null): void;
  setProgress(discovered: ReadonlySet<string>, total: number): void;
  openLandmark(landmark: CoastalLandmark, isNew: boolean): void;
  setTour(active: boolean, landmark: CoastalLandmark | null): void;
  dispose(): void;
};

type CoastalHudOptions = {
  onInspect(): void;
  onTourToggle(): void;
  onTourNext(): void;
};

export function createCoastalHud(root: HTMLElement, options: CoastalHudOptions): CoastalHud {
  const hud = document.createElement("div");
  hud.className = "coastal-hud";
  hud.innerHTML = `
    <header class="coastal-plaque">
      <span>The 100th</span>
      <strong>Hackathon Archipelago</strong>
      <small>an explorable operator journal</small>
    </header>
    <div class="coastal-progress" aria-live="polite">
      <span>FIELD NOTES</span>
      <strong data-coastal-progress>0 / 5</strong>
    </div>
    <nav class="coastal-world-switcher" aria-label="Kingdom travel">
      <a href="/worlds/shawn">Village</a>
      <a href="/worlds/kairui" aria-current="page">Coast</a>
    </nav>
    <button class="coastal-tour-button" type="button" data-coastal-tour>
      <span>Guided journey</span>
      <strong>Start tour</strong>
    </button>
    <button class="coastal-prompt" type="button" data-coastal-prompt hidden>
      <kbd>E</kbd>
      <span>Inspect landmark</span>
    </button>
    <div class="coastal-controls">WASD walk · Shift jog · drag to look · E inspect</div>
    <section class="coastal-story-card" data-coastal-card hidden role="dialog" aria-modal="true" aria-labelledby="coastal-story-title">
      <button type="button" class="coastal-card-close" aria-label="Close story">×</button>
      <span data-coastal-kicker></span>
      <h1 id="coastal-story-title" data-coastal-title></h1>
      <p data-coastal-summary></p>
      <blockquote data-coastal-lesson></blockquote>
      <div class="coastal-card-actions">
        <button type="button" data-coastal-next>Continue journey</button>
        <button type="button" data-coastal-free>Explore freely</button>
      </div>
    </section>
  `;
  root.appendChild(hud);

  const prompt = hud.querySelector<HTMLButtonElement>("[data-coastal-prompt]")!;
  const progress = hud.querySelector<HTMLElement>("[data-coastal-progress]")!;
  const tourButton = hud.querySelector<HTMLButtonElement>("[data-coastal-tour]")!;
  const card = hud.querySelector<HTMLElement>("[data-coastal-card]")!;
  const close = hud.querySelector<HTMLButtonElement>(".coastal-card-close")!;
  const next = hud.querySelector<HTMLButtonElement>("[data-coastal-next]")!;
  const free = hud.querySelector<HTMLButtonElement>("[data-coastal-free]")!;
  let nearby: CoastalLandmark | null = null;
  let tourActive = false;

  const hideCard = () => {
    card.hidden = true;
    root.classList.remove("coastal-card-open");
  };
  const inspect = () => options.onInspect();
  prompt.addEventListener("click", inspect);
  tourButton.addEventListener("click", options.onTourToggle);
  close.addEventListener("click", hideCard);
  next.addEventListener("click", () => {
    hideCard();
    options.onTourNext();
  });
  free.addEventListener("click", () => {
    hideCard();
    if (tourActive) options.onTourToggle();
  });

  return {
    isModalOpen: () => !card.hidden,
    setNearby(landmark) {
      nearby = landmark;
      prompt.hidden = !landmark;
      const label = prompt.querySelector("span");
      if (label) label.textContent = landmark ? `Inspect ${landmark.name}` : "Inspect landmark";
    },
    setProgress(discovered, total) {
      progress.textContent = `${discovered.size} / ${total}`;
    },
    openLandmark(landmark, isNew) {
      hud.querySelector<HTMLElement>("[data-coastal-kicker]")!.textContent = `${isNew ? "New field note · " : "Field note · "}${landmark.kicker}`;
      hud.querySelector<HTMLElement>("[data-coastal-title]")!.textContent = landmark.name;
      hud.querySelector<HTMLElement>("[data-coastal-summary]")!.textContent = landmark.summary;
      hud.querySelector<HTMLElement>("[data-coastal-lesson]")!.textContent = landmark.lesson;
      card.style.setProperty("--landmark-accent", landmark.color);
      card.hidden = false;
      root.classList.add("coastal-card-open");
      close.focus();
    },
    setTour(active, landmark) {
      tourActive = active;
      tourButton.classList.toggle("active", active);
      tourButton.querySelector("strong")!.textContent = active ? "Tour active" : "Start tour";
      tourButton.querySelector("span")!.textContent = active && landmark ? `Next · ${landmark.name}` : "Guided journey";
      root.dataset.coastalTour = active ? "active" : "free";
    },
    dispose() {
      prompt.removeEventListener("click", inspect);
      tourButton.removeEventListener("click", options.onTourToggle);
      hud.remove();
    }
  };
}
