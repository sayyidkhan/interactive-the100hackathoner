import { useMemo, useState } from "react";
import TownScene from "./TownScene";

type Persona = {
  id: string;
  emoji: string;
  name: string;
  caption: string;
  shirt: string;
  accent: string;
};

export type Discovery = {
  id: string;
  icon: string;
  title: string;
  clue: string;
  text: string;
  position: [number, number];
};

const PERSONAS: Persona[] = [
  { id: "shawn", emoji: "🧑", name: "Shawn", caption: "the local. ships things.", shirt: "#d95545", accent: "#9c302c" },
  { id: "red", emoji: "⚽", name: "The Red", caption: "state-level baller. never walks alone.", shirt: "#c43f3d", accent: "#8c2625" },
  { id: "biscuit", emoji: "🐈", name: "Biscuit", caption: "knows every rooftop.", shirt: "#d6a06a", accent: "#8c5d36" },
  { id: "nugget", emoji: "🐕", name: "Nugget", caption: "low rider. big heart.", shirt: "#ba7849", accent: "#754426" },
  { id: "honk", emoji: "🪿", name: "HONK", caption: "unhinged. 15% faster. honks.", shirt: "#efeee8", accent: "#dc8a38" },
  { id: "roomie", emoji: "🤖", name: "Roomie", caption: "followed you from the last game.", shirt: "#6c9ca4", accent: "#376670" }
];

export const DISCOVERIES: Discovery[] = [
  { id: "fountain", icon: "⛲", title: "Welcome to Shawnville", clue: "the heart of town", text: "A walkable portfolio built from work, play, and all the experiments in between.", position: [0, 0] },
  { id: "home", icon: "🏠", title: "Shawn's House", clue: "where the mayor sleeps", text: "A little corner for the person behind the projects.", position: [-10, 8] },
  { id: "career", icon: "🏢", title: "Career Hall", clue: "a purple building full of detours", text: "A career story told as a series of rooms, teams, and lessons.", position: [-10, -8] },
  { id: "library", icon: "📚", title: "Skill Library", clue: "follow the signs to the quiet blue house", text: "A collection of skills worth practicing long after the title changes.", position: [-18, -7] },
  { id: "university", icon: "🎓", title: "The University", clue: "the long walk south", text: "Where curiosity became a habit and technical foundations were laid.", position: [-10, -18] },
  { id: "workshop", icon: "🔧", title: "The Workshop", clue: "where the shipping happens", text: "A workshop for experiments, developer tools, and ideas that needed to become real.", position: [10, -8] },
  { id: "web3", icon: "⛓️", title: "Web3 Stall", clue: "a market stall that talks about ownership", text: "A collection of Web3 explorations, from wallets to useful infrastructure.", position: [18, -5] },
  { id: "ai", icon: "🤖", title: "AI Stall", clue: "the stall that thinks back", text: "Small experiments in intelligent tools and practical automation.", position: [18, 3] },
  { id: "devtools", icon: "🧰", title: "Dev Tools Stall", clue: "where builders leave sharp little tools", text: "Developer tools designed to remove friction from a repeated workflow.", position: [14, 8] },
  { id: "creator", icon: "🎬", title: "Creator Studio", clue: "where a camera is always rolling", text: "A studio for turning work-in-progress into stories other people can use.", position: [-18, 8] },
  { id: "hackathon", icon: "🏆", title: "Hackathon Monument", clue: "look for gold near the plaza", text: "A monument to shipping under pressure, learning quickly, and playing the odds.", position: [-5, -2] },
  { id: "football", icon: "⚽", title: "The Football Pitch", clue: "score a screamer on the pitch", text: "A reminder that movement, teams, and play belong in the portfolio too.", position: [2, 16] },
  { id: "gym", icon: "🏋️", title: "The Outdoor Gym", clue: "keep moving north", text: "Strength is another form of compounding.", position: [13, 16] },
  { id: "trail", icon: "🏃", title: "The Jogging Trail", clue: "follow the edge of town", text: "The long route where ideas become clearer one step at a time.", position: [-20, 1] },
  { id: "cat", icon: "🐈", title: "Biscuit's Perch", clue: "meow?", text: "Biscuit knows the best view in town.", position: [-3, 14] },
  { id: "shrine", icon: "🗿", title: "The Dev Shrine", clue: "go on. touch it.", text: "A small shrine to every strange bug that eventually taught something useful.", position: [6, 5] },
  { id: "golazo", icon: "⚽", title: "GOLAZO!", clue: "the pitch is calling", text: "A goal, a shout, and a very good reason to keep playing.", position: [0, 19] },
  { id: "arcade", icon: "🕹️", title: "Arcade", clue: "neon glow after dark", text: "A playful detour for side quests and systems worth poking at.", position: [20, -8] },
  { id: "post", icon: "✉️", title: "Post Office", clue: "send Shawn a letter", text: "A place for messages, collaborations, and the next unexpected opportunity.", position: [-10, 18] },
  { id: "garden", icon: "🌱", title: "Community Garden", clue: "find the quiet corner", text: "Good work grows best when it has room and company.", position: [8, 10] }
];

