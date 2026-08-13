import { loadKingdomProgress, saveKingdomProgress } from "../engine/progress";

const STORAGE_KEY = "the100hackathoner.discovered.v1";

export function loadDiscovered(): Set<string> {
  try {
    if (new URLSearchParams(window.location.search).has("resetProgress")) {
      const reset = new Set<string>();
      saveDiscovered(reset);
      return reset;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(["welcome"]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(["welcome"]);
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set(["welcome"]);
  }
}

export function saveDiscovered(discovered: Set<string>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...discovered]));
  const progress = loadKingdomProgress();
  const coastalDiscoveries = progress.discoveries.filter((id) => id.startsWith("kairui:"));
  progress.discoveries = [...coastalDiscoveries, ...[...discovered].map((id) => `shawn:${id}`)];
  progress.lastWorld = "shawn";
  saveKingdomProgress(progress);
}

export function resetDiscovered(): Set<string> {
  const reset = new Set<string>(["welcome"]);
  saveDiscovered(reset);
  return reset;
}
