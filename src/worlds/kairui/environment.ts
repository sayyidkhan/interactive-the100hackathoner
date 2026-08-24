import * as THREE from "three";

export type CoastalSeason = "spring" | "summer" | "autumn" | "winter";
export type CoastalWeather = "clear" | "rain" | "storm";
export type CoastalTimeMode = "live" | "day" | "sunset" | "night";

export type CoastalEnvironmentState = {
  season: CoastalSeason;
  weather: CoastalWeather;
  time: CoastalTimeMode;
};

export type CoastalPalette = {
  skyHorizon: string;
  skyZenith: string;
  waterDeep: string;
  waterShallow: string;
  grass: string;
  grassDark: string;
  sand: string;
  fog: string;
  sunlight: string;
  hemisphereSky: string;
  hemisphereGround: string;
  sunIntensity: number;
  hemisphereIntensity: number;
  exposure: number;
  isNight: boolean;
};

export const DEFAULT_COASTAL_ENVIRONMENT: CoastalEnvironmentState = {
  season: "summer",
  weather: "clear",
  time: "live"
};

export function resolveCoastalPalette(state: CoastalEnvironmentState, date = new Date()): CoastalPalette {
  const hour = getSingaporeHour(date);
  const effectiveHour = state.time === "day"
    ? 13
    : state.time === "sunset"
      ? 18.35
      : state.time === "night"
        ? 22
        : hour;
  const isNight = effectiveHour < 6.3 || effectiveHour >= 19.2;
  const isSunset = !isNight && (effectiveHour < 7.5 || effectiveHour >= 17.2);

  const season = {
    spring: { grass: "#82a978", grassDark: "#537c61", sand: "#e4cea2", water: "#8cc8bd" },
    summer: { grass: "#789d71", grassDark: "#4d7658", sand: "#dfc99c", water: "#78bbb3" },
    autumn: { grass: "#9a9561", grassDark: "#766942", sand: "#d8bd8c", water: "#729f9c" },
    winter: { grass: "#8aa37c", grassDark: "#637d69", sand: "#e0d6bd", water: "#83a9ad" }
  }[state.season];

  let palette: CoastalPalette = isNight
    ? {
        skyHorizon: "#334c63",
        skyZenith: "#111b32",
        waterDeep: "#183f53",
        waterShallow: "#35686e",
        grass: "#3d5a4a",
        grassDark: "#294438",
        sand: "#6c7165",
        fog: "#334c58",
        sunlight: "#9bb8d8",
        hemisphereSky: "#9db7d8",
        hemisphereGround: "#263a3b",
        sunIntensity: 0.32,
        hemisphereIntensity: 0.56,
        exposure: 0.68,
        isNight: true
      }
    : isSunset
      ? {
          skyHorizon: "#f06f4f",
          skyZenith: "#c43f4d",
          waterDeep: "#293f4e",
          waterShallow: "#756f69",
          grass: new THREE.Color(season.grass).lerp(new THREE.Color("#5f683f"), 0.34).getStyle(),
          grassDark: new THREE.Color(season.grassDark).lerp(new THREE.Color("#384434"), 0.4).getStyle(),
          sand: season.sand,
          fog: "#b86455",
          sunlight: "#ffd09a",
          hemisphereSky: "#df8064",
          hemisphereGround: "#394534",
          sunIntensity: 1.42,
          hemisphereIntensity: 0.54,
          exposure: 0.9,
          isNight: false
        }
      : {
          skyHorizon: "#f7dfb5",
          skyZenith: "#83b4c6",
          waterDeep: "#397f90",
          waterShallow: season.water,
          grass: season.grass,
          grassDark: season.grassDark,
          sand: season.sand,
          fog: "#e8d5b6",
          sunlight: "#ffe0ad",
          hemisphereSky: "#fff1d7",
          hemisphereGround: "#517a6a",
          sunIntensity: 1.16,
          hemisphereIntensity: 0.78,
          exposure: 1.06,
          isNight: false
        };

  if (state.weather === "rain") {
    palette = {
      ...palette,
      skyHorizon: isNight ? "#293c4c" : "#8a9b9c",
      skyZenith: isNight ? "#101827" : "#607885",
      fog: isNight ? "#30434c" : "#80928f",
      sunIntensity: palette.sunIntensity * 0.45,
      hemisphereIntensity: palette.hemisphereIntensity * 0.75,
      exposure: palette.exposure * 0.84
    };
  } else if (state.weather === "storm") {
    palette = {
      ...palette,
      skyHorizon: "#35434c",
      skyZenith: "#172431",
      fog: "#3f5053",
      waterDeep: "#173f4a",
      waterShallow: "#496d70",
      sunIntensity: 0.12,
      hemisphereIntensity: 0.43,
      exposure: 0.58,
      isNight: true
    };
  }

  return palette;
}

export function getSingaporeHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return (values.hour ?? 0) + (values.minute ?? 0) / 60 + (values.second ?? 0) / 3600;
}

export function formatSingaporeTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export function setMaterialColor(material: THREE.Material, color: THREE.ColorRepresentation): void {
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
    material.color.set(color);
  }
}
