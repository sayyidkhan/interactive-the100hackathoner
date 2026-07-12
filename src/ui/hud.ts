import { DISCOVERIES, DiscoveryEntry, JOURNEY_PROGRESS } from "../data/discoveries";

export type HudApi = {
  setPrompt: (entry: DiscoveryEntry | null) => void;
  setProgress: (discovered: Set<string>) => void;
  openCard: (entry: DiscoveryEntry, onClose: () => void) => void;
  closeCard: () => void;
  openIntro: (onStart: () => void) => void;
  openPersona: () => void;
  openJournal: (discovered: Set<string>) => void;
  isModalOpen: () => boolean;
  setWaypoint: (entry: DiscoveryEntry | null, distance?: number, heading?: string, tracked?: boolean) => void;
  showDiscoveryToast: (entry: DiscoveryEntry, discoveredCount: number) => void;
};

export type PersonaId = "hackathoner" | "operator" | "founder" | "agentic" | "investor" | "builder";

export type PersonaOption = {
  id: PersonaId;
  emoji: string;
  name: string;
  caption: string;
  trait: string;
  movement: {
    walk: number;
    sprint: number;
    jump: number;
  };
  colors: {
    shirt: string;
    trim: string;
    pants: string;
    shoes: string;
    hair: string;
  };
};

type MusicModeId = "focus" | "drift" | "sprint";

type MusicMode = {
  id: MusicModeId;
  icon: string;
  label: string;
  notes: number[];
  harmony: number[];
  intervalMs: number;
  volume: number;
};

type ThemeMeta = {
  label: string;
  accent: string;
  tint: string;
  signal: string;
};

type ChapterSeed = {
  hook: string;
  question: string;
  asset: string;
};

type OpportunitySignal = {
  label: string;
  entry: DiscoveryEntry;
  action: string;
  preview: boolean;
};

type OperatorBrief = {
  completion: number;
  primarySignal: string;
  thesis: string;
  proofEntry: DiscoveryEntry;
  nextEntry: DiscoveryEntry | undefined;
  moves: string[];
  signals: OpportunitySignal[];
};

type MomentumMilestone = {
  target: number;
  label: string;
  outcome: string;
  action: string;
};

const MAP_MIN = -15;
const MAP_SIZE = 30;

const MUSIC_MODES: MusicMode[] = [
  { id: "focus", icon: "♪", label: "Focus loop", notes: [196, 247, 294, 247], harmony: [98, 123, 147, 123], intervalMs: 1100, volume: 0.018 },
  { id: "drift", icon: "♬", label: "Drift loop", notes: [174, 220, 261, 220], harmony: [87, 110, 130, 110], intervalMs: 1400, volume: 0.016 },
  { id: "sprint", icon: "♫", label: "Sprint loop", notes: [220, 277, 330, 370], harmony: [110, 138, 165, 185], intervalMs: 760, volume: 0.014 }
];

const THEME_META: Record<DiscoveryEntry["theme"], ThemeMeta> = {
  "ai-agents": { label: "Agent loop", accent: "#6fa6a0", tint: "#d7ebe6", signal: "automation" },
  saas: { label: "SaaS wedge", accent: "#d78c75", tint: "#f5ddd3", signal: "monetization" },
  sustainability: { label: "Climate ops", accent: "#85ad6f", tint: "#dcebd0", signal: "efficiency" },
  crypto: { label: "Ownership rail", accent: "#7f8eaa", tint: "#dde3ee", signal: "trust" },
  devtools: { label: "Developer proof", accent: "#f0c86b", tint: "#f8edc7", signal: "workflow" },
  founder: { label: "Operator system", accent: "#d2ad6a", tint: "#f2e3c4", signal: "decision" },
  story: { label: "Narrative asset", accent: "#ee765f", tint: "#f6d9d1", signal: "distribution" }
};

const MOMENTUM_MILESTONES: MomentumMilestone[] = [
  {
    target: 1,
    label: "First signal",
    outcome: "The archive has moved from static portfolio to proof loop.",
    action: "Extract one public post or chapter scene from the saved story."
  },
  {
    target: 3,
    label: "Pattern forming",
    outcome: "Enough stories exist to compare themes instead of judging one demo.",
    action: "Tag the strongest buyer pain, distribution hook, and repeatable workflow."
  },
  {
    target: 5,
    label: "Operator rhythm",
    outcome: "The map now supports a weekly review instead of a memory dump.",
    action: "Choose one project to monetize, one to kill, and one to turn into content."
  },
  {
    target: 10,
    label: "Proof stack",
    outcome: "The journey has enough density for a credible public proof index.",
    action: "Package the strongest signals into a landing page, deck, or lead magnet."
  },
  {
    target: 15,
    label: "Distribution engine",
    outcome: "The archive is now a repeatable content and opportunity system.",
    action: "Publish a thematic series and route each post to a concrete offer."
  },
  {
    target: DISCOVERIES.length,
    label: "Archive operating system",
    outcome: "Every current story has been converted into reusable leverage.",
    action: "Turn the completed route into the book outline and public proof-of-work hub."
  }
];

export const PERSONAS: PersonaOption[] = [
  {
    id: "hackathoner",
    emoji: "🏁",
    name: "Hackathoner",
    caption: "learns by shipping",
    trait: "Sprint bias: faster scouting",
    movement: { walk: 1.02, sprint: 1.08, jump: 1 },
    colors: { shirt: "#ef765f", trim: "#c95749", pants: "#254b5f", shoes: "#f2f0e9", hair: "#241f1a" }
  },
  {
    id: "operator",
    emoji: "🧭",
    name: "Operator",
    caption: "turns chaos into loops",
    trait: "Steady loop: tighter control",
    movement: { walk: 0.98, sprint: 1, jump: 1.05 },
    colors: { shirt: "#d2ad6a", trim: "#9c7032", pants: "#34443f", shoes: "#f5ead9", hair: "#2b241d" }
  },
  {
    id: "founder",
    emoji: "🚀",
    name: "Founder",
    caption: "tests markets, not opinions",
    trait: "Pivot pace: quicker walk",
    movement: { walk: 1.06, sprint: 1.03, jump: 1 },
    colors: { shirt: "#6fa6a0", trim: "#2e6f72", pants: "#4d5d7e", shoes: "#fff4cf", hair: "#211d1b" }
  },
  {
    id: "agentic",
    emoji: "🤖",
    name: "Agentic Engineer",
    caption: "delegates to systems",
    trait: "Auto-pacer: smooth sprint",
    movement: { walk: 1, sprint: 1.06, jump: 1.02 },
    colors: { shirt: "#7f8eaa", trim: "#4d5d7e", pants: "#263238", shoes: "#dce5c8", hair: "#161719" }
  },
  {
    id: "investor",
    emoji: "📈",
    name: "Investor",
    caption: "hunts asymmetric upside",
    trait: "Patient scan: higher hop",
    movement: { walk: 0.96, sprint: 0.98, jump: 1.08 },
    colors: { shirt: "#85ad6f", trim: "#51783f", pants: "#3a4843", shoes: "#f2ead8", hair: "#261f18" }
  },
  {
    id: "builder",
    emoji: "🧑‍💻",
    name: "Builder",
    caption: "ships first, explains later",
    trait: "Hands-on boost: fast walk",
    movement: { walk: 1.07, sprint: 1.02, jump: 1 },
    colors: { shirt: "#f0c86b", trim: "#b88930", pants: "#334856", shoes: "#f2f0e9", hair: "#241f1a" }
  }
];

