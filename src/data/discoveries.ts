export type DiscoveryTheme =
  | "ai-agents"
  | "saas"
  | "sustainability"
  | "crypto"
  | "devtools"
  | "founder"
  | "story";

export type DiscoveryEntry = {
  id: string;
  number: number;
  title: string;
  district: string;
  theme: DiscoveryTheme;
  clue: string;
  built: string;
  lesson: string;
  operatorInsight: string;
  nextClue: string;
  position: {
    x: number;
    z: number;
  };
};

export const JOURNEY_PROGRESS = {
  completed: 19,
  target: 100
};

export const DISCOVERIES: DiscoveryEntry[] = [
  {
    id: "welcome",
    number: 0,
    title: "Welcome Plaza",
    district: "Town Center",
    theme: "story",
    clue: "start where the proof-of-work begins",
    built: "A public archive for a 100-hackathon journey.",
    lesson: "A portfolio becomes stronger when it shows accumulated experiments, not just polished outcomes.",
    operatorInsight: "Turn every project into reusable proof: market signal, technical leverage, and story material.",
    nextClue: "Head toward the lab with the glowing antenna.",
    position: { x: 0, z: 0 }
  },
  {
    id: "agentic-lab",
    number: 19,
    title: "BUIDL_OPC Hackathon SG",
    district: "AI Agents Lab",
    theme: "ai-agents",
    clue: "the lab that thinks in loops",
    built: "An agentic workflow prototype for automating technical execution loops.",
    lesson: "Agents are useful only when the loop is explicit: goal, action, feedback, memory, next action.",
    operatorInsight: "The wedge is not building agents. The wedge is owning repeatable operating loops.",
    nextClue: "Find the studio where business models are tested.",
    position: { x: -8, z: -7 }
  },
  {
    id: "saas-studio",
    number: 18,
    title: "SaaS Studio Sprint",
    district: "SaaS Studio",
    theme: "saas",
    clue: "a studio with pricing notes on the wall",
    built: "A small SaaS workflow concept with onboarding, metrics, and a monetization path.",
    lesson: "A product without a distribution hypothesis is just a demo.",
    operatorInsight: "Ship the smallest paid workflow before overbuilding the platform.",
    nextClue: "Follow the green path to the sustainability district.",
    position: { x: 8, z: -6 }
  },
  {
    id: "sustainability-garden",
    number: 17,
    title: "Sustainability Garden",
    district: "Sustainability District",
    theme: "sustainability",
    clue: "where energy systems become product ideas",
    built: "A climate and sustainability product sketch for operational decision support.",
    lesson: "Sustainability products need measurable business value, not only mission language.",
    operatorInsight: "The best climate software sells efficiency, compliance, or risk reduction.",
    nextClue: "Look for the alley with chain-link signs.",
    position: { x: 9, z: 6 }
  },
  {
    id: "crypto-alley",
    number: 16,
    title: "Crypto Alley",
    district: "Crypto Alley",
    theme: "crypto",
    clue: "a narrow alley humming with decentralization",
    built: "A Web3 experiment around wallets, incentives, and user-owned systems.",
    lesson: "Crypto UX fails when the ideology is easier to explain than the user value.",
    operatorInsight: "Use decentralized rails only where ownership or settlement is the product advantage.",
    nextClue: "The next lesson is inside Founder School.",
    position: { x: -9, z: 7 }
  },
  {
    id: "founder-school",
    number: 15,
    title: "Founder School",
    district: "Founder School",
    theme: "founder",
    clue: "where builders learn to operate",
    built: "A personal operating system for turning hackathon output into founder learning.",
    lesson: "Execution speed is not enough. The next skill is deciding what deserves execution.",
    operatorInsight: "The operator loop is prioritize, delegate, measure, decide, repeat.",
    nextClue: "Visit the hall where wins and losses are archived.",
    position: { x: 0, z: 10 }
  },
  {
    id: "winners-hall",
    number: 14,
    title: "Winners Hall",
    district: "Winners Hall",
    theme: "story",
    clue: "a trophy hall with unfinished shelves",
    built: "A record of hackathon wins, near-misses, and judging feedback.",
    lesson: "Winning validates execution, but feedback validates direction.",
    operatorInsight: "Track why projects win. The pattern matters more than the trophy.",
    nextClue: "Find the small booth built for developer tools.",
    position: { x: 0, z: -11 }
  },
  {
    id: "devtools-booth",
    number: 13,
    title: "Developer Tools Booth",
    district: "Tooling Row",
    theme: "devtools",
    clue: "a booth covered in terminal windows",
    built: "A CLI/tooling experiment for faster developer workflows.",
    lesson: "Developer tools win when they reduce repeated cognitive load.",
    operatorInsight: "Distribution for devtools starts with a painful repeated workflow and a sharp demo.",
    nextClue: "Return to the plaza and open the journal.",
    position: { x: 12, z: 1 }
  }
];