function readSavedDiscoveries() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("shawnville-react-discoveries") ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

export default function App() {
  const [introOpen, setIntroOpen] = useState(true);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [activeDiscovery, setActiveDiscovery] = useState<Discovery | null>(null);
  const [discovered, setDiscovered] = useState(readSavedDiscoveries);
  const [musicOn, setMusicOn] = useState(false);

  const discoveredList = useMemo(() => DISCOVERIES.filter((entry) => discovered.has(entry.id)), [discovered]);

  const readDiscovery = (entry: Discovery) => {
    setDiscovered((current) => {
      const next = new Set(current).add(entry.id);
      localStorage.setItem("shawnville-react-discoveries", JSON.stringify([...next]));
      return next;
    });
    setActiveDiscovery(entry);
  };

  return (
    <main className="app-shell">
      <TownScene discoveries={DISCOVERIES} persona={persona} paused={introOpen || journalOpen || Boolean(activeDiscovery)} onRead={readDiscovery} />

      <section className="hud" aria-label="Shawnville controls">
        <div className="title-card">
          <h1>Shawnville</h1>
          <p>a walkable portfolio</p>
        </div>
        <button className="journal-button" type="button" onClick={() => setJournalOpen(true)}>
          <span>✦</span> {discovered.size}/{DISCOVERIES.length} discovered
        </button>
        <p className="top-hint"><b>WASD</b> walk <i>·</i> <b>shift</b> jog <i>·</i> <b>drag</b> to look around</p>
        <div className="bottom-controls">
          <span className="track-label">♪ {musicOn ? "Porch Lo-fi" : "Music paused"}</span>
          <div>
            <button type="button" title="Toggle ambient sound" onClick={() => setMusicOn((on) => !on)}>🔊</button>
            <button type="button" title="Toggle music" onClick={() => setMusicOn((on) => !on)}>{musicOn ? "♫" : "♪"}</button>
            <button type="button" title="Change character" onClick={() => setIntroOpen(true)}>👤</button>
          </div>
        </div>
      </section>

      {introOpen && (
        <div className="modal-backdrop">
          <section className="modal intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title">
            <span className="modal-emoji">🏘️</span>
            <h2 id="intro-title">Welcome to Shawnville</h2>
            <p>A tiny town built out of <b>Shawn Chee&apos;s</b> resume, projects, and hobbies. Wander around — every glowing star is something to discover.</p>
            <p className="small">choose your wanderer:</p>
            <div className="character-grid">
              {PERSONAS.map((option) => (
                <button className={option.id === persona.id ? "character selected" : "character"} key={option.id} type="button" onClick={() => setPersona(option)}>
                  <span>{option.emoji}</span>
                  <strong>{option.name}</strong>
                  <small>{option.caption}</small>
                </button>
              ))}
            </div>
            <p className="small"><b>WASD</b> or arrows to walk · hold <b>shift</b> to jog · drag to look around · <b>space</b> to read a star</p>
            <button className="primary-button" type="button" onClick={() => setIntroOpen(false)}>Take a walk</button>
          </section>
        </div>
      )}

      {activeDiscovery && (
        <div className="modal-backdrop">
          <article className="modal discovery-card" role="dialog" aria-modal="true" aria-labelledby="discovery-title">
            <button className="close-button" type="button" aria-label="Close" onClick={() => setActiveDiscovery(null)}>×</button>
            <span className="modal-emoji">{activeDiscovery.icon}</span>
            <h2 id="discovery-title">{activeDiscovery.title}</h2>
            <p>{activeDiscovery.text}</p>
            <p className="small">{activeDiscovery.clue}</p>
            <button className="primary-button" type="button" onClick={() => setActiveDiscovery(null)}>Back to town</button>
          </article>
        </div>
      )}

      {journalOpen && (
        <div className="modal-backdrop">
          <section className="modal journal-modal" role="dialog" aria-modal="true" aria-labelledby="journal-title">
            <h2 id="journal-title">Discovery Journal</h2>
            <p className="small">{discoveredList.length}/{DISCOVERIES.length} places found</p>
            <ul className="journal-list">
              {DISCOVERIES.map((entry) => (
                <li className={discovered.has(entry.id) ? "found" : "locked"} key={entry.id}>
                  <span>{discovered.has(entry.id) ? entry.icon : "✧"}</span>
                  <div><strong>{discovered.has(entry.id) ? entry.title : "???"}</strong><small>{discovered.has(entry.id) ? entry.text : entry.clue}</small></div>
                </li>
              ))}
            </ul>
            <button className="primary-button" type="button" onClick={() => setJournalOpen(false)}>Back to town</button>
          </section>
        </div>
      )}
    </main>
  );
}
