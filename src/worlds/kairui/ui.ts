import type { CoastalLandmark } from "./content";
import { COASTAL_LANDMARKS } from "./content";
import type { CoastalEnvironmentState } from "./environment";

export type CoastalHud = {
  isModalOpen(): boolean;
  setNearby(landmark: CoastalLandmark | null): void;
  setBalloonNearby(active: boolean): void;
  setProgress(discovered: ReadonlySet<string>, total: number): void;
  openLandmark(landmark: CoastalLandmark, isNew: boolean): void;
  closeLandmark(): void;
  setTour(active: boolean, landmark: CoastalLandmark | null): void;
  setEnvironment(state: CoastalEnvironmentState, localTime: string, isNight: boolean): void;
  setTransit(mode: "none" | "boat" | "balloon"): void;
  setBalloonMode(mode: "autopilot" | "free"): void;
  setHoverboard(active: boolean): void;
  setEstablishing(active: boolean): void;
  dispose(): void;
};

type CoastalHudOptions = {
  onEnterWorld(): void;
  onInspect(): void;
  onBalloonBoard(): void;
  onHoverboardToggle(): void;
  onTourToggle(): void;
  onTourPrevious(): void;
  onTourNext(): void;
  onTourSelect(index: number): void;
  onEnvironmentChange(state: CoastalEnvironmentState): void;
  onTransit(mode: "none" | "boat" | "balloon"): void;
  onBalloonModeChange(mode: "autopilot" | "free"): void;
};

