import type { CoastalEnvironmentState } from "./environment";

export type CoastalMetric = {
  value: string;
  label: string;
};

export type CoastalLandmark = {
  id: string;
  chapter: string;
  name: string;
  kicker: string;
  summary: string;
  decision: string;
  proof: string;
  lesson: string;
  nextBet: string;
  metric: CoastalMetric;
  position: readonly [number, number, number];
  color: string;
  kind: "camp" | "workshop" | "career" | "harbour" | "archive" | "lighthouse";
  shotOffset: readonly [number, number, number];
  lookOffset: readonly [number, number, number];
  tourTime: Exclude<CoastalEnvironmentState["time"], "live">;
};

/**
 * The coast is an operator journal, not a category map. Each physical district
 * answers the same five questions: what was happening, what decision was made,
 * what proof exists, what changed in the playbook, and what comes next.
 */
export const COASTAL_LANDMARKS: readonly CoastalLandmark[] = [
  {
    id: "operator-camp",
    chapter: "Origin",
    name: "Operator Camp",
    kicker: "Chapter 01 · The why",
    summary: "Hackathons are my field laboratory: a compressed place to test ideas, read people, ship under pressure and collect stories worth keeping.",
    decision: "Treat the road to 100 as an operating system—not a trophy chase. Every expedition must produce a live proof, a decision log and a sharper next bet.",
    proof: "The 100th is now a public, walkable archive of 19 shipped chapters and the lessons behind them.",
    lesson: "Speed becomes leverage only when the learning survives the sprint.",
    nextBet: "Make chapter 20 useful to a real operator before making it impressive to judges.",
    metric: { value: "19 / 100", label: "public chapters shipped" },
    position: [24, 0, -96],
    color: "#ef835f",
    kind: "camp",
    shotOffset: [-12, 6, -13],
    lookOffset: [0, 2.8, 0],
    tourTime: "day"
  },
  {
    id: "execution-workshop",
    chapter: "System",
    name: "Execution Workshop",
    kicker: "Chapter 02 · Build → ship → operate",
    summary: "The workshop holds the tools I actually use: JavaScript and TypeScript, Java, Go and Python—plus the agent workflows that connect them to real operations.",
    decision: "Choose the smallest stack that can reach production, instrument it early, and spend the saved complexity on the user and distribution loop.",
    proof: "Full-stack delivery across consulting, freelance, banking and energy environments—not a keyword wall, but tools tested under different constraints.",
    lesson: "A broad stack matters because it removes excuses between an idea and a running system.",
    nextBet: "Package repeatable agent patterns into products that another team can operate without me.",
    metric: { value: "4", label: "production languages" },
    position: [31, 0, -68],
    color: "#ffd66b",
    kind: "workshop",
    shotOffset: [-12, 6.5, -12],
    lookOffset: [0, 3.2, 0],
    tourTime: "day"
  },
  {
    id: "career-ridge",
    chapter: "Work",
    name: "Career Ridge",
    kicker: "Chapter 03 · Operating contexts",
    summary: "NCS taught consulting, freelance taught ownership, UBS and DBS taught regulated scale, and Sembcorp brought agentic AI into infrastructure and sustainability.",
    decision: "Use every context to acquire a different operating muscle instead of repeating the same engineering year.",
    proof: "Five distinct delivery contexts now sit on one ridge: consulting, independent work, two banks and an energy operator.",
    lesson: "Career compounding comes from collecting complementary constraints, not only bigger titles.",
    nextBet: "Convert enterprise pattern recognition into founder-grade product and distribution judgment.",
    metric: { value: "5", label: "operating contexts" },
    position: [28, 0, -38],
    color: "#6fc0b5",
    kind: "career",
    shotOffset: [-14, 9, -15],
    lookOffset: [0, 4.2, 0],
    tourTime: "day"
  },
  {
    id: "venture-harbour",
    chapter: "Bets",
    name: "Venture Harbour",
    kicker: "Chapter 04 · Ideas leave the dock",
    summary: "The harbour is where AI agents, SaaS, automation and sustainability experiments become public products instead of private possibilities.",
    decision: "Launch narrow wedges quickly, then let usage and conversations decide which vessel deserves more fuel.",
    proof: "A growing fleet of hackathon experiments—each one mapped to a problem, an operator, a result and a possible business model.",
    lesson: "A portfolio records what was built. A venture harbour records which demand signal earned another voyage.",
    nextBet: "Find one repeatable pain point with an owner, budget and distribution path before widening the product.",
    metric: { value: "3", label: "active opportunity wedges" },
    position: [35, 0, -4],
    color: "#73aa74",
    kind: "harbour",
    shotOffset: [-14, 6, -12],
    lookOffset: [0, 3.1, 0],
    tourTime: "sunset"
  },
  {
    id: "signal-archive",
    chapter: "Journal",
    name: "Signal Archive",
    kicker: "Chapter 05 · Decisions over trophies",
    summary: "This archive keeps the uncomfortable material too: failed assumptions, weak positioning, team friction and the moment a promising build stopped compounding.",
    decision: "End every expedition with a short operator review: situation, bet, evidence, outcome, lesson and the next falsifiable move.",
    proof: "The journal makes decisions inspectable so future projects can reuse the learning instead of rediscovering it under deadline.",
    lesson: "Failure only becomes an asset after it changes a subsequent decision.",
    nextBet: "Turn the strongest field notes into a practical book for builders becoming operators.",
    metric: { value: "Build → Learn", label: "one debrief per expedition" },
    position: [52, 0, 29],
    color: "#9c86c8",
    kind: "archive",
    shotOffset: [-12, 6, 10],
    lookOffset: [0, 3.3, 0],
    tourTime: "sunset"
  },
  {
    id: "next-bet-lighthouse",
    chapter: "Next",
    name: "Next Bet Lighthouse",
    kicker: "Chapter 06 · Builder → operator",
    summary: "The current transition is the real project: turn engineering speed into ownership, positioning, distribution, scalable income and asymmetric long-term bets.",
    decision: "Keep building—but judge the work by market learning, repeatability and ownership rather than technical difficulty alone.",
    proof: "The coast combines the public portfolio, editable world, operating journal and next-bet map into one evolving artifact.",
    lesson: "The next level is not more output. It is choosing the right game, owning the loop and compounding the result.",
    nextBet: "Ship chapter 20, publish the operator lesson, and invite the next serious collaborator aboard.",
    metric: { value: "20 / 100", label: "the next expedition" },
    position: [52, 0, 58],
    color: "#f3bd52",
    kind: "lighthouse",
    shotOffset: [-16, 8, -14],
    lookOffset: [0, 7, 0],
    tourTime: "night"
  }
] as const;

export const COASTAL_CAREER_STOPS = [
  "NCS · Consulting",
  "Freelance · Ownership",
  "UBS · Regulated scale",
  "DBS · Banking delivery",
  "Sembcorp · Agentic AI"
] as const;
