import type { CoastalLandmark } from "./content";
import type { CoastalEnvironmentState } from "./environment";

export type CoastalHud = {
  isModalOpen(): boolean;
  setNearby(landmark: CoastalLandmark | null): void;
  setProgress(discovered: ReadonlySet<string>, total: number): void;
  openLandmark(landmark: CoastalLandmark, isNew: boolean): void;
  setTour(active: boolean, landmark: CoastalLandmark | null): void;
  setEnvironment(state: CoastalEnvironmentState, localTime: string, isNight: boolean): void;
  setTransit(mode: "none" | "boat" | "balloon"): void;
  dispose(): void;
};

type CoastalHudOptions = {
  onInspect(): void;
  onTourToggle(): void;
  onTourNext(): void;
  onEnvironmentChange(state: CoastalEnvironmentState): void;
  onTransit(mode: "boat" | "balloon"): void;
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
    <button class="coastal-environment-toggle" type="button" data-coastal-environment-toggle aria-expanded="false">
      <span data-coastal-time>GMT+8</span>
      <strong data-coastal-environment-summary>Summer · Clear</strong>
    </button>
    <section class="coastal-environment-panel" data-coastal-environment-panel hidden aria-label="Coastal environment">
      <header>
        <span>World atmosphere</span>
        <strong>Coastal climate</strong>
      </header>
      <div class="coastal-environment-group">
        <span>Season</span>
        <div data-environment-season>
          <button type="button" data-value="spring">Spring</button>
          <button type="button" data-value="summer">Summer</button>
          <button type="button" data-value="autumn">Autumn</button>
          <button type="button" data-value="winter">Winter</button>
        </div>
      </div>
      <div class="coastal-environment-group">
        <span>Weather</span>
        <div data-environment-weather>
          <button type="button" data-value="clear">Clear</button>
          <button type="button" data-value="rain">Rain</button>
          <button type="button" data-value="storm">Storm</button>
        </div>
      </div>
      <div class="coastal-environment-group">
        <span>Time</span>
        <div data-environment-time>
          <button type="button" data-value="live">Live</button>
          <button type="button" data-value="day">Day</button>
          <button type="button" data-value="sunset">Sunset</button>
          <button type="button" data-value="night">Night</button>
        </div>
      </div>
    </section>
    <div class="coastal-transit" aria-label="Coastal transit">
      <button type="button" data-coastal-transit="boat" title="Take a harbour cruise">⛵ <span>Cruise</span></button>
      <button type="button" data-coastal-transit="balloon" title="Take a balloon overview">◉ <span>Overview</span></button>
    </div>
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
  const environmentToggle = hud.querySelector<HTMLButtonElement>("[data-coastal-environment-toggle]")!;
  const environmentPanel = hud.querySelector<HTMLElement>("[data-coastal-environment-panel]")!;
  const transitButtons = [...hud.querySelectorAll<HTMLButtonElement>("[data-coastal-transit]")];
  const close = hud.querySelector<HTMLButtonElement>(".coastal-card-close")!;
  const next = hud.querySelector<HTMLButtonElement>("[data-coastal-next]")!;
  const free = hud.querySelector<HTMLButtonElement>("[data-coastal-free]")!;
  let nearby: CoastalLandmark | null = null;
  let tourActive = false;
  let environmentState: CoastalEnvironmentState = { season: "summer", weather: "clear", time: "live" };

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
  const toggleEnvironment = () => {
    environmentPanel.hidden = !environmentPanel.hidden;
    environmentToggle.setAttribute("aria-expanded", String(!environmentPanel.hidden));
  };
  environmentToggle.addEventListener("click", toggleEnvironment);
  const environmentButtons = [...environmentPanel.querySelectorAll<HTMLButtonElement>("button[data-value]")];
  const handleEnvironmentButton = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const group = button.closest<HTMLElement>("[data-environment-season], [data-environment-weather], [data-environment-time]");
    if (!group) return;
    const value = button.dataset.value;
    if (group.hasAttribute("data-environment-season")) environmentState = { ...environmentState, season: value as CoastalEnvironmentState["season"] };
    if (group.hasAttribute("data-environment-weather")) environmentState = { ...environmentState, weather: value as CoastalEnvironmentState["weather"] };
    if (group.hasAttribute("data-environment-time")) environmentState = { ...environmentState, time: value as CoastalEnvironmentState["time"] };
    options.onEnvironmentChange(environmentState);
  };
  environmentButtons.forEach((button) => button.addEventListener("click", handleEnvironmentButton));
  const handleTransit = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const mode = button.dataset.coastalTransit;
    if (mode === "boat" || mode === "balloon") options.onTransit(mode);
  };
  transitButtons.forEach((button) => button.addEventListener("click", handleTransit));

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
    setEnvironment(state, localTime, isNight) {
      environmentState = { ...state };
      hud.querySelector<HTMLElement>("[data-coastal-time]")!.textContent = state.time === "live" ? `${localTime} · GMT+8` : state.time;
      hud.querySelector<HTMLElement>("[data-coastal-environment-summary]")!.textContent = `${capitalize(state.season)} · ${capitalize(state.weather)}`;
      environmentButtons.forEach((button) => {
        const selected = button.dataset.value === state.season || button.dataset.value === state.weather || button.dataset.value === state.time;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      root.dataset.coastalSeason = state.season;
      root.dataset.coastalWeather = state.weather;
      root.dataset.coastalTime = state.time;
      root.dataset.coastalDaylight = isNight ? "night" : "day";
    },
    setTransit(mode) {
      transitButtons.forEach((button) => {
        const selected = button.dataset.coastalTransit === mode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      root.dataset.coastalTransit = mode;
    },
    dispose() {
      prompt.removeEventListener("click", inspect);
      tourButton.removeEventListener("click", options.onTourToggle);
      environmentToggle.removeEventListener("click", toggleEnvironment);
      environmentButtons.forEach((button) => button.removeEventListener("click", handleEnvironmentButton));
      transitButtons.forEach((button) => button.removeEventListener("click", handleTransit));
      hud.remove();
    }
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