export function createHud(
  root: HTMLElement,
  options: {
    onPersonaChange?: (persona: PersonaOption) => void;
    onWaypointSelect?: (entry: DiscoveryEntry) => void;
    onCameraZoom?: (amount: number) => void;
  } = {}
): HudApi {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <section class="brand-card">
      <h1>The 100 Hackathoner</h1>
      <p>a walkable proof-of-work archive</p>
    </section>

    <button class="progress-pill" type="button" aria-label="Open discovery journal">
      <span class="star">✦</span>
      <span class="progress-text">${formatProgress(new Set())}</span>
    </button>

    <div class="controls-hint">
      <b>WASD</b> move <span>·</span> drag orbit <span>·</span> scroll zoom <span>·</span> <b>E</b> read
    </div>

    <div class="action-prompt" hidden>
      <span>Space or E to read</span>
    </div>

    <section class="proximity-card" hidden aria-live="polite">
      <span class="proximity-kicker">Nearby story</span>
      <strong class="proximity-title">Welcome Plaza</strong>
      <span class="proximity-meta">Town Center · distribution</span>
      <span class="proximity-clue">start where the proof-of-work begins</span>
      <span class="proximity-persona">🏁 Hackathoner · Sprint bias: faster scouting</span>
      <span class="proximity-status">Press E to save</span>
    </section>

    <aside class="discovery-toast" hidden aria-live="polite">
      <span class="toast-icon">✦</span>
      <div>
        <strong class="toast-title">Story saved</strong>
        <span class="toast-meta">Added to journal</span>
        <span class="toast-signal">Signal extracted</span>
      </div>
    </aside>

    <section class="waypoint-card" aria-live="polite">
      <span class="waypoint-label">Next story</span>
      <strong class="waypoint-title">Welcome Plaza</strong>
      <span class="waypoint-meta">center · 0m</span>
      <span class="waypoint-clue">start where the proof-of-work begins</span>
      <span class="waypoint-progress" aria-hidden="true"><i></i></span>
      <span class="waypoint-action">Follow the closest glow</span>
    </section>

    <button class="town-map" type="button" aria-label="Open discovery map">
      <span class="town-map-label">Town map</span>
      <span class="town-map-grid" aria-hidden="true"></span>
      <span class="town-map-caption">0/${DISCOVERIES.length} found</span>
    </button>

    <div class="corner-controls" aria-label="View and sound controls" data-tool-dock>
      <button type="button" title="open controls" aria-label="Open view and sound controls" aria-expanded="false" data-tools-toggle>⚙</button>
      <button class="tool-control" type="button" title="zoom out" aria-label="Zoom out" data-camera-zoom="out">-</button>
      <button class="tool-control" type="button" title="zoom in" aria-label="Zoom in" data-camera-zoom="in">+</button>
      <button class="sound-toggle tool-control" type="button" title="sound off" aria-label="Turn sound on" data-sound="off">🔇</button>
      <button class="music-toggle tool-control" type="button" title="music: Focus loop" aria-label="Change music mode" data-music="focus">♪</button>
      <button class="tool-control" type="button" title="change persona" aria-label="Change persona" data-persona-button>🏁</button>
    </div>

    <div class="joystick" role="group" aria-label="Movement joystick. Drag to move; WASD also works." data-joystick>
      <span class="joystick-key joystick-key-w">W</span>
      <span class="joystick-key joystick-key-a">A</span>
      <span class="joystick-key joystick-key-s">S</span>
      <span class="joystick-key joystick-key-d">D</span>
      <span class="joystick-knob" aria-hidden="true"></span>
    </div>

    <div class="movement-actions" aria-label="Movement actions">
      <button type="button" data-control="sprint">Shift</button>
      <button type="button" data-control="jump">Space</button>
      <button type="button" data-control="inspect">E</button>
    </div>

    <div class="modal-layer" hidden></div>
  `;
  root.appendChild(hud);

  const progressPill = hud.querySelector<HTMLButtonElement>(".progress-pill")!;
  const progressText = hud.querySelector<HTMLElement>(".progress-text")!;
  const prompt = hud.querySelector<HTMLElement>(".action-prompt")!;
  const proximityCard = hud.querySelector<HTMLElement>(".proximity-card")!;
  const proximityTitle = hud.querySelector<HTMLElement>(".proximity-title")!;
  const proximityMeta = hud.querySelector<HTMLElement>(".proximity-meta")!;
  const proximityClue = hud.querySelector<HTMLElement>(".proximity-clue")!;
  const proximityPersona = hud.querySelector<HTMLElement>(".proximity-persona")!;
  const proximityStatus = hud.querySelector<HTMLElement>(".proximity-status")!;
  const toast = hud.querySelector<HTMLElement>(".discovery-toast")!;
  const toastTitle = hud.querySelector<HTMLElement>(".toast-title")!;
  const toastMeta = hud.querySelector<HTMLElement>(".toast-meta")!;
  const toastSignal = hud.querySelector<HTMLElement>(".toast-signal")!;
  const waypoint = hud.querySelector<HTMLElement>(".waypoint-card")!;
  const waypointTitle = hud.querySelector<HTMLElement>(".waypoint-title")!;
  const waypointMeta = hud.querySelector<HTMLElement>(".waypoint-meta")!;
  const waypointClue = hud.querySelector<HTMLElement>(".waypoint-clue")!;
  const waypointAction = hud.querySelector<HTMLElement>(".waypoint-action")!;
  const townMap = hud.querySelector<HTMLButtonElement>(".town-map")!;
  const townMapGrid = hud.querySelector<HTMLElement>(".town-map-grid")!;
  const townMapCaption = hud.querySelector<HTMLElement>(".town-map-caption")!;
  const modalLayer = hud.querySelector<HTMLElement>(".modal-layer")!;
  const soundButton = hud.querySelector<HTMLButtonElement>("[data-sound]")!;
  const musicButton = hud.querySelector<HTMLButtonElement>("[data-music]")!;
  const personaButton = hud.querySelector<HTMLButtonElement>("[data-persona-button]")!;
  const zoomOutButton = hud.querySelector<HTMLButtonElement>("[data-camera-zoom=\"out\"]")!;
  const zoomInButton = hud.querySelector<HTMLButtonElement>("[data-camera-zoom=\"in\"]")!;
  const toolDock = hud.querySelector<HTMLElement>("[data-tool-dock]")!;
  const toolsToggle = hud.querySelector<HTMLButtonElement>("[data-tools-toggle]")!;
  let selectedPersonaIndex = 0;
  let soundEnabled = false;
  let musicModeIndex = 0;
  let toastTimer: number | undefined;
  let activeWaypointId: string | null = "welcome";
  let activeWaypointTracked = false;
  let activeCardCloseHandler: (() => void) | undefined;
  const audio = createAmbientAudio();

  const openModal = (content: string) => {
    activeCardCloseHandler = undefined;
    prompt.hidden = true;
    proximityCard.hidden = true;
    modalLayer.innerHTML = content;
    modalLayer.removeAttribute("hidden");
    modalLayer.style.display = "grid";
    hud.classList.add("modal-open");
  };

  const closeModal = () => {
    modalLayer.innerHTML = "";
    modalLayer.setAttribute("hidden", "");
    modalLayer.style.display = "none";
    hud.classList.remove("modal-open");
  };

  const hideToast = () => {
    window.clearTimeout(toastTimer);
    hud.classList.remove("toast-active");
    toast.classList.remove("show");
    toast.classList.remove("milestone");
    toast.hidden = true;
  };

  const selectPersona = (index: number) => {
    selectedPersonaIndex = index;
    const persona = PERSONAS[selectedPersonaIndex] ?? PERSONAS[0];
    personaButton.textContent = persona.emoji;
    personaButton.title = `persona: ${persona.name}`;
    personaButton.dataset.persona = persona.id;
    proximityPersona.textContent = `${persona.emoji} ${persona.name} · ${persona.trait}`;
    hud.dataset.selectedPersona = persona.id;
    hud.dataset.personaTrait = persona.trait;
    options.onPersonaChange?.(persona);
  };

  const setSoundEnabled = (enabled: boolean) => {
    soundEnabled = enabled && audio.supported;
    hud.dataset.audioState = soundEnabled ? "on" : "off";
    soundButton.dataset.sound = soundEnabled ? "on" : "off";
    soundButton.textContent = soundEnabled ? "🔊" : "🔇";
    soundButton.title = soundEnabled ? "sound on" : "sound off";
    soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    soundButton.classList.toggle("active", soundEnabled);
    void audio.setEnabled(soundEnabled);
  };

  const setMusicMode = (index: number) => {
    musicModeIndex = (index + MUSIC_MODES.length) % MUSIC_MODES.length;
    const mode = MUSIC_MODES[musicModeIndex];
    hud.dataset.musicMode = mode.id;
    musicButton.dataset.music = mode.id;
    musicButton.textContent = mode.icon;
    musicButton.title = `music: ${mode.label}`;
    musicButton.setAttribute("aria-label", `Change music mode. Current: ${mode.label}`);
    audio.setMode(mode);
  };

  const renderPersonaOptions = () =>
    PERSONAS
      .map(
        (persona, index) => `
          <button
            class="persona-option ${index === selectedPersonaIndex ? "selected" : ""}"
            type="button"
            data-persona-index="${index}"
            data-persona-id="${persona.id}"
            aria-pressed="${index === selectedPersonaIndex}"
          >
            <span class="persona-emoji">${persona.emoji}</span>
            <span class="persona-swatch" style="--persona-shirt:${persona.colors.shirt}; --persona-trim:${persona.colors.trim}; --persona-pants:${persona.colors.pants};"></span>
            <strong>${persona.name}</strong>
            <span>${persona.caption}</span>
            <em>${persona.trait}</em>
          </button>
        `
      )
      .join("");

  const renderIntroRoutePreview = () => {
    const route = ["welcome", "operator-bench", "agentic-lab"]
      .map((id) => DISCOVERIES.find((entry) => entry.id === id))
      .filter((entry): entry is DiscoveryEntry => Boolean(entry));
    const firstMilestone = MOMENTUM_MILESTONES[0];

    return `
      <section class="intro-mission" aria-label="Starter route">
        <div class="intro-mission-topline">
          <span>Starter route</span>
          <strong>${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target} shipped</strong>
        </div>
        <ol class="intro-route">
          ${route
            .map((entry, index) => {
              const theme = THEME_META[entry.theme];
              return `
                <li style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};">
                  <b>${index === 0 ? "start" : `0${index + 1}`}</b>
                  <span>
                    <strong>${entry.title}</strong>
                    <small>${entry.clue}</small>
                  </span>
                </li>
              `;
            })
            .join("")}
        </ol>
        <div class="intro-checkpoint">
          <span>First checkpoint</span>
          <strong>${firstMilestone.label}</strong>
          <small>${firstMilestone.action}</small>
        </div>
      </section>
    `;
  };

  const bindPersonaSelection = () => {
    modalLayer.querySelectorAll<HTMLButtonElement>("[data-persona-index]").forEach((button) => {
      button.addEventListener("click", () => {
        selectPersona(Number(button.dataset.personaIndex ?? selectedPersonaIndex));
        modalLayer.querySelectorAll<HTMLButtonElement>("[data-persona-index]").forEach((option) => {
          const selected = Number(option.dataset.personaIndex) === selectedPersonaIndex;
          option.classList.toggle("selected", selected);
          option.setAttribute("aria-pressed", String(selected));
        });
      });
    });
  };

  const renderMapDots = (discovered: Set<string>, className: string) =>
    DISCOVERIES.map((entry) => {
      const x = ((entry.position.x - MAP_MIN) / MAP_SIZE) * 100;
      const y = ((entry.position.z - MAP_MIN) / MAP_SIZE) * 100;
      const unlocked = discovered.has(entry.id);
      const active = activeWaypointId === entry.id;
      const tracked = active && activeWaypointTracked && !unlocked;
      return `
        <span
          class="${className} ${unlocked ? "unlocked" : ""} ${active ? "active" : ""} ${tracked ? "tracked" : ""}"
          style="left:${x.toFixed(2)}%; top:${y.toFixed(2)}%;"
          title="${escapeHtml(entry.title)}"
        ></span>
      `;
    }).join("");

  const renderTownMap = (discovered: Set<string>) => {
    townMapGrid.innerHTML = renderMapDots(discovered, "town-map-dot");
    townMapCaption.textContent = `${discovered.size}/${DISCOVERIES.length} found`;
  };

  const openPersona = () => {
    openModal(`
      <section class="modal persona-modal">
        <h2>Choose your wanderer</h2>
        <div class="persona-grid">
          ${renderPersonaOptions()}
        </div>
        <button class="primary-action" type="button" data-close>Done</button>
      </section>
    `);
    bindPersonaSelection();
    modalLayer.querySelector("[data-close]")?.addEventListener("click", closeModal);
  };

  personaButton.addEventListener("click", openPersona);
  toolsToggle.addEventListener("click", () => {
    const expanded = toolDock.classList.toggle("expanded");
    toolsToggle.setAttribute("aria-expanded", String(expanded));
    toolsToggle.setAttribute("aria-label", expanded ? "Close view and sound controls" : "Open view and sound controls");
  });
  zoomOutButton.addEventListener("click", () => options.onCameraZoom?.(1.6));
  zoomInButton.addEventListener("click", () => options.onCameraZoom?.(-1.6));
  soundButton.addEventListener("click", () => setSoundEnabled(!soundEnabled));
  musicButton.addEventListener("click", () => {
    setMusicMode(musicModeIndex + 1);
    if (soundEnabled) audio.ping(440 + musicModeIndex * 110);
  });
  setMusicMode(musicModeIndex);
  setSoundEnabled(false);
  selectPersona(selectedPersonaIndex);

  let currentDiscovered = new Set<string>();
  progressPill.addEventListener("click", () => api.openJournal(currentDiscovered));
  townMap.addEventListener("click", () => api.openJournal(currentDiscovered));
  renderTownMap(currentDiscovered);

  const renderDiscoveryCard = (entry: DiscoveryEntry) => {
    const theme = THEME_META[entry.theme];
    const chapterSeed = getChapterSeed(entry);
    const currentIndex = DISCOVERIES.findIndex((item) => item.id === entry.id);
    const activeRouteEntry = activeWaypointId
      ? DISCOVERIES.find((item) => item.id === activeWaypointId && !currentDiscovered.has(item.id) && item.id !== entry.id)
      : undefined;
    const nextEntry =
      activeRouteEntry ??
      DISCOVERIES.slice(currentIndex + 1).find((item) => !currentDiscovered.has(item.id)) ??
      DISCOVERIES.find((item) => !currentDiscovered.has(item.id) && item.id !== entry.id);
    const nextTheme = nextEntry ? THEME_META[nextEntry.theme] : undefined;
    const nextRouteLabel = activeRouteEntry ? (activeWaypointTracked ? "Continue tracked route" : "Continue current route") : "Track next clue";
    return `
      <article class="modal discovery-card" style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};">
        <button class="card-close" type="button" aria-label="Close" data-close>×</button>
        <div class="card-icon">${themeIcon(entry.theme)}</div>
        <h2>${entry.number ? `#${entry.number.toString().padStart(3, "0")} ` : ""}${entry.title}</h2>
        <p class="district">${entry.district}</p>
        ${renderArtifactPanel(entry)}
        ${
          nextEntry && nextTheme
            ? `
              <button
                class="card-next-route"
                type="button"
                data-card-track-next="${nextEntry.id}"
                style="--artifact-accent:${nextTheme.accent}; --artifact-tint:${nextTheme.tint};"
              >
                <span>${nextRouteLabel}</span>
                <strong>${nextEntry.number ? `#${nextEntry.number.toString().padStart(3, "0")} ` : ""}${nextEntry.title}</strong>
                <small>${nextEntry.clue}</small>
              </button>
            `
            : `
              <div class="card-next-route complete">
                <span>Archive route complete</span>
                <strong>All current town stories are saved.</strong>
              </div>
            `
        }
        <section class="chapter-seed" aria-label="Book chapter seed">
          <div class="chapter-seed-topline">
            <span>Book chapter seed</span>
            <strong>${theme.signal}</strong>
          </div>
          <p>${chapterSeed.hook}</p>
          <dl>
            <dt>Founder question</dt>
            <dd>${chapterSeed.question}</dd>
            <dt>Asset to extract</dt>
            <dd>${chapterSeed.asset}</dd>
          </dl>
          <button
            class="chapter-copy"
            type="button"
            data-copy-chapter-seed="${entry.id}"
            data-copy-label="Copy chapter seed"
            data-copy-detail="ready for notes or a book draft"
          >
            <span>Copy chapter seed</span>
            <strong>ready for notes or a book draft</strong>
          </button>
        </section>
        <dl>
          <dt>Built</dt>
          <dd>${entry.built}</dd>
          <dt>Result</dt>
          <dd>${entry.result}</dd>
          <dt>Lesson</dt>
          <dd>${entry.lesson}</dd>
          <dt>Operator insight</dt>
          <dd>${entry.operatorInsight}</dd>
          <dt>Business angle</dt>
          <dd>${entry.businessAngle}</dd>
          <dt>Next clue</dt>
          <dd>${entry.nextClue}</dd>
        </dl>
        <div class="card-hint">Space or E to close</div>
      </article>
    `;
  };

  const renderJournalRow = (entry: DiscoveryEntry, discovered: Set<string>) => {
    const unlocked = discovered.has(entry.id);
    const tracking = !unlocked && activeWaypointTracked && activeWaypointId === entry.id;
    const theme = THEME_META[entry.theme];
    const content = `
      <span class="journal-mark">${unlocked ? "✦" : tracking ? "◆" : "✧"}</span>
      <div class="journal-entry-copy">
        <strong>${entry.number ? `#${entry.number.toString().padStart(3, "0")} ` : ""}${unlocked ? entry.title : "???"}</strong>
        <small>${unlocked ? `${entry.district} · ${theme.label}` : entry.clue}</small>
        ${
          unlocked
            ? `<em class="journal-chip" style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};">${theme.signal}</em>
               <span class="journal-chapter-note">chapter seed: ${getChapterSeed(entry).question}</span>`
            : ""
        }
      </div>
      <span class="journal-open-indicator" aria-hidden="true">${unlocked ? "Read" : tracking ? "Tracked" : "Track"}</span>
    `;

    if (!unlocked) {
      return `
        <li class="locked ${tracking ? "tracking" : ""}">
          <button
            class="journal-row journal-row-button journal-track-button ${tracking ? "tracking" : ""}"
            type="button"
            data-track-entry="${entry.id}"
            style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};"
            aria-label="Track ${escapeHtml(entry.clue)}"
          >
            ${content}
          </button>
        </li>
      `;
    }

    return `
      <li class="unlocked">
        <button
          class="journal-row journal-row-button"
          type="button"
          data-journal-entry="${entry.id}"
          style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};"
          aria-label="Open ${escapeHtml(entry.title)} story"
        >
          ${content}
        </button>
      </li>
    `;
  };

  const getThemeProgress = (discovered: Set<string>) =>
    (Object.keys(THEME_META) as DiscoveryEntry["theme"][]).map((theme) => {
      const entries = DISCOVERIES.filter((entry) => entry.theme === theme);
      const unlocked = entries.filter((entry) => discovered.has(entry.id)).length;
      return {
        theme,
        meta: THEME_META[theme],
        total: entries.length,
        unlocked
      };
    });

  const renderJournalInsights = (discovered: Set<string>) => {
    const completion = Math.round((discovered.size / DISCOVERIES.length) * 100);
    const nextEntry = DISCOVERIES.find((entry) => !discovered.has(entry.id));
    const milestone = getMomentumMilestone(discovered.size);
    const unlockedThemes = getThemeProgress(discovered).filter((item) => item.unlocked > 0);
    const opportunitySignals = getOpportunitySignals(discovered);
    const strongestTheme =
      unlockedThemes.sort((a, b) => b.unlocked / b.total - a.unlocked / a.total)[0]?.meta.label ?? "First signal";

    return `
      <section class="journal-insights" data-journal-insights>
        <div class="journal-insight-grid">
          <span>
            <b>${completion}%</b>
            <small>archive mapped</small>
          </span>
          <span>
            <b>${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target}</b>
            <small>hackathon arc</small>
          </span>
          <span>
            <b>${strongestTheme}</b>
            <small>strongest signal</small>
          </span>
        </div>
        <div class="journal-next-gap">
          <small>Next strategic gap</small>
          <strong>${nextEntry ? `${THEME_META[nextEntry.theme].label}: ${nextEntry.clue}` : "Archive loop complete"}</strong>
        </div>
        <section class="momentum-milestone ${milestone.unlocked ? "unlocked" : ""}" aria-label="Momentum milestone">
          <div class="momentum-milestone-topline">
            <span>${milestone.unlocked ? "Milestone unlocked" : "Next milestone"}</span>
            <strong>${Math.min(discovered.size, milestone.item.target)}/${milestone.item.target}</strong>
          </div>
          <span class="momentum-meter" style="--momentum-progress:${milestone.progress}%"><i></i></span>
          <h3>${milestone.item.label}</h3>
          <p>${milestone.item.outcome}</p>
          <small>${milestone.item.action}</small>
        </section>
        <section class="opportunity-board" aria-label="Opportunity board">
          <div class="opportunity-board-topline">
            <span>Opportunity board</span>
            <strong>${discovered.size ? `${discovered.size} live signal${discovered.size === 1 ? "" : "s"}` : "unlock first signal"}</strong>
          </div>
          <div class="opportunity-grid">
            ${opportunitySignals
              .map((signal) => {
                const theme = THEME_META[signal.entry.theme];
                return `
                  <article
                    class="opportunity-card ${signal.preview ? "preview" : ""}"
                    style="--artifact-accent:${theme.accent}; --artifact-tint:${theme.tint};"
                  >
                    <span>${signal.label}</span>
                    <strong>${signal.preview ? signal.entry.clue : signal.entry.title}</strong>
                    <p>${signal.entry.businessAngle}</p>
                    <small>${signal.action}</small>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
        <button class="brief-launch" type="button" data-open-brief>
          <span>Open operator brief</span>
          <strong>${discovered.size ? "turn proof into next moves" : "start with the first proof"}</strong>
        </button>
        <div class="journal-theme-bars" aria-label="Theme coverage">
          ${getThemeProgress(discovered)
            .map(
              (item) => `
                <span style="--artifact-accent:${item.meta.accent}; --artifact-tint:${item.meta.tint}; --theme-progress:${(item.unlocked / item.total) * 100}%">
                  <b>${item.meta.signal}</b>
                  <i></i>
                  <em>${item.unlocked}/${item.total}</em>
                </span>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  };

  const renderOperatorBrief = (discovered: Set<string>) => {
    const brief = getOperatorBrief(discovered);
    const proofTheme = THEME_META[brief.proofEntry.theme];
    const nextTheme = brief.nextEntry ? THEME_META[brief.nextEntry.theme] : undefined;

    return `
      <article class="modal operator-brief-modal" style="--artifact-accent:${proofTheme.accent}; --artifact-tint:${proofTheme.tint};">
        <button class="card-close" type="button" aria-label="Close" data-close>×</button>
        <span class="brief-kicker">Operator brief</span>
        <h2>${brief.primarySignal}</h2>
        <p class="brief-thesis">${brief.thesis}</p>
        <div class="brief-metrics">
          <span>
            <b>${brief.completion}%</b>
            <small>archive mapped</small>
          </span>
          <span>
            <b>${brief.signals.filter((signal) => !signal.preview).length}/3</b>
            <small>live signals</small>
          </span>
          <span>
            <b>${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target}</b>
            <small>hackathon arc</small>
          </span>
        </div>
        <section class="brief-proof">
          <small>Proof asset</small>
          <strong>${brief.proofEntry.title}</strong>
          <p>${brief.proofEntry.businessAngle}</p>
        </section>
        <section class="brief-moves" aria-label="Recommended next moves">
          ${brief.moves
            .map(
              (move, index) => `
                <span>
                  <b>${(index + 1).toString().padStart(2, "0")}</b>
                  <em>${move}</em>
                </span>
              `
            )
            .join("")}
        </section>
        ${
          brief.nextEntry && nextTheme
            ? `
              <button
                class="brief-track"
                type="button"
                data-brief-track-next="${brief.nextEntry.id}"
                style="--artifact-accent:${nextTheme.accent}; --artifact-tint:${nextTheme.tint};"
              >
                <span>Track next clue</span>
                <strong>${brief.nextEntry.number ? `#${brief.nextEntry.number.toString().padStart(3, "0")} ` : ""}${brief.nextEntry.title}</strong>
                <small>${brief.nextEntry.clue}</small>
              </button>
            `
            : `
              <div class="brief-track complete">
                <span>Archive route complete</span>
                <strong>Every current story is already in the journal.</strong>
              </div>
            `
        }
        <button
          class="brief-copy"
          type="button"
          data-brief-copy
          data-copy-label="Copy operator brief"
          data-copy-detail="ready for notes, posts, or chapter drafts"
        >
          <span>Copy operator brief</span>
          <strong>ready for notes, posts, or chapter drafts</strong>
        </button>
        <button class="secondary-action" type="button" data-brief-back>Back to journal</button>
      </article>
    `;
  };

  const openOperatorBrief = (discovered: Set<string>) => {
    openModal(renderOperatorBrief(discovered));
    modalLayer.querySelector("[data-close]")?.addEventListener("click", closeModal);
    modalLayer.querySelector("[data-brief-back]")?.addEventListener("click", () => api.openJournal(discovered));
    modalLayer.querySelector<HTMLButtonElement>("[data-brief-copy]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const copyText = formatOperatorBriefText(discovered);
      const copied = await copyTextToClipboard(copyText);
      flashCopyButton(button, copied);
      if (!copied) showManualCopyPanel(button, copyText);
    });
    modalLayer.querySelector<HTMLButtonElement>("[data-brief-track-next]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const nextEntry = DISCOVERIES.find((entry) => entry.id === button.dataset.briefTrackNext);
      if (!nextEntry) return;
      options.onWaypointSelect?.(nextEntry);
      closeModal();
    });
  };

  const api: HudApi = {
    setPrompt(entry) {
      prompt.hidden = !entry;
      prompt.querySelector("span")!.textContent = entry ? `Space or E to read ${entry.title}` : "Space or E to read";
      proximityCard.hidden = !entry;
      hud.classList.toggle("proximity-active", Boolean(entry));
      if (!entry) return;

      const theme = THEME_META[entry.theme];
      const unlocked = currentDiscovered.has(entry.id);
      proximityCard.style.setProperty("--artifact-accent", theme.accent);
      proximityCard.style.setProperty("--artifact-tint", theme.tint);
      proximityCard.classList.toggle("unlocked", unlocked);
      proximityTitle.textContent = entry.number ? `#${entry.number.toString().padStart(3, "0")} ${entry.title}` : entry.title;
      proximityMeta.textContent = `${entry.district} · ${theme.signal}`;
      proximityClue.textContent = entry.clue;
      proximityStatus.textContent = unlocked ? "Saved in journal · E to reopen" : "New signal nearby · E to save";
    },
    setProgress(discovered) {
      currentDiscovered = discovered;
      progressText.textContent = formatProgress(discovered);
      renderTownMap(discovered);
    },
    openCard(entry, onClose) {
      openModal(renderDiscoveryCard(entry));
      activeCardCloseHandler = onClose;
      modalLayer.querySelector("[data-close]")?.addEventListener("click", api.closeCard);
      modalLayer.querySelector<HTMLButtonElement>("[data-card-track-next]")?.addEventListener("click", (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const nextEntry = DISCOVERIES.find((item) => item.id === button.dataset.cardTrackNext);
        if (!nextEntry) return;
        options.onWaypointSelect?.(nextEntry);
        api.closeCard();
      });
      modalLayer.querySelector<HTMLButtonElement>("[data-copy-chapter-seed]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const seedEntry = DISCOVERIES.find((item) => item.id === button.dataset.copyChapterSeed);
        if (!seedEntry) return;
        const copyText = formatChapterSeedText(seedEntry);
        const copied = await copyTextToClipboard(copyText);
        flashCopyButton(button, copied);
        if (!copied) showManualCopyPanel(button, copyText);
      });
    },
    closeCard() {
      const closeHandler = activeCardCloseHandler;
      activeCardCloseHandler = undefined;
      closeModal();
      closeHandler?.();
    },
    isModalOpen() {
      return !modalLayer.hasAttribute("hidden");
    },
    openIntro(onStart) {
      openModal(`
        <section class="modal intro-modal">
          <div class="modal-emoji">🏘️</div>
          <h2>Welcome to Hackathoner Loop Town</h2>
          <p>
            A tiny town built out of Sayyid's hackathons, experiments, and operator lessons.
            Wander around - every glowing marker is a story to turn into leverage.
          </p>
          ${renderIntroRoutePreview()}
          <p class="choose-label">choose your wanderer:</p>
          <div class="persona-grid intro-personas">
            ${renderPersonaOptions()}
          </div>
          <div class="walk-hint">
            WASD or arrows to walk · hold shift to jog · drag to look around · scroll or pinch to zoom · space or E to read
          </div>
          <button class="primary-action" type="button" data-start>Start the proof walk</button>
        </section>
      `);
      bindPersonaSelection();
      modalLayer.querySelector("[data-start]")?.addEventListener("click", () => {
        closeModal();
        onStart();
      });
    },
    openPersona,
    openJournal(discovered) {
      hideToast();
      openModal(`
        <section class="modal journal-modal">
          <h2>Discovery Journal</h2>
          <p class="journal-summary">${discovered.size}/${DISCOVERIES.length} town stories found · ${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target} hackathons shipped</p>
          ${renderJournalInsights(discovered)}
          <section class="journal-map" aria-label="Discovery map">
            <div class="journal-map-grid">
              ${renderMapDots(discovered, "journal-map-dot")}
            </div>
            <div class="journal-map-legend">
              <span><i class="legend-dot unlocked"></i> found</span>
              <span><i class="legend-dot ${activeWaypointTracked ? "tracked" : "active"}"></i> ${activeWaypointTracked ? "tracked" : "next"}</span>
              <span><i class="legend-dot"></i> locked</span>
            </div>
          </section>
          <ol class="journal-list">
            ${DISCOVERIES.map((entry) => renderJournalRow(entry, discovered)).join("")}
          </ol>
          <button class="primary-action" type="button" data-close>Back to town</button>
        </section>
      `);
      modalLayer.querySelector("[data-close]")?.addEventListener("click", closeModal);
      modalLayer.querySelector("[data-open-brief]")?.addEventListener("click", () => openOperatorBrief(discovered));
      modalLayer.querySelectorAll<HTMLButtonElement>("[data-journal-entry]").forEach((button) => {
        button.addEventListener("click", () => {
          const entry = DISCOVERIES.find((item) => item.id === button.dataset.journalEntry);
          if (!entry) return;
          api.openCard(entry, () => api.openJournal(discovered));
        });
      });
      modalLayer.querySelectorAll<HTMLButtonElement>("[data-track-entry]").forEach((button) => {
        button.addEventListener("click", () => {
          const entry = DISCOVERIES.find((item) => item.id === button.dataset.trackEntry);
          if (!entry) return;
          options.onWaypointSelect?.(entry);
          closeModal();
        });
      });
    },
    setWaypoint(entry, distance = 0, heading = "center", tracked = false) {
      if (!entry) {
        activeWaypointId = null;
        activeWaypointTracked = false;
        waypointTitle.textContent = "Archive loop complete";
        waypointMeta.textContent = `${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target} shipped`;
        waypointClue.textContent = "All current town stories are in the journal.";
        waypointAction.textContent = "Turn the archive into a public proof index";
        waypoint.classList.add("complete");
        waypoint.classList.remove("tracked");
        waypoint.classList.remove("arrived");
        waypoint.style.setProperty("--route-progress", "100%");
        waypoint.querySelector<HTMLElement>(".waypoint-label")!.textContent = "Next story";
        renderTownMap(currentDiscovered);
        return;
      }

      const roundedDistance = Math.max(0, Math.round(distance));
      const routeProgress = Math.round((1 - Math.min(distance / 18, 1)) * 100);
      const arrived = distance <= 2.7;
      activeWaypointId = entry.id;
      activeWaypointTracked = tracked;
      waypoint.classList.remove("complete");
      waypoint.classList.toggle("tracked", tracked);
      waypoint.classList.toggle("arrived", arrived);
      waypoint.style.setProperty("--route-progress", `${routeProgress}%`);
      waypoint.querySelector<HTMLElement>(".waypoint-label")!.textContent = tracked ? "Tracked story" : "Next story";
      waypointTitle.textContent = entry.title;
      waypointMeta.textContent = `${heading} · ${roundedDistance}m`;
      waypointClue.textContent = entry.clue;
      waypointAction.textContent = arrived
        ? "Arrived - press E to save"
        : tracked
          ? "Follow the gold route"
          : "Follow the nearest signal";
      renderTownMap(currentDiscovered);
    },
    showDiscoveryToast(entry, discoveredCount) {
      const theme = THEME_META[entry.theme];
      const chapterSeed = getChapterSeed(entry);
      const unlockedMilestone = MOMENTUM_MILESTONES.find((item) => item.target === discoveredCount);
      audio.ping(620 + Math.min(discoveredCount, 12) * 18);
      window.clearTimeout(toastTimer);
      toast.style.setProperty("--artifact-accent", theme.accent);
      toast.style.setProperty("--artifact-tint", theme.tint);
      toast.classList.toggle("milestone", Boolean(unlockedMilestone));
      toastTitle.textContent = `Saved: ${entry.title}`;
      toastMeta.textContent = unlockedMilestone
        ? `Milestone unlocked · ${unlockedMilestone.label}`
        : `${theme.signal} · ${discoveredCount}/${DISCOVERIES.length} found`;
      toastSignal.textContent = unlockedMilestone
        ? unlockedMilestone.action
        : chapterSeed.question;
      toast.hidden = false;
      hud.classList.add("toast-active");
      toast.classList.remove("show");
      requestAnimationFrame(() => toast.classList.add("show"));
      toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
        window.setTimeout(() => {
          toast.hidden = true;
          hud.classList.remove("toast-active");
          toast.classList.remove("milestone");
        }, 220);
      }, 2600);
    }
  };

  return api;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return replacements[character];
  });
}

