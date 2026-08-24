const STORAGE_KEY = "hackathoner:kingdom-progress:v1";

export type KingdomProgress = {
  discoveries: string[];
  lastWorld: "shawn" | "kairui" | "unified";
  playerAppearance?: {
    skin: string;
    hair: string;
    shirt: string;
    trim: string;
    pants: string;
    shoes: string;
  };
};

const defaultProgress: KingdomProgress = {
  discoveries: [],
  lastWorld: "shawn"
};

export function loadKingdomProgress(): KingdomProgress {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...defaultProgress };
    const parsed = JSON.parse(stored) as Partial<KingdomProgress>;
    return {
      discoveries: Array.isArray(parsed.discoveries)
        ? parsed.discoveries.filter((entry): entry is string => typeof entry === "string")
        : [],
      lastWorld: parsed.lastWorld === "kairui" || parsed.lastWorld === "unified" ? parsed.lastWorld : "shawn",
      playerAppearance: isAppearance(parsed.playerAppearance) ? parsed.playerAppearance : undefined
    };
  } catch {
    return { ...defaultProgress };
  }
}

function isAppearance(value: unknown): value is NonNullable<KingdomProgress["playerAppearance"]> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["skin", "hair", "shirt", "trim", "pants", "shoes"].every((key) => typeof record[key] === "string");
}

export function saveKingdomProgress(progress: KingdomProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The experience remains playable when storage is unavailable.
  }
}

export function discoverKingdomLandmark(id: string, world: KingdomProgress["lastWorld"]): KingdomProgress {
  const progress = loadKingdomProgress();
  const discoveries = new Set(progress.discoveries);
  discoveries.add(id);
  const next = { ...progress, discoveries: [...discoveries], lastWorld: world };
  saveKingdomProgress(next);
  return next;
}
