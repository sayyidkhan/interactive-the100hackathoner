import {
  type EnvironmentSettings,
  type WeatherCondition
} from "../data/townSchema";

export type LiveWeatherSnapshot = {
  condition: WeatherCondition;
  temperature: number;
  cloudCover: number;
  precipitation: number;
  windSpeed: number;
  isDay: boolean;
  observedAt: string;
  retrievedAt: string;
  source: "network" | "cache" | "stale-cache";
};

type WeatherFetchOptions = {
  force?: boolean;
};

type CachedWeather = {
  cachedAt: number;
  snapshot: LiveWeatherSnapshot;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    cloud_cover?: number;
    precipitation?: number;
    snowfall?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
    time?: string;
  };
};

const WEATHER_CACHE_PREFIX = "the100hackathoner.weather.v1";
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const WEATHER_STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;
const WEATHER_MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000;
const inFlightRequests = new Map<string, Promise<LiveWeatherSnapshot>>();

export async function fetchLiveWeather(
  settings: EnvironmentSettings,
  signal?: AbortSignal,
  options: WeatherFetchOptions = {}
): Promise<LiveWeatherSnapshot> {
  const cacheKey = weatherCacheKey(settings);
  const cached = readCachedWeather(cacheKey);
  const cacheAge = cached ? Date.now() - cached.cachedAt : Number.POSITIVE_INFINITY;
  const usableCacheAge = options.force ? WEATHER_MANUAL_REFRESH_COOLDOWN_MS : WEATHER_CACHE_TTL_MS;
  if (cached && cacheAge < usableCacheAge) return withSource(cached.snapshot, "cache");

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest && !options.force) return existingRequest;

  const request = requestLiveWeather(settings, signal)
    .then((snapshot) => {
      writeCachedWeather(cacheKey, snapshot);
      return snapshot;
    })
    .catch((reason: unknown) => {
      if (signal?.aborted) throw reason;
      if (cached && cacheAge < WEATHER_STALE_FALLBACK_MS) return withSource(cached.snapshot, "stale-cache");
      throw reason;
    })
    .finally(() => {
      if (inFlightRequests.get(cacheKey) === request) inFlightRequests.delete(cacheKey);
    });
  inFlightRequests.set(cacheKey, request);
  return request;
}

async function requestLiveWeather(
  settings: EnvironmentSettings,
  signal?: AbortSignal
): Promise<LiveWeatherSnapshot> {
  const query = new URLSearchParams({
    latitude: String(settings.latitude),
    longitude: String(settings.longitude),
    current: [
      "temperature_2m",
      "cloud_cover",
      "precipitation",
      "snowfall",
      "weather_code",
      "wind_speed_10m",
      "is_day"
    ].join(","),
    timezone: "auto"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
  const payload = await response.json() as OpenMeteoResponse;
  const current = payload.current;
  if (!current || typeof current.weather_code !== "number") {
    throw new Error("Weather service returned an incomplete reading.");
  }
  return {
    condition: mapWeatherCode(current.weather_code, current.snowfall ?? 0),
    temperature: finiteOr(current.temperature_2m, 0),
    cloudCover: clamp(finiteOr(current.cloud_cover, 0), 0, 100),
    precipitation: Math.max(finiteOr(current.precipitation, 0), 0),
    windSpeed: Math.max(finiteOr(current.wind_speed_10m, 0), 0),
    isDay: current.is_day !== 0,
    observedAt: current.time ?? new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    source: "network"
  };
}

function weatherCacheKey(settings: EnvironmentSettings): string {
  const latitude = settings.latitude.toFixed(2);
  const longitude = settings.longitude.toFixed(2);
  return `${WEATHER_CACHE_PREFIX}:${latitude}:${longitude}`;
}

function readCachedWeather(key: string): CachedWeather | undefined {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return undefined;
    const cached = JSON.parse(saved) as Partial<CachedWeather>;
    if (!Number.isFinite(cached.cachedAt) || !isWeatherSnapshot(cached.snapshot)) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return cached as CachedWeather;
  } catch {
    return undefined;
  }
}

function writeCachedWeather(key: string, snapshot: LiveWeatherSnapshot): void {
  try {
    const cached: CachedWeather = { cachedAt: Date.now(), snapshot };
    window.localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Weather remains available even when storage is disabled or full.
  }
}

function isWeatherSnapshot(value: unknown): value is LiveWeatherSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<LiveWeatherSnapshot>;
  return typeof snapshot.condition === "string"
    && typeof snapshot.temperature === "number"
    && typeof snapshot.cloudCover === "number"
    && typeof snapshot.precipitation === "number"
    && typeof snapshot.windSpeed === "number"
    && typeof snapshot.isDay === "boolean"
    && typeof snapshot.observedAt === "string"
    && typeof snapshot.retrievedAt === "string";
}

function withSource(snapshot: LiveWeatherSnapshot, source: LiveWeatherSnapshot["source"]): LiveWeatherSnapshot {
  return { ...snapshot, source };
}

function mapWeatherCode(code: number, snowfall: number): WeatherCondition {
  if (snowfall > 0 || code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return "snow";
  }
  if (code === 95 || code === 96 || code === 99) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 1 || code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  return "clear";
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