function renderArtifactPanel(entry: DiscoveryEntry): string {
  const theme = THEME_META[entry.theme];
  const stats = getArtifactStats(entry);
  return `
    <section class="artifact-panel" aria-label="Artifact summary">
      <div class="artifact-topline">
        <span>${theme.label}</span>
        <strong>${theme.signal}</strong>
      </div>
      <div class="artifact-visual" aria-hidden="true">
        <span class="artifact-core">${entry.number ? entry.number.toString().padStart(2, "0") : "00"}</span>
        <i></i><i></i><i></i>
      </div>
      <div class="artifact-stats">
        ${stats
          .map(
            (stat) => `
              <span>
                <b>${stat.label}</b>
                <i style="--meter:${stat.value}%"></i>
                <em>${stat.value}</em>
              </span>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function getChapterSeed(entry: DiscoveryEntry): ChapterSeed {
  const questionByTheme: Record<DiscoveryEntry["theme"], string> = {
    "ai-agents": "Which repeated operating loop is painful enough to automate before it becomes a product?",
    saas: "Who would pay for the smallest useful version of this workflow this month?",
    sustainability: "Which operational metric turns the mission into a buyer's urgent decision?",
    crypto: "Where does ownership, settlement, or provenance create value that normal software cannot?",
    devtools: "Which repeated developer friction can be reduced so clearly that the demo sells itself?",
    founder: "What decision rule would make the next sprint sharper than the last one?",
    story: "What scene, tension, or proof would make this chapter useful to another builder?"
  };

  const hookByTheme: Record<DiscoveryEntry["theme"], string> = {
    "ai-agents": `A chapter on turning ${entry.title} from a demo into an operating loop.`,
    saas: `A chapter on forcing ${entry.title} to answer buyer, wedge, and distribution.`,
    sustainability: `A chapter on translating ${entry.title} into measurable operational value.`,
    crypto: `A chapter on separating ${entry.title} from hype and finding the trust primitive.`,
    devtools: `A chapter on using ${entry.title} to remove repeated cognitive load for builders.`,
    founder: `A chapter on how ${entry.title} changes the builder-to-operator transition.`,
    story: `A chapter on turning ${entry.title} into reusable proof, not just memory.`
  };

  return {
    hook: hookByTheme[entry.theme],
    question: questionByTheme[entry.theme],
    asset: entry.businessAngle
  };
}

function getMomentumMilestone(discoveredCount: number): {
  item: MomentumMilestone;
  progress: number;
  unlocked: boolean;
} {
  const next = MOMENTUM_MILESTONES.find((milestone) => discoveredCount < milestone.target);
  const item = next ?? MOMENTUM_MILESTONES[MOMENTUM_MILESTONES.length - 1];
  const progress = next ? Math.round((discoveredCount / item.target) * 100) : 100;

  return {
    item,
    progress: Math.max(0, Math.min(100, progress)),
    unlocked: discoveredCount >= item.target
  };
}

function getOpportunitySignals(discovered: Set<string>): OpportunitySignal[] {
  const unlocked = DISCOVERIES.filter((entry) => discovered.has(entry.id));
  const locked = DISCOVERIES.filter((entry) => !discovered.has(entry.id));
  const used = new Set<string>();
  const slots: Array<{
    label: string;
    themes: DiscoveryEntry["theme"][];
    action: string;
  }> = [
    {
      label: "Paid wedge",
      themes: ["saas", "founder", "devtools"],
      action: "Package the repeated pain into a paid workflow."
    },
    {
      label: "Distribution asset",
      themes: ["story", "devtools", "founder"],
      action: "Turn the proof into a chapter, post, or warm intro."
    },
    {
      label: "Operating loop",
      themes: ["ai-agents", "sustainability", "crypto"],
      action: "Extract the checklist, template, or agent behind it."
    }
  ];

  return slots.map((slot) => {
    const unlockedMatch =
      unlocked.find((entry) => slot.themes.includes(entry.theme) && !used.has(entry.id)) ??
      unlocked.find((entry) => !used.has(entry.id));
    const previewMatch =
      locked.find((entry) => slot.themes.includes(entry.theme) && !used.has(entry.id)) ??
      locked.find((entry) => !used.has(entry.id)) ??
      DISCOVERIES.find((entry) => !used.has(entry.id)) ??
      DISCOVERIES[0];
    const entry = unlockedMatch ?? previewMatch;
    used.add(entry.id);

    return {
      label: slot.label,
      entry,
      action: slot.action,
      preview: !discovered.has(entry.id)
    };
  });
}

function getOperatorBrief(discovered: Set<string>): OperatorBrief {
  const completion = Math.round((discovered.size / DISCOVERIES.length) * 100);
  const signals = getOpportunitySignals(discovered);
  const unlocked = DISCOVERIES.filter((entry) => discovered.has(entry.id));
  const liveSignal = signals.find((signal) => !signal.preview);
  const proofEntry = liveSignal?.entry ?? unlocked[0] ?? DISCOVERIES[0];
  const nextEntry =
    signals.find((signal) => signal.preview)?.entry ??
    DISCOVERIES.find((entry) => !discovered.has(entry.id));
  const primarySignal = discovered.size ? THEME_META[proofEntry.theme].label : "First proof loop";
  const thesis = discovered.size
    ? `${proofEntry.title} is the current proof point: ${proofEntry.businessAngle}`
    : `Start by saving ${proofEntry.title}; the portfolio becomes stronger when every story produces a reusable asset.`;
  const moves = [
    `Turn ${proofEntry.title} into a short case study with problem, constraint, demo, and buyer angle.`,
    liveSignal?.action ?? "Save the first story, then extract the smallest repeatable operating loop.",
    nextEntry
      ? `Track ${nextEntry.title} next to widen the signal map.`
      : "Convert the completed archive into a public proof-of-work index."
  ];

  return {
    completion,
    primarySignal,
    thesis,
    proofEntry,
    nextEntry,
    moves,
    signals
  };
}

function formatOperatorBriefText(discovered: Set<string>): string {
  const brief = getOperatorBrief(discovered);
  const proofTheme = THEME_META[brief.proofEntry.theme];
  const milestone = getMomentumMilestone(discovered.size);
  const nextLine = brief.nextEntry
    ? `Next clue: ${brief.nextEntry.number ? `#${brief.nextEntry.number.toString().padStart(3, "0")} ` : ""}${brief.nextEntry.title} - ${brief.nextEntry.clue}`
    : "Next clue: Archive route complete.";

  return [
    "The 100 Hackathoner - Operator Brief",
    `Progress: ${brief.completion}% archive mapped (${discovered.size}/${DISCOVERIES.length} stories)`,
    `Primary signal: ${brief.primarySignal} / ${proofTheme.signal}`,
    "",
    "Thesis",
    brief.thesis,
    "",
    "Momentum milestone",
    `${milestone.unlocked ? "Unlocked" : "Next"}: ${milestone.item.label} (${Math.min(discovered.size, milestone.item.target)}/${milestone.item.target})`,
    `Outcome: ${milestone.item.outcome}`,
    `Action: ${milestone.item.action}`,
    "",
    "Proof asset",
    `Title: ${brief.proofEntry.title}`,
    `Built: ${brief.proofEntry.built}`,
    `Result: ${brief.proofEntry.result}`,
    `Operator insight: ${brief.proofEntry.operatorInsight}`,
    `Business angle: ${brief.proofEntry.businessAngle}`,
    "",
    "Opportunity board",
    ...brief.signals.map(
      (signal) =>
        `- ${signal.label}: ${signal.preview ? "preview" : "live"} - ${signal.entry.title}. ${signal.action}`
    ),
    "",
    "Next moves",
    ...brief.moves.map((move, index) => `${index + 1}. ${move}`),
    "",
    nextLine
  ].join("\n");
}

function formatChapterSeedText(entry: DiscoveryEntry): string {
  const theme = THEME_META[entry.theme];
  const chapterSeed = getChapterSeed(entry);

  return [
    `The 100 Hackathoner - Chapter Seed: ${entry.title}`,
    `Signal: ${theme.label} / ${theme.signal}`,
    "",
    "Hook",
    chapterSeed.hook,
    "",
    "Founder question",
    chapterSeed.question,
    "",
    "Asset to extract",
    chapterSeed.asset,
    "",
    "Source proof",
    `Built: ${entry.built}`,
    `Result: ${entry.result}`,
    `Lesson: ${entry.lesson}`,
    `Operator insight: ${entry.operatorInsight}`,
    `Next clue: ${entry.nextClue}`
  ].join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (copyTextWithSelection(text)) return true;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function copyTextWithSelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function flashCopyButton(button: HTMLButtonElement, copied: boolean): void {
  const label = button.querySelector("span");
  const detail = button.querySelector("strong");
  const originalLabel = button.dataset.copyLabel ?? label?.textContent ?? "Copy";
  const originalDetail = button.dataset.copyDetail ?? detail?.textContent ?? "";

  button.classList.toggle("copied", copied);
  button.classList.toggle("failed", !copied);
  if (label) label.textContent = copied ? "Copied" : "Text ready below";
  if (detail) detail.textContent = copied ? "pasted into your clipboard" : "select the fallback text and copy manually";

  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.classList.remove("copied", "failed");
    if (label) label.textContent = originalLabel;
    if (detail) detail.textContent = originalDetail;
  }, 1800);
}

