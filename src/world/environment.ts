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
  getMoonSnapshot,
  getTownDate,
  type MoonSnapshot
} from "../systems/astronomy";
import {
  type AtmosphereObject,
  type Firefly,
  type MoonVisual,
  type SakuraPetal,
  type WeatherParticles,
  setFallingFoliageAppearance,
  updateMoonTexture,
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
  moon?: MoonSnapshot;
};

type EnvironmentControllerOptions = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lights: TownLights;
  atmosphere: AtmosphereObject[];
  moon: MoonVisual;
  petals: SakuraPetal;
  fireflies: Firefly;
  weatherParticles: WeatherParticles;
  onStatus: (status: EnvironmentRuntimeStatus) => void;
};

export type EnvironmentController = {
  apply: (settings: EnvironmentSettings) => void;
  refreshWeather: (force?: boolean) => void;
  refreshSeasonMaterials: (root?: THREE.Object3D) => void;
  update: (time: number, delta: number) => void;
};

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_REFRESH_JITTER_MS = 2 * 60 * 1000;
type EnvironmentMaterialRole = "ground" | "lawn" | "foliage" | "bloom" | "path" | "water";
type SeasonPalette = Record<EnvironmentMaterialRole, string> & {
  background: string;
  sun: string;
  sky: string;
  environmentBoost: number;
};
const SEASON_PALETTES: Record<Exclude<SeasonChoice, "auto">, SeasonPalette> = {
  spring: {
    background: "#f5e3df",
    ground: "#a8ca93",
    lawn: "#9dbe7e",
    foliage: "#78a45f",
    bloom: "#e99cab",
    path: "#ead5b7",
    water: "#68b2c0",
    sun: "#ffe6cf",
    sky: "#fff5e8",
    environmentBoost: 1.04
  },
  summer: {
    background: "#f4e7cc",
    ground: "#9cbe7f",
    lawn: "#8fae6b",
    foliage: "#4f814d",
    bloom: "#efb355",
    path: "#dfc7a4",
    water: "#4da7be",
    sun: "#fff0c0",
    sky: "#fff8dc",
    environmentBoost: 1.12
  },
  autumn: {
    background: "#edd9c8",
    ground: "#b6aa76",
    lawn: "#a4935e",
    foliage: "#b66536",
    bloom: "#cf8247",
    path: "#dfc09d",
    water: "#6b9ca8",
    sun: "#f6c27f",
    sky: "#f7dfbf",
    environmentBoost: 0.96
  },
  winter: {
    background: "#e2eaeb",
    ground: "#cbd5cb",
    lawn: "#bbc8b9",
    foliage: "#878b80",
    bloom: "#c5c3bd",
    path: "#d8d4c9",
    water: "#769ea8",
    sun: "#e7f0f5",
    sky: "#edf4f5",
    environmentBoost: 0.86
  },
  wet: {
    background: "#e0e8df",
    ground: "#92b78a",
    lawn: "#81a879",
    foliage: "#4e8050",
    bloom: "#db9aa6",
    path: "#d2c1a6",
    water: "#4c9fb4",
    sun: "#dfeadf",
    sky: "#e5efec",
    environmentBoost: 0.9
  },
  dry: {
    background: "#f0dfc6",
    ground: "#b7ad7b",
    lawn: "#a79b69",
    foliage: "#987a46",
    bloom: "#d89454",
    path: "#dec29b",
    water: "#6aa3ad",
    sun: "#f3c982",
    sky: "#f5dfbd",
    environmentBoost: 0.94
  }
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
  let moonSnapshot: MoonSnapshot | undefined;
  let lastMoonMinute = -1;
  const moonOffset = new THREE.Vector3();

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
      localHour: getLocalHour(),
      moon: moonSnapshot
    });
  };

  const scheduleRefresh = () => {
    if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    if (settings.weatherMode !== "live") return;
    const delay = WEATHER_REFRESH_MS + Math.random() * WEATHER_REFRESH_JITTER_MS;
    refreshTimer = window.setTimeout(() => refreshWeather(false), delay);
  };

  const refreshWeather = (force = false) => {
    if (!settings || settings.weatherMode !== "live") return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    loading = true;
    error = undefined;
    report();
    fetchLiveWeather(settings, controller.signal, { force })
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
    const palette = SEASON_PALETTES[season];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const role = (
        object.userData.environmentRole
        ?? (object.userData.windSway ? "foliage" : undefined)
      ) as EnvironmentMaterialRole | undefined;
      if (!role || !(role in palette)) return;
      const color = new THREE.Color(palette[role]);
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
    const astronomyTargetChanged = !settings
      || settings.latitude !== nextSettings.latitude
      || settings.longitude !== nextSettings.longitude
      || settings.timezoneOffset !== nextSettings.timezoneOffset
      || settings.dayNightMode !== nextSettings.dayNightMode
      || settings.manualHour !== nextSettings.manualHour;
    settings = { ...nextSettings };
    if (astronomyTargetChanged) lastMoonMinute = -1;
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
    const currentMinute = Math.floor(localHour * 60);
    if (!moonSnapshot || currentMinute !== lastMoonMinute) {
      lastMoonMinute = currentMinute;
      moonSnapshot = getMoonSnapshot(
        getTownDate(settings, localHour),
        settings.latitude,
        settings.longitude
      );
      updateMoonTexture(options.moon, moonSnapshot.phase);
    }
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
    const palette = SEASON_PALETTES[season];
    const dayBackground = new THREE.Color(palette.background);
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
    const weatherMoonVisibility = weather === "clear"
      ? 1
      : weather === "cloudy"
        ? 0.58
        : weather === "snow"
          ? 0.42
          : weather === "rain"
            ? 0.24
            : 0.1;
    const moonVisibility = THREE.MathUtils.smoothstep(night, 0.42, 0.82) * weatherMoonVisibility;
    const moonLight = moonSnapshot ? moonVisibility * (0.025 + moonSnapshot.fraction * 0.11) : 0;
    options.lights.fill.intensity = THREE.MathUtils.damp(options.lights.fill.intensity, 0.2 + night * 0.2 + moonLight, 3.2, delta);
    const daylightBlend = THREE.MathUtils.smoothstep(daylight, 0.12, 0.58);
    const seasonalSun = new THREE.Color("#efb487").lerp(new THREE.Color(palette.sun), daylightBlend);
    const seasonalSky = new THREE.Color("#7185a0").lerp(new THREE.Color(palette.sky), daylightBlend);
    options.lights.sun.color.lerp(seasonalSun, 1 - Math.exp(-delta * 2));
    options.lights.hemisphere.color.lerp(seasonalSky, 1 - Math.exp(-delta * 2));
    const sunAngle = ((localHour - 6) / 24) * Math.PI * 2;
    options.lights.sun.position.set(Math.cos(sunAngle) * 34, 10 + daylight * 34, Math.sin(sunAngle) * 30);
    options.scene.environmentIntensity = THREE.MathUtils.damp(
      options.scene.environmentIntensity,
      (0.08 + brightness * 0.14) * palette.environmentBoost,
      2.6,
      delta
    );

    if (moonSnapshot) {
      const altitudeLift = THREE.MathUtils.clamp(
        (moonSnapshot.altitude + Math.PI / 2) / Math.PI,
        0.22,
        0.78
      );
      moonOffset.set(18, 8 + altitudeLift * 17, -104).applyQuaternion(options.camera.quaternion);
      options.moon.group.position.copy(options.camera.position).add(moonOffset);
      options.moon.group.visible = moonVisibility > 0.015;
      const diskMaterial = options.moon.disk.material as THREE.SpriteMaterial;
      const glowMaterial = options.moon.glow.material as THREE.SpriteMaterial;
      diskMaterial.opacity = THREE.MathUtils.damp(
        diskMaterial.opacity,
        moonVisibility * (0.56 + moonSnapshot.fraction * 0.44),
        3.2,
        delta
      );
      diskMaterial.rotation = moonSnapshot.angle - moonSnapshot.parallacticAngle;
      glowMaterial.opacity = THREE.MathUtils.damp(
        glowMaterial.opacity,
        moonVisibility * (0.06 + moonSnapshot.fraction * 0.2),
        2.8,
        delta
      );
    }

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
