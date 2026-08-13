import * as SunCalc from "suncalc";
import { type EnvironmentSettings } from "../data/townSchema";

export type MoonSnapshot = {
  phase: number;
  fraction: number;
  phaseName: string;
  angle: number;
  altitude: number;
  azimuth: number;
  parallacticAngle: number;
  rise?: Date;
  set?: Date;
  aboveHorizon: boolean;
};

const MOON_PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent"
] as const;

export function getTownDate(settings: EnvironmentSettings, localHour: number): Date {
  if (settings.dayNightMode !== "manual") return new Date();

  const townNow = new Date(Date.now() + settings.timezoneOffset * 60 * 60 * 1000);
  const hours = Math.floor(localHour);
  const minutes = Math.round((localHour - hours) * 60);
  const townTimeAsUtc = Date.UTC(
    townNow.getUTCFullYear(),
    townNow.getUTCMonth(),
    townNow.getUTCDate(),
    hours,
    minutes
  );
  return new Date(townTimeAsUtc - settings.timezoneOffset * 60 * 60 * 1000);
}

export function getMoonSnapshot(
  date: Date,
  latitude: number,
  longitude: number
): MoonSnapshot {
  const position = SunCalc.getMoonPosition(date, latitude, longitude);
  const illumination = SunCalc.getMoonIllumination(date);
  const times = SunCalc.getMoonTimes(date, latitude, longitude);

  return {
    phase: illumination.phase,
    fraction: illumination.fraction,
    phaseName: getMoonPhaseName(illumination.phase),
    angle: degreesToRadians(illumination.angle),
    altitude: degreesToRadians(position.altitude),
    azimuth: degreesToRadians(position.azimuth),
    parallacticAngle: degreesToRadians(position.parallacticAngle),
    rise: times.rise,
    set: times.set,
    aboveHorizon: position.altitude > 0
  };
}

export function getMoonPhaseName(phase: number): string {
  return MOON_PHASE_NAMES[Math.round(normalizePhase(phase) * 8) % 8];
}

function normalizePhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}
