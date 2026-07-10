import { DISCOVERIES, DiscoveryEntry, JOURNEY_PROGRESS } from "../data/discoveries";

export type HudApi = {
  setPrompt: (entry: DiscoveryEntry | null) => void;
  setProgress: (discovered: Set<string>) => void;
  openCard: (entry: DiscoveryEntry, onClose: () => void) => void;
  closeCard: () => void;
  openIntro: (onStart: () => void) => void;
  openPersona: () => void;
  openJournal: (discovered: Set<string>) => void;
};

const personas = [
  ["🧑‍💻", "Builder", "ships first, explains later"],
  ["🧭", "Operator", "turns chaos into loops"],
  ["🚀", "Founder", "tests markets, not opinions"],
  ["📈", "Investor", "hunts asymmetric upside"],
  ["🤖", "Agentic Engineer", "delegates to systems"],
  ["🏁", "Hackathoner", "learns by shipping"]
];

export function createHud(root: HTMLElement): HudApi {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <section class="brand-card">
      <h1>The 100 Hackathoner</h1>
      <p>a walkable proof-of-work archive</p>
    </section>

    <button class="progress-pill" type="button" aria-label="Open discovery journal">
      <span class="star">✦</span>
      <span class="progress-text">${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target}</span>
      <span> discovered</span>
    </button>

    <div class="controls-hint">
      <b>WASD</b> walk <span>·</span> <b>space</b> jump/read <span>·</span> <b>E</b> read
    </div>

    <div class="action-prompt" hidden>
      <span>Space or E to read</span>
    </div>

    <div class="corner-controls" aria-label="Settings">
      <button type="button" title="toggle sound">🔊</button>
      <button type="button" title="change music">♪</button>
      <button type="button" title="change persona" data-persona>👤</button>
    </div>

    <div class="keypad" aria-label="Movement tester controls">
      <button type="button" data-control="forward">W</button>
      <button type="button" data-control="left">A</button>
      <button type="button" data-control="backward">S</button>
      <button type="button" data-control="right">D</button>
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
  const modalLayer = hud.querySelector<HTMLElement>(".modal-layer")!;
  const personaButton = hud.querySelector<HTMLButtonElement>("[data-persona]")!;
  let selectedPersonaIndex = 1;

  const openModal = (content: string) => {
    prompt.hidden = true;
    modalLayer.innerHTML = content;
    modalLayer.removeAttribute("hidden");
    modalLayer.style.display = "grid";
  };

  const closeModal = () => {
    modalLayer.innerHTML = "";
    modalLayer.setAttribute("hidden", "");
    modalLayer.style.display = "none";
  };

  const renderPersonaOptions = () =>
    personas
      .map(
        ([emoji, name, caption], index) => `
          <button
            class="persona-option ${index === selectedPersonaIndex ? "selected" : ""}"
            type="button"
            data-persona-index="${index}"
            aria-pressed="${index === selectedPersonaIndex}"
          >
            <span class="persona-emoji">${emoji}</span>
            <strong>${name}</strong>
            <span>${caption}</span>
          </button>
        `
      )
      .join("");

  const bindPersonaSelection = () => {
    modalLayer.querySelectorAll<HTMLButtonElement>("[data-persona-index]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedPersonaIndex = Number(button.dataset.personaIndex ?? selectedPersonaIndex);
        modalLayer.querySelectorAll<HTMLButtonElement>("[data-persona-index]").forEach((option) => {
          const selected = Number(option.dataset.personaIndex) === selectedPersonaIndex;
          option.classList.toggle("selected", selected);
          option.setAttribute("aria-pressed", String(selected));
        });
      });
    });
  };

  const openPersona = () => {
    openModal(`
      <section class="modal persona-modal">
        <h2>Choose your mode</h2>
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

  let currentDiscovered = new Set<string>();
  progressPill.addEventListener("click", () => api.openJournal(currentDiscovered));

  const api: HudApi = {
    setPrompt(entry) {
      prompt.hidden = !entry;
      prompt.querySelector("span")!.textContent = entry ? `Space or E to read ${entry.title}` : "Space or E to read";
    },
    setProgress(discovered) {
      currentDiscovered = discovered;
      progressText.textContent = `${JOURNEY_PROGRESS.completed}/${JOURNEY_PROGRESS.target}`;
    },
    openCard(entry, onClose) {
      openModal(`
        <article class="modal discovery-card">
          <button class="card-close" type="button" aria-label="Close" data-close>×</button>
          <div class="card-icon">${themeIcon(entry.theme)}</div>
          <h2>${entry.number ? `#${entry.number.toString().padStart(3, "0")} ` : ""}${entry.title}</h2>
          <p class="district">${entry.district}</p>
          <dl>
            <dt>Built</dt>
            <dd>${entry.built}</dd>
            <dt>Lesson</dt>
            <dd>${entry.lesson}</dd>
            <dt>Operator insight</dt>
            <dd>${entry.operatorInsight}</dd>
            <dt>Next clue</dt>
            <dd>${entry.nextClue}</dd>
          </dl>
          <div class="card-hint">Space or E to close</div>
        </article>
      `);
      modalLayer.querySelector("[data-close]")?.addEventListener("click", () => {
        closeModal();
        onClose();
      });
    },
    closeCard() {
      closeModal();
    },
    openIntro(onStart) {
      openModal(`
        <section class="modal intro-modal">
          <div class="modal-emoji">🏁</div>
          <h2>Welcome to The 100 Hackathoner</h2>
          <p>
            A walkable proof-of-work archive for hackathon stories, founder lessons, and operator loops.
            Wander through the town, inspect glowing discoveries, and turn experiments into leverage.
          </p>
          <p class="choose-label">choose your builder mode:</p>
          <div class="persona-grid intro-personas">
            ${renderPersonaOptions()}
          </div>
          <div class="loop-strip">
            <span>Explore</span>
            <span>Discover</span>
            <span>Extract</span>
            <span>Compound</span>
          </div>
          <button class="primary-action" type="button" data-start>Start the loop</button>
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
      openModal(`
        <section class="modal journal-modal">
          <h2>Discovery Journal</h2>
          <ol class="journal-list">
            ${DISCOVERIES.map((entry) => {
              const unlocked = discovered.has(entry.id);
              return `
                <li class="${unlocked ? "unlocked" : ""}">
                  <span>${unlocked ? "✦" : "✧"}</span>
                  <div>
                    <strong>${unlocked ? entry.title : "???"}</strong>
                    <small>${unlocked ? entry.district : entry.clue}</small>
                  </div>
                </li>
              `;
            }).join("")}
          </ol>
          <button class="primary-action" type="button" data-close>Back to town</button>
        </section>
      `);
      modalLayer.querySelector("[data-close]")?.addEventListener("click", closeModal);
    }
  };

  return api;
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
