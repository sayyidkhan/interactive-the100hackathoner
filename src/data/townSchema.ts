import rawTownSchema from "./town.schema.json";

export type TownAssetType =
  | "building"
  | "market"
  | "booth"
  | "parcelCart"
  | "communityBoard"
  | "welcomeSign"
  | "fountain"
  | "monument"
  | "waterTower"
  | "tree"
  | "lamp"
  | "shrub"
  | "picnicTable"
  | "bench"
  | "flowerBed"
  | "fence"
  | "rock"
  | "tinyFlag"
  | "gardenPlot"
  | "grassClump";

export type HairStyle =
  | "crop"
  | "swept"
  | "afro"
  | "bald"
  | "bob"
  | "bun"
  | "braids"
  | "coily"
  | "mohawk"
  | "long";

export type BodyPreset = "compact" | "average" | "tall" | "broad";
export type FaceStyle = "soft" | "round" | "bright";
export type AccessoryStyle = "none" | "glasses" | "cap" | "beanie";
export type WeatherMode = "live" | "manual";
export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "snow";
export type DayNightMode = "timezone" | "manual";
export type SeasonCycle = "four" | "two";
export type SeasonChoice = "auto" | "spring" | "summer" | "autumn" | "winter" | "wet" | "dry";
export type FallingFoliage = "off" | "sakura" | "leaves" | "mixed";
export type AnimalKind = "corgi" | "goose";

export type EnvironmentSettings = {
  weatherMode: WeatherMode;
  weather: WeatherCondition;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
  dayNightMode: DayNightMode;
  manualHour: number;
  seasonCycle: SeasonCycle;
  season: SeasonChoice;
  foliage: FallingFoliage;
};

export type CharacterAppearance = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  trim: string;
  pants: string;
  shoes: string;
  bodyPreset?: BodyPreset;
  faceStyle?: FaceStyle;
  accessory?: AccessoryStyle;
};

export type CharacterSchema = {
  id: string;
  kind: "player" | "citizen";
  appearance: CharacterAppearance;
  position?: [number, number];
  radius?: number;
  speed?: number;
  phase?: number;
  speech?: string;
  movement?: { walk: number; sprint: number; jump: number };
};

export type AnimalSchema = {
  id: string;
  kind: AnimalKind;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  speed: number;
  route: [number, number][];
  phase?: number;
  bob?: number;
};

export type TownCollision =
  | { kind: "box"; width: number; depth: number; top?: number }
  | { kind: "circle"; radius: number; top?: number };

export type TownAsset = {
  id: string;
  type: TownAssetType;
  position: [number, number];
  label?: string;
  color?: string;
  roofColor?: string;
  stripeColor?: string;
  rotation?: number;
  scale?: number;
  variant?: number;
  lawn?: { position: [number, number]; width?: number; depth?: number };
  collision?: TownCollision;
};

export type TownSchema = {
  version: number;
  town: { name: string };
  environment: EnvironmentSettings;
  player: CharacterSchema;
  citizens: CharacterSchema[];
  animals: AnimalSchema[];
  assets: TownAsset[];
};

const ASSET_TYPES = new Set<TownAssetType>([
  "building",
  "market",
  "booth",
  "parcelCart",
  "communityBoard",
  "welcomeSign",
  "fountain",
  "monument",
  "waterTower",
  "tree",
  "lamp",
  "shrub",
  "picnicTable",
  "bench",
  "flowerBed",
  "fence",
  "rock",
  "tinyFlag",
  "gardenPlot",
  "grassClump"
]);

const BUILDER_PROP_ASSET_IDS = new Set([
  "shrub-plaza-west",
  "shrub-plaza-east",
  "shrub-northwest",
  "shrub-northeast",
  "shrub-founders-hall",
  "shrub-south-path",
  "picnic-table-west",
  "picnic-table-north",
  "bench-plaza-west",
  "bench-plaza-east",
  "bench-plaza-north",
  "flower-bed-west",
  "flower-bed-east",
  "flower-bed-northeast",
  "fence-northeast",
  "fence-northwest",
  "rock-west",
  "rock-southeast",
  "rock-northeast",
  "flag-west",
  "flag-east",
  "flag-north",
  "garden-west",
  "garden-northeast",
  "grass-clump-01",
  "grass-clump-02",
  "grass-clump-03",
  "grass-clump-04",
  "grass-clump-05",
  "grass-clump-06",
  "grass-clump-07",
  "grass-clump-08",
  "grass-clump-09",
  "grass-clump-10"
]);