export function createCoastalHud(root: HTMLElement, options: CoastalHudOptions): CoastalHud {
  const hud = document.createElement("div");
  hud.className = "coastal-hud";
  hud.innerHTML = `
    <div class="coastal-vignette" aria-hidden="true"></div>
    <header class="coastal-plaque">
      <span>The 100th</span>
      <strong>Hackathoner</strong>
      <small>A walkable operator journal.</small>
    </header>
    <button class="coastal-enter-world" type="button" data-coastal-enter>
      <span>19 expeditions · one coast</span>
      <strong>Enter the coast</strong><i aria-hidden="true">↗</i>
    </button>
    <button class="coastal-menu-toggle" type="button" data-coastal-menu-toggle aria-expanded="false" aria-controls="coastal-menu-panel">
      <span aria-hidden="true">☰</span><strong>Menu</strong>
    </button>
    <section class="coastal-menu-panel" id="coastal-menu-panel" data-coastal-menu-panel hidden aria-label="Coastal menu">
      <header class="coastal-menu-header">
        <div><span>Paused</span><strong>Operator coast</strong></div>
        <button type="button" data-coastal-resume><span aria-hidden="true">▶</span> Resume</button>
      </header>
      <div class="coastal-progress" aria-live="polite">
        <span><i aria-hidden="true">◇</i> Field notes</span>
        <strong data-coastal-progress>0 / 5</strong>
      </div>
      <div class="coastal-menu-group">
        <span>Travel</span>
        <nav class="coastal-world-switcher" aria-label="Kingdom travel">
          <a href="/worlds/shawn"><i aria-hidden="true">⌂</i><span>Village</span></a>
          <a href="/worlds/kairui" aria-current="page"><i aria-hidden="true">≈</i><span>Coast</span></a>
          <a href="/kingdoms"><i aria-hidden="true">◇</i><span>Worlds</span></a>
        </nav>
      </div>
      <div class="coastal-menu-group">
        <span>Explore</span>
        <div class="coastal-transit" aria-label="Coastal transit">
          <button type="button" data-coastal-transit="none" title="Return to free roam"><i aria-hidden="true">↙</i><span>Free roam</span></button>
          <button type="button" data-coastal-transit="boat" title="Take a harbour cruise"><i aria-hidden="true">⛵</i><span>Cruise</span></button>
          <button type="button" data-coastal-transit="balloon" title="Take a balloon overview"><i aria-hidden="true">◉</i><span>Overview</span></button>
        </div>
      </div>
      <button class="coastal-environment-toggle" type="button" data-coastal-environment-toggle aria-expanded="false">
        <i aria-hidden="true">☼</i>
        <span><small data-coastal-time>GMT+8</small><strong data-coastal-environment-summary>Summer · Clear</strong></span>
        <b aria-hidden="true">›</b>
      </button>
      <footer><span>WASD</span> Move <span>Q</span> Board <span>E</span> Inspect <span>Esc</span> Resume</footer>
    </section>
    <button class="coastal-tour-button" type="button" data-coastal-tour>
      <i aria-hidden="true">✦</i>
      <span><small>Story route</small><strong>Guided tour</strong></span>
      <b aria-hidden="true">›</b>
    </button>
    <button class="coastal-transit-exit" type="button" data-coastal-transit-exit hidden>
      <span data-coastal-transit-exit-label>Camera mode active</span>
      <strong>Return to free roam ↙</strong>
    </button>
    <section class="coastal-balloon-mode" data-coastal-balloon-mode hidden aria-label="Balloon flight mode">
      <div role="group" aria-label="Balloon controls">
        <button type="button" data-coastal-balloon-mode="autopilot">Autopilot</button>
        <button type="button" data-coastal-balloon-mode="free">Free flight</button>
      </div>
      <small data-coastal-balloon-hint hidden>A/D turn · W/S speed · Space/Shift altitude</small>
    </section>
    <nav class="coastal-chapter-rail" aria-label="Operator journal chapters">
      ${COASTAL_LANDMARKS.map((landmark, index) => `
        <button type="button" data-coastal-chapter="${index}" aria-label="Go to chapter ${index + 1}: ${landmark.chapter}">
          <i>${String(index + 1).padStart(2, "0")}</i><span>${landmark.chapter}</span>
        </button>`).join("")}
    </nav>
    <section class="coastal-environment-panel" data-coastal-environment-panel hidden aria-label="Coastal environment">
      <header>
        <div><span>World atmosphere</span><strong>Coastal climate</strong></div>
        <button type="button" class="coastal-environment-close" aria-label="Close coastal climate">×</button>
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
    <button class="coastal-prompt" type="button" data-coastal-prompt hidden>
      <kbd>E</kbd>
      <span>Inspect landmark</span>
    </button>
    <button class="coastal-hoverboard-toggle" type="button" data-coastal-hoverboard aria-pressed="false" title="Summon hoverboard (Q)">
      <kbd>Q</kbd><span><small>Quick travel</small><strong>Summon board</strong></span><b aria-hidden="true">›</b>
    </button>
    <div class="coastal-controls">WASD explore · Shift boost · Q hoverboard · E inspect</div>
    <section class="coastal-story-card" data-coastal-card hidden role="dialog" aria-modal="true" aria-labelledby="coastal-story-title">
      <button type="button" class="coastal-card-close" aria-label="Close story">×</button>
      <div class="coastal-story-eyebrow"><span data-coastal-kicker></span><b data-coastal-chapter-count>01 / 06</b></div>
      <h1 id="coastal-story-title" data-coastal-title></h1>
      <p data-coastal-summary></p>
      <div class="coastal-story-metric"><strong data-coastal-metric></strong><span data-coastal-metric-label></span></div>
      <dl class="coastal-story-log">
        <div><dt>Operator decision</dt><dd data-coastal-decision></dd></div>
        <div><dt>Shipped proof</dt><dd data-coastal-proof></dd></div>
        <div><dt>Playbook change</dt><dd data-coastal-lesson></dd></div>
        <div><dt>Next bet</dt><dd data-coastal-next-bet></dd></div>
      </dl>
      <div class="coastal-card-actions">
        <button type="button" data-coastal-previous>← Previous</button>
        <button type="button" data-coastal-next>Next stop →</button>
        <button type="button" data-coastal-free>Exit tour</button>
      </div>
    </section>
  `;
  root.appendChild(hud);

  const prompt = hud.querySelector<HTMLButtonElement>("[data-coastal-prompt]")!;
  const hoverboardButton = hud.querySelector<HTMLButtonElement>("[data-coastal-hoverboard]")!;
  const progress = hud.querySelector<HTMLElement>("[data-coastal-progress]")!;
  const tourButton = hud.querySelector<HTMLButtonElement>("[data-coastal-tour]")!;
  const enterButton = hud.querySelector<HTMLButtonElement>("[data-coastal-enter]")!;
  const card = hud.querySelector<HTMLElement>("[data-coastal-card]")!;
  const menuToggle = hud.querySelector<HTMLButtonElement>("[data-coastal-menu-toggle]")!;
  const menuPanel = hud.querySelector<HTMLElement>("[data-coastal-menu-panel]")!;
  const resumeButton = hud.querySelector<HTMLButtonElement>("[data-coastal-resume]")!;
  const environmentToggle = hud.querySelector<HTMLButtonElement>("[data-coastal-environment-toggle]")!;
  const environmentPanel = hud.querySelector<HTMLElement>("[data-coastal-environment-panel]")!;
  const environmentClose = hud.querySelector<HTMLButtonElement>(".coastal-environment-close")!;
  const transitButtons = [...hud.querySelectorAll<HTMLButtonElement>("[data-coastal-transit]")];
  const transitExit = hud.querySelector<HTMLButtonElement>("[data-coastal-transit-exit]")!;
  const transitExitLabel = hud.querySelector<HTMLElement>("[data-coastal-transit-exit-label]")!;
  const balloonMode = hud.querySelector<HTMLElement>("[data-coastal-balloon-mode]")!;
  const balloonModeButtons = [...hud.querySelectorAll<HTMLButtonElement>("[data-coastal-balloon-mode] button")];
  const balloonHint = hud.querySelector<HTMLElement>("[data-coastal-balloon-hint]")!;
  const chapterButtons = [...hud.querySelectorAll<HTMLButtonElement>("[data-coastal-chapter]")];
  const close = hud.querySelector<HTMLButtonElement>(".coastal-card-close")!;
  const previous = hud.querySelector<HTMLButtonElement>("[data-coastal-previous]")!;
  const next = hud.querySelector<HTMLButtonElement>("[data-coastal-next]")!;
  const free = hud.querySelector<HTMLButtonElement>("[data-coastal-free]")!;
  let nearby: CoastalLandmark | null = null;
  let balloonNearby = false;
  let tourActive = false;
  let environmentState: CoastalEnvironmentState = { season: "summer", weather: "clear", time: "live" };

  const hideCard = () => {
    card.hidden = true;
    root.classList.remove("coastal-card-open");
  };
  const updatePrompt = () => {
    prompt.hidden = !nearby && !balloonNearby;
    const label = prompt.querySelector("span");
    if (label) label.textContent = balloonNearby
      ? "Board the hot air balloon"
      : nearby
        ? `Inspect ${nearby.name}`
        : "Inspect landmark";
  };
  const inspect = () => {
    if (balloonNearby) options.onBalloonBoard();
    else options.onInspect();
  };
  const closeEnvironment = () => {
    environmentPanel.hidden = true;
    environmentToggle.setAttribute("aria-expanded", "false");
  };
  const closeMenu = () => {
    menuPanel.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    root.classList.remove("coastal-menu-open");
  };
  const toggleMenu = () => {
    const willOpen = menuPanel.hidden;
    if (willOpen) closeEnvironment();
    menuPanel.hidden = !willOpen;
    menuToggle.setAttribute("aria-expanded", String(!menuPanel.hidden));
    root.classList.toggle("coastal-menu-open", !menuPanel.hidden);
    if (!menuPanel.hidden) resumeButton.focus();
  };
  prompt.addEventListener("click", inspect);
  hoverboardButton.addEventListener("click", options.onHoverboardToggle);
  menuToggle.addEventListener("click", toggleMenu);
  resumeButton.addEventListener("click", closeMenu);
  tourButton.addEventListener("click", options.onTourToggle);
  enterButton.addEventListener("click", options.onEnterWorld);
  close.addEventListener("click", hideCard);
  previous.addEventListener("click", () => {
    hideCard();
    options.onTourPrevious();
  });
  next.addEventListener("click", () => {
    hideCard();
    options.onTourNext();
  });
  free.addEventListener("click", () => {
    hideCard();
    if (tourActive) options.onTourToggle();
  });
  const toggleEnvironment = () => {
    const willOpen = environmentPanel.hidden;
    environmentPanel.hidden = !willOpen;
    environmentToggle.setAttribute("aria-expanded", String(!environmentPanel.hidden));
    if (willOpen) closeMenu();
  };
  environmentToggle.addEventListener("click", toggleEnvironment);
  environmentClose.addEventListener("click", closeEnvironment);
  const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (!target || environmentPanel.hidden) return;
    if (!environmentPanel.contains(target) && !environmentToggle.contains(target)) closeEnvironment();
  };
  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    closeEnvironment();
    closeMenu();
  };
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);
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
    if (mode === "none" || mode === "boat" || mode === "balloon") {
      closeMenu();
      options.onTransit(mode);
    }
  };
  transitButtons.forEach((button) => button.addEventListener("click", handleTransit));
  const exitTransit = () => options.onTransit("none");
  transitExit.addEventListener("click", exitTransit);
  const handleBalloonMode = (event: Event) => {
    const mode = (event.currentTarget as HTMLButtonElement).dataset.coastalBalloonMode;
    if (mode === "autopilot" || mode === "free") options.onBalloonModeChange(mode);
  };
  balloonModeButtons.forEach((button) => button.addEventListener("click", handleBalloonMode));
  const handleChapter = (event: Event) => {
    const index = Number((event.currentTarget as HTMLButtonElement).dataset.coastalChapter);
    if (Number.isFinite(index)) options.onTourSelect(index);
  };
  chapterButtons.forEach((button) => button.addEventListener("click", handleChapter));

  return {
    isModalOpen: () => !card.hidden || !menuPanel.hidden || !environmentPanel.hidden,
    setNearby(landmark) {
      nearby = landmark;
      updatePrompt();
    },
    setBalloonNearby(active) {
      balloonNearby = active;
      updatePrompt();
    },
    setProgress(discovered, total) {
      const currentKeys = new Set(COASTAL_LANDMARKS.map((landmark) => `kairui:${landmark.id}`));
      const worldDiscoveries = [...discovered].filter((id) => currentKeys.has(id));
      progress.textContent = `${worldDiscoveries.length} / ${total}`;
    },
    openLandmark(landmark, isNew) {
      const chapterIndex = COASTAL_LANDMARKS.findIndex((item) => item.id === landmark.id);
      hud.querySelector<HTMLElement>("[data-coastal-kicker]")!.textContent = `${isNew ? "New · " : ""}${landmark.kicker}`;
      hud.querySelector<HTMLElement>("[data-coastal-chapter-count]")!.textContent = `${String(chapterIndex + 1).padStart(2, "0")} / 06`;
      hud.querySelector<HTMLElement>("[data-coastal-title]")!.textContent = landmark.name;
      hud.querySelector<HTMLElement>("[data-coastal-summary]")!.textContent = landmark.summary;
      hud.querySelector<HTMLElement>("[data-coastal-metric]")!.textContent = landmark.metric.value;
      hud.querySelector<HTMLElement>("[data-coastal-metric-label]")!.textContent = landmark.metric.label;
      hud.querySelector<HTMLElement>("[data-coastal-decision]")!.textContent = landmark.decision;
      hud.querySelector<HTMLElement>("[data-coastal-proof]")!.textContent = landmark.proof;
      hud.querySelector<HTMLElement>("[data-coastal-lesson]")!.textContent = landmark.lesson;
      hud.querySelector<HTMLElement>("[data-coastal-next-bet]")!.textContent = landmark.nextBet;
      card.style.setProperty("--landmark-accent", landmark.color);
      const finalChapter = COASTAL_LANDMARKS.at(-1)?.id === landmark.id;
      next.textContent = tourActive ? (finalChapter ? "Return to origin ↺" : "Next stop →") : "Continue journey";
      card.hidden = false;
      root.classList.add("coastal-card-open");
      close.focus();
    },
    closeLandmark() {
      hideCard();
    },
    setTour(active, landmark) {
      tourActive = active;
      closeMenu();
      closeEnvironment();
      tourButton.classList.toggle("active", active);
      tourButton.querySelector("strong")!.textContent = active ? "Exit tour" : "Guided tour";
      tourButton.querySelector("small")!.textContent = active && landmark ? `Travelling · ${landmark.name}` : active ? "Tour in progress" : "Story route";
      root.dataset.coastalTour = active ? "active" : "free";
      chapterButtons.forEach((button) => {
        const selectedIndex = landmark ? COASTAL_LANDMARKS.findIndex((item) => item.id === landmark.id) : -1;
        const selected = Boolean(active && landmark && Number(button.dataset.coastalChapter) === selectedIndex);
        button.classList.toggle("active", selected);
        button.setAttribute("aria-current", selected ? "step" : "false");
      });
      previous.hidden = !active;
      const isFinalChapter = Boolean(active && landmark && COASTAL_LANDMARKS.at(-1)?.id === landmark.id);
      next.textContent = active ? (isFinalChapter ? "Return to origin ↺" : "Next stop →") : "Continue journey";
      free.textContent = active ? "Exit tour" : "Explore freely";
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
      transitExit.hidden = mode === "none";
      transitExitLabel.textContent = mode === "boat" ? "Cruise camera active" : "Balloon ride active";
      balloonMode.hidden = mode !== "balloon";
      root.dataset.coastalTransit = mode;
    },
    setBalloonMode(mode) {
      balloonModeButtons.forEach((button) => {
        const selected = button.dataset.coastalBalloonMode === mode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      balloonHint.hidden = mode !== "free";
    },
    setHoverboard(active) {
      hoverboardButton.classList.toggle("active", active);
      hoverboardButton.setAttribute("aria-pressed", String(active));
      hoverboardButton.title = active ? "Dismiss hoverboard (Q)" : "Summon hoverboard (Q)";
      hoverboardButton.querySelector<HTMLElement>("small")!.textContent = active ? "2.2× travel speed" : "Quick travel";
      hoverboardButton.querySelector<HTMLElement>("strong")!.textContent = active ? "Dismiss board" : "Summon board";
    },
    setEstablishing(active) {
      enterButton.hidden = !active;
      if (active) {
        closeMenu();
        closeEnvironment();
      }
      root.dataset.coastalEstablishing = active ? "true" : "false";
    },
    dispose() {
      prompt.removeEventListener("click", inspect);
      hoverboardButton.removeEventListener("click", options.onHoverboardToggle);
      menuToggle.removeEventListener("click", toggleMenu);
      resumeButton.removeEventListener("click", closeMenu);
      tourButton.removeEventListener("click", options.onTourToggle);
      enterButton.removeEventListener("click", options.onEnterWorld);
      environmentToggle.removeEventListener("click", toggleEnvironment);
      environmentClose.removeEventListener("click", closeEnvironment);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      environmentButtons.forEach((button) => button.removeEventListener("click", handleEnvironmentButton));
      transitButtons.forEach((button) => button.removeEventListener("click", handleTransit));
      transitExit.removeEventListener("click", exitTransit);
      balloonModeButtons.forEach((button) => button.removeEventListener("click", handleBalloonMode));
      chapterButtons.forEach((button) => button.removeEventListener("click", handleChapter));
      hud.remove();
    }
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
