import * as THREE from "three";
import {
  type EnvironmentSettings,
  type SeasonChoice,
  type WeatherCondition
} from "../data/townSchema";
import {
  fetchLiveWeather,
  type LiveWeatherSnapshot
} from "../systems/weather";
import {
  type AtmosphereObject,
  type Firefly,
  type SakuraPetal,
  type WeatherParticles,
  setFallingFoliageAppearance,
  updateWeatherParticles
} from "./atmosphere";
import { type TownLights } from "./rendering/shadows";

export type EnvironmentRuntimeStatus = {
  loading: boolean;
  error?: string;
  snapshot?: LiveWeatherSnapshot;
  weather: WeatherCondition;
  season: Exclude<SeasonChoice, "auto">;
  localHour: number;
};

type EnvironmentControllerOptions = {
  scene: THREE.Scene;
  lights: TownLights;
  atmosphere: AtmosphereObject[];
  petals: SakuraPetal;
  fireflies: Firefly;
  weatherParticles: WeatherParticles;
  onStatus: (status: EnvironmentRuntimeStatus) => void;
};

export type EnvironmentController = {
  apply: (settings: EnvironmentSettings) => void;
  refreshWeather: () => void;
  refreshSeasonMaterials: (root?: THREE.Object3D) => void;
  update: (time: number, delta: number) => void;
};

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const DAY_BACKGROUNDS: Record<Exclude<SeasonChoice, "auto">, string> = {
  spring: "#f5e6dd",
  summer: "#f4e7d3",
  autumn: "#f0dfcf",
  winter: "#e6ecec",
  wet: "#e2e9df",
  dry: "#f2e0c7"
};
const FOLIAGE_COLORS: Record<Exclude<SeasonChoice, "auto">, string> = {
  spring: "#79a35f",
  summer: "#527f50",
  autumn: "#b66d3d",
  winter: "#8b8b7c",
  wet: "#4f8050",
  dry: "#9b7d49"
};

