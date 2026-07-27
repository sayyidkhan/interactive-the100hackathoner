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

export type HairStyle = "crop" | "swept" | "afro" | "bald";

export type CharacterAppearance = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  trim: string;
  pants: string;
  shoes: string;
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
  player: CharacterSchema;
  citizens: CharacterSchema[];
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

const HAIR_STYLES = new Set<HairStyle>(["crop", "swept", "afro", "bald"]);

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
  for (const color of [appearance.skin, appearance.hair, appearance.shirt, appearance.trim, appearance.pants, appearance.shoes]) {
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error(`Character ${value.id} has an invalid color.`);
    }
  }
  if (value.kind === "citizen") assertPosition(value.position, `Citizen ${value.id}`);
}

export const SHIPPED_TOWN_SCHEMA = parseTownSchema(rawTownSchema);
