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
  result: string;
  lesson: string;
  operatorInsight: string;
  businessAngle: string;
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
    result: "The journey is framed as a playable system instead of a static portfolio.",
    lesson: "A portfolio becomes stronger when it shows accumulated experiments, not just polished outcomes.",
    operatorInsight: "Turn every project into reusable proof: market signal, technical leverage, and story material.",
    businessAngle: "The archive can become a content engine, lead magnet, and book pipeline.",
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
    result: "Validated that agents need explicit operating loops before they feel useful.",
    lesson: "Agents are useful only when the loop is explicit: goal, action, feedback, memory, next action.",
    operatorInsight: "The wedge is not building agents. The wedge is owning repeatable operating loops.",
    businessAngle: "Package repeatable internal workflows as managed automations before selling a platform.",
    nextClue: "Find the studio where business models are tested.",
    position: { x: -8, z: -9.75 }
  },
  {
    id: "saas-studio",
    number: 18,
    title: "SaaS Studio Sprint",
    district: "SaaS Studio",
    theme: "saas",
    clue: "a studio with pricing notes on the wall",
    built: "A small SaaS workflow concept with onboarding, metrics, and a monetization path.",
    result: "Forced the project to answer who pays, why now, and what the first paid workflow is.",
    lesson: "A product without a distribution hypothesis is just a demo.",
    operatorInsight: "Ship the smallest paid workflow before overbuilding the platform.",
    businessAngle: "Start with a paid service wrapper, then automate the repeated delivery steps.",
    nextClue: "Follow the green path to the sustainability district.",
    position: { x: 8, z: -8.75 }
  },
  {
    id: "sustainability-garden",
    number: 17,
    title: "Sustainability Garden",
    district: "Sustainability District",
    theme: "sustainability",
    clue: "where energy systems become product ideas",
    built: "A climate and sustainability product sketch for operational decision support.",
    result: "Translated a broad mission area into concrete efficiency, compliance, and risk workflows.",
    lesson: "Sustainability products need measurable business value, not only mission language.",
    operatorInsight: "The best climate software sells efficiency, compliance, or risk reduction.",
    businessAngle: "Sell to teams with reporting pain, then expand into operational decision support.",
    nextClue: "Look for the alley with chain-link signs.",
    position: { x: 10.4, z: 5.35 }
  },
  {
    id: "crypto-alley",
    number: 16,
    title: "Crypto Alley",
    district: "Crypto Alley",
    theme: "crypto",
    clue: "a narrow alley humming with decentralization",
    built: "A Web3 experiment around wallets, incentives, and user-owned systems.",
    result: "Separated useful ownership mechanics from crypto-for-crypto's-sake complexity.",
    lesson: "Crypto UX fails when the ideology is easier to explain than the user value.",
    operatorInsight: "Use decentralized rails only where ownership or settlement is the product advantage.",
    businessAngle: "Look for infrastructure wedges where trust, provenance, or settlement is painful.",
    nextClue: "The next lesson is inside Founder School.",
    position: { x: -7.2, z: 5.25 }
  },
  {
    id: "founder-school",
    number: 15,
    title: "Founder School",
    district: "Founder School",
    theme: "founder",
    clue: "where builders learn to operate",
    built: "A personal operating system for turning hackathon output into founder learning.",
    result: "Moved the journey from isolated builds toward decision-making, leverage, and compounding.",
    lesson: "Execution speed is not enough. The next skill is deciding what deserves execution.",
    operatorInsight: "The operator loop is prioritize, delegate, measure, decide, repeat.",
    businessAngle: "Use each hackathon as market research, not only as a portfolio project.",
    nextClue: "Visit the hall where wins and losses are archived.",
    position: { x: -1.5, z: 10.65 }
  },
  {
    id: "winners-hall",
    number: 14,
    title: "Winners Hall",
    district: "Winners Hall",
    theme: "story",
    clue: "a trophy hall with unfinished shelves",
    built: "A record of hackathon wins, near-misses, and judging feedback.",
    result: "Turned outcomes into a pattern library instead of a vanity list.",
    lesson: "Winning validates execution, but feedback validates direction.",
    operatorInsight: "Track why projects win. The pattern matters more than the trophy.",
    businessAngle: "Convert repeated winning patterns into workshops, templates, or playbooks.",
    nextClue: "Find the small booth built for developer tools.",
    position: { x: 0, z: -8.65 }
  },
  {
    id: "devtools-booth",
    number: 13,
    title: "Developer Tools Booth",
    district: "Tooling Row",
    theme: "devtools",
    clue: "a booth covered in terminal windows",
    built: "A CLI/tooling experiment for faster developer workflows.",
    result: "Identified repeated developer friction as a sharper wedge than broad productivity claims.",
    lesson: "Developer tools win when they reduce repeated cognitive load.",
    operatorInsight: "Distribution for devtools starts with a painful repeated workflow and a sharp demo.",
    businessAngle: "Use demos, templates, and open-source hooks to earn developer trust.",
    nextClue: "Return to the plaza and open the journal.",
    position: { x: 16.1, z: 4.5 }
  },
  {
    id: "distribution-market",
    number: 12,
    title: "Distribution Market",
    district: "Tooling Row",
    theme: "saas",
    clue: "the stall with launch notes and feedback forms",
    built: "A checklist for turning hackathon launches into audience-building experiments.",
    result: "Made distribution part of the build plan instead of an afterthought.",
    lesson: "Launches compound only when every project captures an audience, a lesson, or a channel.",
    operatorInsight: "Track channel, hook, user segment, conversion signal, and follow-up for each build.",
    businessAngle: "A repeatable launch system can become a founder operating template.",
    nextClue: "Cross the path to the automation kiosk.",
    position: { x: 9.6, z: 2.65 }
  },
  {
    id: "automation-kiosk",
    number: 11,
    title: "Automation Kiosk",
    district: "AI Agents Lab",
    theme: "ai-agents",
    clue: "a kiosk that replaces one repeated task",
    built: "A small automation map for delegating repetitive software and ops tasks.",
    result: "Clarified which tasks should be scripted, agentic, delegated, or ignored.",
    lesson: "Automation is leverage only when the saved loop repeats enough times.",
    operatorInsight: "Estimate frequency, cost, error rate, and ownership before automating.",
    businessAngle: "Sell automation as an outcome: hours saved, mistakes reduced, or cycle time cut.",
    nextClue: "Look near the bench where notes become systems.",
    position: { x: -4.55, z: 3.9 }
  },
  {
    id: "operator-bench",
    number: 10,
    title: "Operator Bench",
    district: "Town Center",
    theme: "founder",
    clue: "where messy notes become operating rhythm",
    built: "A weekly review loop for projects, money, distribution, and learning velocity.",
    result: "Created a cadence for choosing what to continue, kill, delegate, or monetize.",
    lesson: "Operators do not just move faster. They create decision rhythm.",
    operatorInsight: "A weekly review is a leverage surface if it changes resource allocation.",
    businessAngle: "Turn personal operating rhythms into founder coaching content or templates.",
    nextClue: "Follow the water edge to the reflection dock.",
    position: { x: -3.7, z: 3.1 }
  },
  {
    id: "reflection-dock",
    number: 9,
    title: "Reflection Dock",
    district: "Waterfront",
    theme: "story",
    clue: "the quiet edge where lessons settle",
    built: "A post-hackathon reflection template for stories, mistakes, and reusable assets.",
    result: "Made every event produce writing material, product insight, and reusable proof.",
    lesson: "The story is captured after the sprint, not during the adrenaline.",
    operatorInsight: "Debrief fast while context is fresh, then tag the lesson for reuse.",
    businessAngle: "Reflection notes become newsletter issues, talks, and eventually book chapters.",
    nextClue: "Head toward the garden where energy data turns into product decisions.",
    position: { x: -6.8, z: 12.1 }
  },
  {
    id: "energy-dashboard",
    number: 8,
    title: "Energy Dashboard",
    district: "Sustainability District",
    theme: "sustainability",
    clue: "a panel tracking energy, carbon, and cost",
    built: "A sustainability analytics concept for explaining operational tradeoffs.",
    result: "Made abstract climate impact visible through metrics an operator can act on.",
    lesson: "A good dashboard changes decisions; it does not just report numbers.",
    operatorInsight: "Put cost, risk, compliance, and carbon in the same decision frame.",
    businessAngle: "The buyer is often operations or compliance, not only sustainability.",
    nextClue: "Find the small flag where founder experiments are named.",
    position: { x: 7.25, z: 5.7 }
  },
  {
    id: "idea-flag",
    number: 7,
    title: "Idea Flag",
    district: "Founder School",
    theme: "founder",
    clue: "a flag marking ideas worth testing",
    built: "A scoring rubric for hackathon ideas: urgency, buyer, channel, moat, and learning value.",
    result: "Reduced the tendency to build whatever feels technically exciting.",
    lesson: "Idea quality improves when selection criteria are explicit before the sprint.",
    operatorInsight: "The best hackathon ideas teach something valuable even if they do not win.",
    businessAngle: "Use the rubric to choose ideas that can become paid experiments after the event.",
    nextClue: "Walk toward the alley where incentives are tested.",
    position: { x: 0.9, z: 8.35 }
  },
  {
    id: "token-arcade",
    number: 6,
    title: "Token Arcade",
    district: "Crypto Alley",
    theme: "crypto",
    clue: "the tiny arcade where incentives can break",
    built: "A token incentive thought experiment for user participation and network effects.",
    result: "Exposed how quickly incentives distort behavior when the core value is weak.",
    lesson: "Incentives amplify product value; they do not replace it.",
    operatorInsight: "Model the behavior you reward before adding points, tokens, or leaderboards.",
    businessAngle: "Use token mechanics only where they improve liquidity, access, or coordination.",
    nextClue: "Find the pitch where competition becomes signal.",
    position: { x: -10.8, z: 4.65 }
  },
  {
    id: "pitch-sprint",
    number: 5,
    title: "Pitch Sprint",
    district: "Winners Hall",
    theme: "story",
    clue: "where demos become judgment calls",
    built: "A pitch narrative template for compressing problem, demo, traction, and ask.",
    result: "Turned judging into a product-positioning exercise.",
    lesson: "A good pitch makes the value obvious before the technical depth appears.",
    operatorInsight: "Pitch structure is a forcing function for strategy clarity.",
    businessAngle: "Reusable pitch frameworks can support workshops, advisory, and founder content.",
    nextClue: "Look for the small creator corner near the town path.",
    position: { x: 2.55, z: -9.6 }
  },
  {
    id: "creator-corner",
    number: 4,
    title: "Creator Corner",
    district: "Town Center",
    theme: "story",
    clue: "where screenshots turn into public proof",
    built: "A habit loop for turning builds into posts, visuals, threads, and lessons.",
    result: "Made documentation and distribution part of shipping, not a separate chore.",
    lesson: "If no one sees the work, the learning still compounds but the opportunity does not.",
    operatorInsight: "Create assets while building: screenshots, diagrams, notes, and short demos.",
    businessAngle: "Consistent public proof attracts collaborators, clients, sponsors, and readers.",
    nextClue: "Find the small money sign near the studio.",
    position: { x: 4.85, z: -3.95 }
  },
  {
    id: "pricing-sign",
    number: 3,
    title: "Pricing Sign",
    district: "SaaS Studio",
    theme: "saas",
    clue: "a sign asking who pays this week",
    built: "A monetization decision prompt for each project after the demo is done.",
    result: "Forced post-hackathon ideas into service, template, SaaS, content, or discard paths.",
    lesson: "Monetization is a design constraint, not a final-page feature.",
    operatorInsight: "Every project should leave with a next commercial question.",
    businessAngle: "Run paid micro-offers before committing months to productization.",
    nextClue: "Search the lab bench for agent memory.",
    position: { x: 6.2, z: -3.35 }
  },
  {
    id: "memory-lab",
    number: 2,
    title: "Memory Lab",
    district: "AI Agents Lab",
    theme: "ai-agents",
    clue: "a bench where context becomes compounding",
    built: "A memory pattern for agents that need project context, decisions, and task history.",
    result: "Made the difference between chat automation and durable workflow ownership clearer.",
    lesson: "Memory is valuable only when it improves the next decision or action.",
    operatorInsight: "Store decisions, constraints, outcomes, and reusable artifacts - not everything.",
    businessAngle: "Vertical agent products win by remembering domain-specific operating context.",
    nextClue: "Return to the wall and look for the 100th slot.",
    position: { x: -10.55, z: -5.25 }
  },
  {
    id: "hundredth-slot",
    number: 1,
    title: "The 100th Slot",
    district: "Town Walls",
    theme: "founder",
    clue: "an empty slot waiting for the future book",
    built: "A placeholder for the final hackathon and the book that follows the full journey.",
    result: "The site now points forward instead of only archiving what already happened.",
    lesson: "A public goal creates accountability, memory, and narrative tension.",
    operatorInsight: "Design the system so future work has a place to land.",
    businessAngle: "The long arc can become a book, community, course, or founder operating brand.",
    nextClue: "Keep building. The map expands with the journey.",
    position: { x: -13.2, z: 0.9 }
  }
];