export function createEnvironmentController(options: EnvironmentControllerOptions): EnvironmentController {
  let settings: EnvironmentSettings;
  let snapshot: LiveWeatherSnapshot | undefined;
  let loading = false;
  let error: string | undefined;
  let request: AbortController | undefined;
  let refreshTimer: number | undefined;
  let lastSeason: Exclude<SeasonChoice, "auto"> | undefined;
  let lastFoliage = "";
  let lastReportedMinute = -1;

  const getWeather = (): WeatherCondition => settings.weatherMode === "live"
    ? snapshot?.condition ?? settings.weather
    : settings.weather;

  const getLocalHour = (): number => {
    if (settings.dayNightMode === "manual") return settings.manualHour;
    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    return ((utcHours + settings.timezoneOffset) % 24 + 24) % 24;
  };

  const getSeason = (): Exclude<SeasonChoice, "auto"> => {
    if (settings.season !== "auto") return normalizeSeasonForCycle(settings.season, settings.seasonCycle);
    const shifted = new Date(Date.now() + settings.timezoneOffset * 60 * 60 * 1000);
    const month = shifted.getUTCMonth() + 1;
    if (settings.seasonCycle === "two") return month >= 11 || month <= 3 ? "wet" : "dry";
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    if (month >= 9 && month <= 11) return "autumn";
    return "winter";
  };

  const report = () => {
    options.onStatus({
      loading,
      error,
      snapshot,
      weather: getWeather(),
      season: getSeason(),
      localHour: getLocalHour()
    });
  };

  const scheduleRefresh = () => {
    if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    if (settings.weatherMode !== "live") return;
    refreshTimer = window.setTimeout(refreshWeather, WEATHER_REFRESH_MS);
  };

  const refreshWeather = () => {
    if (!settings || settings.weatherMode !== "live") return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    loading = true;
    error = undefined;
    report();
    fetchLiveWeather(settings, controller.signal)
      .then((reading) => {
        snapshot = reading;
        loading = false;
        error = undefined;
        report();
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        loading = false;
        error = reason instanceof Error ? reason.message : "Live weather is unavailable.";
        report();
      })
      .finally(() => {
        if (request === controller) scheduleRefresh();
      });
  };

  const refreshSeasonMaterials = (root: THREE.Object3D = options.scene) => {
    const season = getSeason();
    const color = new THREE.Color(FOLIAGE_COLORS[season]);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.userData.windSway) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        if (!material.userData.environmentBaseColor) material.userData.environmentBaseColor = `#${material.color.getHexString()}`;
        material.color.copy(color);
      });
    });
  };

  const apply = (nextSettings: EnvironmentSettings) => {
    const weatherTargetChanged = !settings
      || settings.weatherMode !== nextSettings.weatherMode
      || settings.latitude !== nextSettings.latitude
      || settings.longitude !== nextSettings.longitude;
    settings = { ...nextSettings };
    const season = getSeason();
    if (lastSeason !== season || lastFoliage !== settings.foliage) {
      lastSeason = season;
      lastFoliage = settings.foliage;
      setFallingFoliageAppearance(options.petals, settings.foliage, season);
      refreshSeasonMaterials();
    }
    if (settings.weatherMode === "manual") {
      request?.abort();
      snapshot = undefined;
      loading = false;
      error = undefined;
      scheduleRefresh();
      report();
    } else if (weatherTargetChanged || !snapshot) {
      refreshWeather();
    } else {
      report();
    }
  };

  const update = (time: number, delta: number) => {
    if (!settings) return;
    const localHour = getLocalHour();
    const weather = getWeather();
    const season = getSeason();
    if (season !== lastSeason) {
      lastSeason = season;
      setFallingFoliageAppearance(options.petals, settings.foliage, season);
      refreshSeasonMaterials();
      report();
    }

    const daylight = THREE.MathUtils.clamp(Math.sin(((localHour - 5.5) / 13) * Math.PI), 0, 1);
    const night = 1 - daylight;
    const overcast = weather === "cloudy" ? 0.18 : weather === "rain" ? 0.34 : weather === "storm" ? 0.48 : weather === "snow" ? 0.14 : 0;
    const brightness = THREE.MathUtils.clamp(daylight * (1 - overcast), 0.14, 1);
    const dayBackground = new THREE.Color(DAY_BACKGROUNDS[season]);
    const nightBackground = new THREE.Color("#304153");
    const stormBackground = new THREE.Color("#748087");
    const targetBackground = nightBackground.clone().lerp(dayBackground, Math.max(brightness, 0.08));
    if (overcast > 0) targetBackground.lerp(stormBackground, overcast * 0.52);
    const background = options.scene.background instanceof THREE.Color ? options.scene.background : new THREE.Color(targetBackground);
    background.lerp(targetBackground, 1 - Math.exp(-delta * 2.4));
    options.scene.background = background;
    if (options.scene.fog instanceof THREE.Fog) {
      options.scene.fog.color.copy(background);
      options.scene.fog.near = THREE.MathUtils.damp(options.scene.fog.near, weather === "storm" ? 30 : weather === "rain" ? 38 : 48, 2.4, delta);
      options.scene.fog.far = THREE.MathUtils.damp(options.scene.fog.far, weather === "storm" ? 70 : weather === "rain" ? 82 : 104, 2.4, delta);
    }

    options.lights.sun.intensity = THREE.MathUtils.damp(options.lights.sun.intensity, 0.24 + brightness * 1.44, 3.2, delta);
    options.lights.hemisphere.intensity = THREE.MathUtils.damp(options.lights.hemisphere.intensity, 0.31 + brightness * 0.46, 3.2, delta);
    options.lights.fill.intensity = THREE.MathUtils.damp(options.lights.fill.intensity, 0.2 + night * 0.2, 3.2, delta);
    options.lights.sun.color.lerp(new THREE.Color(daylight > 0.22 ? "#ffedd2" : "#efb487"), 1 - Math.exp(-delta * 2));
    options.lights.hemisphere.color.lerp(new THREE.Color(daylight > 0.2 ? "#fff6e6" : "#7185a0"), 1 - Math.exp(-delta * 2));
    const sunAngle = ((localHour - 6) / 24) * Math.PI * 2;
    options.lights.sun.position.set(Math.cos(sunAngle) * 34, 10 + daylight * 34, Math.sin(sunAngle) * 30);
    options.scene.environmentIntensity = THREE.MathUtils.damp(options.scene.environmentIntensity, 0.08 + brightness * 0.14, 2.6, delta);

    const cloudOpacity = weather === "clear" ? 0.38 : weather === "cloudy" ? 0.68 : 0.82;
    options.atmosphere.forEach((cloud) => {
      cloud.object.visible = true;
      cloud.object.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
        object.material.opacity = THREE.MathUtils.damp(object.material.opacity, cloudOpacity, 2.4, delta);
      });
    });

    const fireflyVisibility = THREE.MathUtils.smoothstep(night, 0.35, 0.78) * (weather === "storm" ? 0.25 : weather === "rain" ? 0.55 : 1);
    options.fireflies.core.visible = fireflyVisibility > 0.04;
    options.fireflies.halo.visible = fireflyVisibility > 0.04;
    options.fireflies.core.material.opacity = 0.76 * fireflyVisibility;
    options.fireflies.halo.material.opacity = 0.12 * fireflyVisibility;
    options.petals.mesh.visible = settings.foliage !== "off" && weather !== "storm";
    updateWeatherParticles(options.weatherParticles, delta, time, weather, snapshot?.windSpeed ?? 8);

    const currentMinute = Math.floor(localHour * 60);
    if (currentMinute !== lastReportedMinute) {
      lastReportedMinute = currentMinute;
      report();
    }
  };

  return { apply, refreshWeather, refreshSeasonMaterials, update };
}

function normalizeSeasonForCycle(
  season: Exclude<SeasonChoice, "auto">,
  cycle: EnvironmentSettings["seasonCycle"]
): Exclude<SeasonChoice, "auto"> {
  if (cycle === "two") return season === "wet" || season === "dry" ? season : season === "winter" || season === "spring" ? "wet" : "dry";
  if (season === "wet") return "spring";
  if (season === "dry") return "summer";
  return season;
}
