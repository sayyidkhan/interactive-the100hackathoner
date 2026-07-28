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

export async function fetchLiveWeather(
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
    observedAt: current.time ?? new Date().toISOString()
  };
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
