const STORAGE_KEY = "hackathoner:kingdom-progress:v1";

export type KingdomProgress = {
  discoveries: string[];
  lastWorld: "shawn" | "kairui" | "unified";
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
      lastWorld: parsed.lastWorld === "kairui" || parsed.lastWorld === "unified" ? parsed.lastWorld : "shawn"
    };
  } catch {
    return { ...defaultProgress };
  }
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
  const next = { discoveries: [...discoveries], lastWorld: world };
  saveKingdomProgress(next);
  return next;
}