const HAIR_STYLES = new Set<HairStyle>(["crop", "swept", "afro", "bald", "bob", "bun", "braids", "coily", "mohawk", "long"]);
const BODY_PRESETS = new Set<BodyPreset>(["compact", "average", "tall", "broad"]);
const FACE_STYLES = new Set<FaceStyle>(["soft", "round", "bright"]);
const ACCESSORY_STYLES = new Set<AccessoryStyle>(["none", "glasses", "cap", "beanie"]);
const WEATHER_MODES = new Set<WeatherMode>(["live", "manual"]);
const WEATHER_CONDITIONS = new Set<WeatherCondition>(["clear", "cloudy", "rain", "storm", "snow"]);
const DAY_NIGHT_MODES = new Set<DayNightMode>(["timezone", "manual"]);
const SEASON_CYCLES = new Set<SeasonCycle>(["four", "two"]);
const SEASON_CHOICES = new Set<SeasonChoice>(["auto", "spring", "summer", "autumn", "winter", "wet", "dry"]);
const FALLING_FOLIAGE = new Set<FallingFoliage>(["off", "sakura", "leaves", "mixed"]);
const ANIMAL_KINDS = new Set<AnimalKind>(["corgi", "goose"]);

export const DEFAULT_ENVIRONMENT_SETTINGS: EnvironmentSettings = {
  weatherMode: "live",
  weather: "clear",
  latitude: 1.3521,
  longitude: 103.8198,
  timezoneOffset: 8,
  dayNightMode: "timezone",
  manualHour: 14,
  seasonCycle: "two",
  season: "auto",
  foliage: "sakura"
};

export const DEFAULT_TOWN_ANIMALS: AnimalSchema[] = [
  {
    id: "animal-goose",
    kind: "goose",
    label: "Puddle",
    primaryColor: "#f7f0df",
    secondaryColor: "#d89035",
    speed: 0.72,
    route: [[2.8, 3.3], [5.4, 2.8], [7.1, 4.5], [5.8, 6.2], [2.6, 6.1], [1.7, 4.5], [4.2, 5.1]],
    phase: 0.2,
    bob: 0.025
  },
  {
    id: "animal-corgi",
    kind: "corgi",
    label: "Mochi",
    primaryColor: "#c17b3f",
    secondaryColor: "#f0dfbe",
    speed: 1.05,
    route: [[-6.6, -2.8], [-4.3, -5.7], [-0.8, -6.2], [2.7, -4.2], [3.4, -1.7], [-1.8, -2.6], [-5.1, -1.1], [0.8, -3.4]],
    phase: 2.4,
    bob: 0.035
  }
];

export const TOWN_SCHEMA_STORAGE_KEY = "the100hackathoner.town-schema.v1";

export function cloneTownSchema(schema: TownSchema): TownSchema {
  return JSON.parse(JSON.stringify(schema)) as TownSchema;
}