function showManualCopyPanel(button: HTMLButtonElement, text: string): void {
  const parent = button.parentElement;
  if (!parent) return;

  parent.querySelector(".copy-fallback")?.remove();

  const panel = document.createElement("section");
  panel.className = "copy-fallback";
  panel.setAttribute("aria-label", "Manual copy text");

  const label = document.createElement("span");
  label.textContent = "Manual copy";

  const textarea = document.createElement("textarea");
  textarea.className = "copy-fallback-text";
  textarea.readOnly = true;
  textarea.value = text;
  textarea.setAttribute("aria-label", "Export text");

  panel.append(label, textarea);
  button.insertAdjacentElement("afterend", panel);
  textarea.focus();
  textarea.select();
}

function getArtifactStats(entry: DiscoveryEntry): Array<{ label: string; value: number }> {
  const baseByTheme: Record<DiscoveryEntry["theme"], [number, number, number]> = {
    "ai-agents": [86, 72, 94],
    saas: [78, 90, 74],
    sustainability: [74, 82, 78],
    crypto: [72, 76, 86],
    devtools: [82, 70, 88],
    founder: [88, 82, 80],
    story: [80, 86, 72]
  };
  const [leverage, market, system] = baseByTheme[entry.theme];
  const drift = (entry.number % 5) * 2;
  return [
    { label: "Leverage", value: Math.min(99, leverage + drift) },
    { label: "Market", value: Math.min(99, market + ((entry.number + 2) % 4) * 2) },
    { label: "System", value: Math.min(99, system + ((entry.number + 1) % 5) * 2) }
  ];
}

