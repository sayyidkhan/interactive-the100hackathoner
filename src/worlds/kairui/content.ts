export type CoastalLandmark = {
  id: string;
  name: string;
  kicker: string;
  summary: string;
  lesson: string;
  position: readonly [number, number, number];
  color: string;
  kind: "lighthouse" | "harbour" | "studio" | "reef" | "archive";
};

export const COASTAL_LANDMARKS: readonly CoastalLandmark[] = [
  {
    id: "launch-pier",
    name: "Launch Pier",
    kicker: "19 of 100 shipped",
    summary: "The starting point: hackathons used as a repeatable system for testing ideas, building proof and collecting stories.",
    lesson: "Ship before certainty. A small live experiment compounds faster than a perfect private plan.",
    position: [0, 0, 3],
    color: "#ef835f",
    kind: "harbour"
  },
  {
    id: "agentic-lighthouse",
    name: "Agentic Lighthouse",
    kicker: "AI agents",
    summary: "A working lab for agentic systems, developer tools and practical automation—not demos detached from real operations.",
    lesson: "The durable advantage is the workflow around the model: context, tools, evaluation and ownership.",
    position: [-12, 0, -7],
    color: "#ffd66b",
    kind: "lighthouse"
  },
  {
    id: "operator-studio",
    name: "Operator Studio",
    kicker: "Builder → operator",
    summary: "A space for turning engineering velocity into positioning, distribution, monetisation and repeatable execution.",
    lesson: "Code is leverage only after it reaches a market, changes behaviour and produces a measurable outcome.",
    position: [11, 0, -6],
    color: "#6fc0b5",
    kind: "studio"
  },
  {
    id: "sustainability-reef",
    name: "Sustainability Reef",
    kicker: "Systems with consequence",
    summary: "Experiments at the intersection of software, sustainability and real-world infrastructure.",
    lesson: "The best technical systems make constraints visible and give operators a better decision loop.",
    position: [-13, 0, 10],
    color: "#73aa74",
    kind: "reef"
  },
  {
    id: "story-archive",
    name: "Story Archive",
    kicker: "Toward the book",
    summary: "A growing field journal of shipped projects, failed assumptions, team dynamics and lessons worth carrying forward.",
    lesson: "A portfolio shows outputs. An archive of decisions shows how the operator thinks.",
    position: [13, 0, 10],
    color: "#9c86c8",
    kind: "archive"
  }
] as const;

export const COASTAL_CAREER_STOPS = [
  "NCS consulting",
  "Freelance software engineering",
  "UBS and DBS",
  "Sembcorp agentic AI"
] as const;