export function parseTownSchema(value: unknown): TownSchema {
  if (!value || typeof value !== "object") throw new Error("Town schema must be an object.");
  const candidate = value as Partial<TownSchema>;
  if (candidate.version !== 1) throw new Error("Town schema version must be 1.");
  if (!candidate.town || typeof candidate.town.name !== "string") throw new Error("Town schema needs a town name.");
  if (!candidate.player || candidate.player.kind !== "player") throw new Error("Town schema needs a player definition.");
  if (!Array.isArray(candidate.citizens) || !Array.isArray(candidate.assets)) throw new Error("Town schema needs citizens and assets arrays.");
  candidate.environment = parseEnvironmentSettings(candidate.environment);
  candidate.animals = parseAnimals(candidate.animals);

  const assetIds = new Set<string>();
  candidate.assets.forEach((asset) => {
    if (!asset || typeof asset.id !== "string" || !ASSET_TYPES.has(asset.type)) {
      throw new Error("Each town asset needs an id and supported type.");
    }
    if (assetIds.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
    assetIds.add(asset.id);
    assertPosition(asset.position, `Asset ${asset.id}`);
    if (asset.scale !== undefined && (!Number.isFinite(asset.scale) || asset.scale <= 0)) {
      throw new Error(`Asset ${asset.id} has an invalid scale.`);
    }
  });

  [candidate.player, ...candidate.citizens].forEach((character) => assertCharacter(character));
  return candidate as TownSchema;
}

function parseAnimals(value: unknown): AnimalSchema[] {
  const animals = Array.isArray(value)
    ? value
    : DEFAULT_TOWN_ANIMALS.map((animal) => ({ ...animal, route: animal.route.map((position) => [...position] as [number, number]) }));
  const ids = new Set<string>();
  animals.forEach((animal) => {
    if (!animal || typeof animal !== "object") throw new Error("Animal must be an object.");
    const candidate = animal as AnimalSchema;
    if (typeof candidate.id !== "string" || !ANIMAL_KINDS.has(candidate.kind) || typeof candidate.label !== "string") {
      throw new Error("Animal needs an id, name, and supported species.");
    }
    if (ids.has(candidate.id)) throw new Error(`Duplicate animal id: ${candidate.id}`);
    ids.add(candidate.id);
    for (const color of [candidate.primaryColor, candidate.secondaryColor]) {
      if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Animal ${candidate.id} has an invalid color.`);
    }
    if (!Number.isFinite(candidate.speed) || candidate.speed < 0.2 || candidate.speed > 2) {
      throw new Error(`Animal ${candidate.id} has an invalid speed.`);
    }
    if (!Array.isArray(candidate.route) || candidate.route.length < 2) throw new Error(`Animal ${candidate.id} needs at least two route points.`);
    candidate.route.forEach((position) => assertPosition(position, `Animal ${candidate.id} route`));
  });
  return animals as AnimalSchema[];
}

function parseEnvironmentSettings(value: unknown): EnvironmentSettings {
  const candidate = value && typeof value === "object" ? value as Partial<EnvironmentSettings> : {};
  const settings: EnvironmentSettings = {
    ...DEFAULT_ENVIRONMENT_SETTINGS,
    ...candidate
  };
  if (!WEATHER_MODES.has(settings.weatherMode)) throw new Error("Town environment has an invalid weather mode.");
  if (!WEATHER_CONDITIONS.has(settings.weather)) throw new Error("Town environment has an invalid weather condition.");
  if (!DAY_NIGHT_MODES.has(settings.dayNightMode)) throw new Error("Town environment has an invalid day/night mode.");
  if (!SEASON_CYCLES.has(settings.seasonCycle)) throw new Error("Town environment has an invalid season cycle.");
  if (!SEASON_CHOICES.has(settings.season)) throw new Error("Town environment has an invalid season.");
  if (!FALLING_FOLIAGE.has(settings.foliage)) throw new Error("Town environment has invalid falling foliage.");
  if (!Number.isFinite(settings.latitude) || settings.latitude < -90 || settings.latitude > 90) {
    throw new Error("Town environment has an invalid latitude.");
  }
  if (!Number.isFinite(settings.longitude) || settings.longitude < -180 || settings.longitude > 180) {
    throw new Error("Town environment has an invalid longitude.");
  }
  if (!Number.isFinite(settings.timezoneOffset) || settings.timezoneOffset < -12 || settings.timezoneOffset > 14) {
    throw new Error("Town environment has an invalid timezone.");
  }
  if (!Number.isFinite(settings.manualHour) || settings.manualHour < 0 || settings.manualHour > 23) {
    throw new Error("Town environment has an invalid manual hour.");
  }
  return settings;
}

export function loadTownSchemaDraft(): TownSchema {
  try {
    const saved = window.localStorage.getItem(TOWN_SCHEMA_STORAGE_KEY);
    if (!saved) return cloneTownSchema(SHIPPED_TOWN_SCHEMA);
    return mergeNewBuilderProps(parseTownSchema(JSON.parse(saved)));
  } catch {
    return cloneTownSchema(SHIPPED_TOWN_SCHEMA);
  }
}

export function saveTownSchemaDraft(schema: TownSchema): void {
  window.localStorage.setItem(TOWN_SCHEMA_STORAGE_KEY, JSON.stringify(schema));
}

export function clearTownSchemaDraft(): void {
  window.localStorage.removeItem(TOWN_SCHEMA_STORAGE_KEY);
}

function assertPosition(position: unknown, label: string): asserts position is [number, number] {
  if (!Array.isArray(position) || position.length !== 2 || !position.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error(`${label} needs a valid [x, z] position.`);
  }
}

function mergeNewBuilderProps(schema: TownSchema): TownSchema {
  const assetIds = new Set(schema.assets.map((asset) => asset.id));
  const missingProps = SHIPPED_TOWN_SCHEMA.assets.filter(
    (asset) => BUILDER_PROP_ASSET_IDS.has(asset.id) && !assetIds.has(asset.id)
  );
  if (missingProps.length === 0) return schema;
  return {
    ...schema,
    assets: [...schema.assets, ...cloneTownSchema({ ...SHIPPED_TOWN_SCHEMA, assets: missingProps }).assets]
  };
}

function assertCharacter(character: unknown): asserts character is CharacterSchema {
  if (!character || typeof character !== "object") throw new Error("Character must be an object.");
  const value = character as CharacterSchema;
  if (typeof value.id !== "string" || (value.kind !== "player" && value.kind !== "citizen")) {
    throw new Error("Character needs an id and kind.");
  }
  const appearance = value.appearance;
  if (!appearance || !HAIR_STYLES.has(appearance.hairStyle)) throw new Error(`Character ${value.id} has an invalid appearance.`);
  if (appearance.bodyPreset !== undefined && !BODY_PRESETS.has(appearance.bodyPreset)) throw new Error(`Character ${value.id} has an invalid body preset.`);
  if (appearance.faceStyle !== undefined && !FACE_STYLES.has(appearance.faceStyle)) throw new Error(`Character ${value.id} has an invalid face style.`);
  if (appearance.accessory !== undefined && !ACCESSORY_STYLES.has(appearance.accessory)) throw new Error(`Character ${value.id} has an invalid accessory.`);
  for (const color of [appearance.skin, appearance.hair, appearance.shirt, appearance.trim, appearance.pants, appearance.shoes]) {
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error(`Character ${value.id} has an invalid color.`);
    }
  }
  if (value.kind === "citizen") assertPosition(value.position, `Citizen ${value.id}`);
}

export const SHIPPED_TOWN_SCHEMA = parseTownSchema(rawTownSchema);