function createAmbientAudio(): {
  supported: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  setMode: (mode: MusicMode) => void;
  ping: (frequency: number) => void;
} {
  const AudioContextConstructor =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let lead: OscillatorNode | null = null;
  let harmony: OscillatorNode | null = null;
  let timer: number | undefined;
  let mode = MUSIC_MODES[0];
  let enabled = false;
  let step = 0;

  const ensureContext = async () => {
    if (!AudioContextConstructor) return null;
    if (!context) {
      context = new AudioContextConstructor();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);

      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 720;
      filter.connect(master);

      lead = context.createOscillator();
      lead.type = "sine";
      lead.frequency.value = mode.notes[0];
      lead.connect(filter);

      harmony = context.createOscillator();
      harmony.type = "triangle";
      harmony.frequency.value = mode.harmony[0];
      harmony.connect(filter);

      lead.start();
      harmony.start();
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  };

  const scheduleStep = () => {
    if (!context || !lead || !harmony) return;
    const now = context.currentTime;
    const noteIndex = step % mode.notes.length;
    lead.frequency.setTargetAtTime(mode.notes[noteIndex], now, 0.08);
    harmony.frequency.setTargetAtTime(mode.harmony[noteIndex], now, 0.12);
    step += 1;
  };

  const stopTimer = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  const startTimer = () => {
    stopTimer();
    scheduleStep();
    timer = window.setInterval(scheduleStep, mode.intervalMs);
  };

  return {
    supported: Boolean(AudioContextConstructor),
    async setEnabled(nextEnabled) {
      enabled = nextEnabled;
      if (!enabled && !context) return;
      const currentContext = await ensureContext();
      if (!currentContext || !master) return;
      const target = enabled ? mode.volume : 0;
      master.gain.setTargetAtTime(target, currentContext.currentTime, 0.1);
      if (enabled) startTimer();
      else stopTimer();
    },
    setMode(nextMode) {
      mode = nextMode;
      step = 0;
      if (enabled) startTimer();
    },
    ping(frequency) {
      if (!enabled || !context || !master) return;
      const now = context.currentTime;
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.26);
    }
  };
}

function formatProgress(discovered: Set<string>): string {
  return `${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target} shipped · ${discovered.size}/${DISCOVERIES.length} found`;
}

function themeIcon(theme: DiscoveryEntry["theme"]): string {
  const icons: Record<DiscoveryEntry["theme"], string> = {
    "ai-agents": "🤖",
    saas: "📈",
    sustainability: "🌱",
    crypto: "⛓️",
    devtools: "🔧",
    founder: "🧭",
    story: "✦"
  };
  return icons[theme];
}
