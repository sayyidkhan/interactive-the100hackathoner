import * as THREE from "three";
import {
  AnimalSchema,
  CharacterAppearance,
  CharacterSchema,
  EnvironmentSettings,
  FallingFoliage,
  SeasonChoice,
  TownAsset,
  TownAssetType,
  TownSchema,
  clearTownSchemaDraft,
  cloneTownSchema,
  parseTownSchema,
  saveTownSchemaDraft
} from "../data/townSchema";
import { type EnvironmentRuntimeStatus } from "../world/environment";

type BuilderSelection =
  | { kind: "asset"; id: string }
  | { kind: "player" }
  | { kind: "citizen"; id: string }
  | { kind: "animal"; id: string };
type BuilderConfirmation =
  | { kind: "delete-asset"; assetId: string; assetName: string }
  | { kind: "reset-draft" };

export type TownBuilderApi = {
  isActive: () => boolean;
  getPlacementAssetId: () => string | null;
  selectAsset: (id: string) => void;
  selectCharacter: (kind: "player" | "citizen", id?: string) => void;
  selectAnimal: (id: string) => void;
  moveAsset: (id: string, x: number, z: number) => void;
  commitAssetMove: () => void;
  getSchema: () => TownSchema;
};

type BuilderOptions = {
  initialSchema: TownSchema;
  shippedSchema: TownSchema;
  startActive?: boolean;
  onSchemaChange: (schema: TownSchema) => void;
  onActiveChange: (active: boolean) => void;
  onSelectionChange?: (asset: TownAsset | null) => void;
  onAssetPositionPreview?: (asset: TownAsset) => void;
  createAssetPreview?: (asset: TownAsset) => THREE.Object3D | null;
  createCharacterPreview?: (character: CharacterSchema) => THREE.Object3D | null;
  createAnimalPreview?: (animal: AnimalSchema) => THREE.Object3D | null;
  onCameraZoom?: (amount: number) => void;
  onCameraReset?: () => void;
};

type AssetPreview = {
  attach: (host: HTMLElement) => void;
  update: (source: THREE.Object3D) => void;
  dispose: () => void;
};

type TilePreviewRenderer = {
  render: (type: TownAssetType) => string | null;
  dispose: () => void;
};

const ASSET_TYPES: TownAssetType[] = ["building", "market", "booth", "picnicTable", "bench", "tree", "shrub", "flowerBed", "gardenPlot", "rock", "fence", "grassClump", "lamp", "tinyFlag", "communityBoard", "parcelCart", "fountain", "monument", "welcomeSign", "waterTower"];
type AppearanceColorField = "skin" | "hair" | "shirt" | "trim" | "pants" | "shoes";
const COLOR_FIELDS: AppearanceColorField[] = ["skin", "hair", "shirt", "trim", "pants", "shoes"];
const GRID_SNAP = 0.5;
const PLACEMENT_LIMIT = 28;
const RENDER_RESOURCE_BUDGET = 480;
const ASSET_SLOT_BUDGET = 120;
const POPULATION_BUDGET = 24;
const CHARACTER_RESOURCE_COST = 6;
const ANIMAL_RESOURCE_COST = 4;
const ASSET_RESOURCE_COST: Record<TownAssetType, number> = {
  building: 18,
  market: 8,
  booth: 7,
  parcelCart: 4,
  communityBoard: 4,
  welcomeSign: 5,
  fountain: 12,
  monument: 12,
  waterTower: 18,
  tree: 3,
  lamp: 2,
  shrub: 1,
  picnicTable: 3,
  bench: 2,
  flowerBed: 2,
  fence: 2,
  rock: 1,
  tinyFlag: 1,
  gardenPlot: 3,
  grassClump: 1
};
const ASSET_TILE_GROUPS = [
  { id: "all", label: "All" },
  { id: "places", label: "Places" },
  { id: "landmarks", label: "Landmarks" },
  { id: "nature", label: "Nature" }
] as const;
type AssetTileGroup = (typeof ASSET_TILE_GROUPS)[number]["id"];
type BuilderPanel = "catalog" | "placed" | "residents" | "environment" | "specs";
type TownSpecs = {
  grid: { used: number; total: number; remaining: number; width: number; height: number };
  resources: { used: number; total: number; remaining: number };
  population: { used: number; total: number; remaining: number };
  assetSlots: { used: number; total: number; remaining: number };
  resourceGroups: Array<{ label: string; count: number; points: number }>;
};

const HAIR_STYLES: CharacterAppearance["hairStyle"][] = ["crop", "swept", "afro", "coily", "bob", "bun", "braids", "mohawk", "long", "bald"];
const SKIN_TONES = ["#f5d8bd", "#e8bd98", "#d39a72", "#bb7c55", "#9d6245", "#7e4c38", "#613728", "#44291f"];
const HAIR_COLORS = ["#17120f", "#33241d", "#5a3824", "#87572f", "#bd7b3f", "#d4b080", "#8e3f32", "#e7ded1"];
const OUTFIT_PRESETS = [
  { id: "founder", label: "Founder", shirt: "#d95f4d", trim: "#b9493d", pants: "#163f50", shoes: "#f1eee6" },
  { id: "maker", label: "Maker", shirt: "#3f7f83", trim: "#295d65", pants: "#263d54", shoes: "#e9e1d2" },
  { id: "creative", label: "Creative", shirt: "#8a67a3", trim: "#654b7a", pants: "#4c405f", shoes: "#f2d7aa" },
  { id: "explorer", label: "Explorer", shirt: "#d99b37", trim: "#a56c22", pants: "#47604f", shoes: "#eee3cc" },
  { id: "operator", label: "Operator", shirt: "#526779", trim: "#344554", pants: "#1f3039", shoes: "#d9d7d1" },
  { id: "garden", label: "Garden", shirt: "#6e9a72", trim: "#4d7556", pants: "#665341", shoes: "#efe6d2" }
] as const;

const CHARACTER_PRESETS: Array<{ label: string; appearance: CharacterAppearance }> = [
  { label: "Ari", appearance: { skin: "#d39a72", hair: "#33241d", hairStyle: "coily", shirt: "#d95f4d", trim: "#b9493d", pants: "#163f50", shoes: "#f1eee6", bodyPreset: "average", faceStyle: "bright", accessory: "none" } },
  { label: "Jules", appearance: { skin: "#7e4c38", hair: "#17120f", hairStyle: "braids", shirt: "#3f7f83", trim: "#295d65", pants: "#263d54", shoes: "#e9e1d2", bodyPreset: "tall", faceStyle: "soft", accessory: "glasses" } },
  { label: "Mei", appearance: { skin: "#e8bd98", hair: "#17120f", hairStyle: "bob", shirt: "#8a67a3", trim: "#654b7a", pants: "#4c405f", shoes: "#f2d7aa", bodyPreset: "compact", faceStyle: "round", accessory: "beanie" } },
  { label: "Noor", appearance: { skin: "#bb7c55", hair: "#5a3824", hairStyle: "bun", shirt: "#d99b37", trim: "#a56c22", pants: "#47604f", shoes: "#eee3cc", bodyPreset: "average", faceStyle: "bright", accessory: "none" } },
  { label: "Kai", appearance: { skin: "#613728", hair: "#17120f", hairStyle: "mohawk", shirt: "#526779", trim: "#344554", pants: "#1f3039", shoes: "#d9d7d1", bodyPreset: "broad", faceStyle: "soft", accessory: "none" } },
  { label: "Sam", appearance: { skin: "#f5d8bd", hair: "#bd7b3f", hairStyle: "long", shirt: "#6e9a72", trim: "#4d7556", pants: "#665341", shoes: "#efe6d2", bodyPreset: "tall", faceStyle: "round", accessory: "cap" } }
];

const ASSET_TILE_CONFIG: Record<TownAssetType, { group: Exclude<AssetTileGroup, "all"> }> = {
  building: { group: "places" },
  market: { group: "places" },
  booth: { group: "places" },
  parcelCart: { group: "places" },
  communityBoard: { group: "places" },
  welcomeSign: { group: "landmarks" },
  fountain: { group: "landmarks" },
  monument: { group: "landmarks" },
  waterTower: { group: "landmarks" },
  tree: { group: "nature" },
  shrub: { group: "nature" },
  picnicTable: { group: "places" },
  bench: { group: "places" },
  flowerBed: { group: "nature" },
  gardenPlot: { group: "nature" },
  rock: { group: "nature" },
  fence: { group: "places" },
  grassClump: { group: "nature" },
  lamp: { group: "nature" },
  tinyFlag: { group: "landmarks" }
};

export function createTownBuilder(root: HTMLElement, options: BuilderOptions): TownBuilderApi {
  const dedicatedBuilderRoute = window.location.pathname === "/local-builder";
  let schema = cloneTownSchema(options.initialSchema);
  let selection: BuilderSelection = { kind: "asset", id: schema.assets[0]?.id ?? "" };
  let active = options.startActive ?? (dedicatedBuilderRoute || new URLSearchParams(window.location.search).has("builder"));
  const history = [JSON.stringify(schema)];
  let historyIndex = 0;
  let paletteFilter: AssetTileGroup = "all";
  let builderPanel: BuilderPanel = "catalog";
  let paletteSearch = "";
  let paletteOpen = false;
  let inspectorOpen = false;
  let placement: { assetId: string; isNew: boolean; baseHistoryIndex: number } | null = null;
  let confirmation: BuilderConfirmation | null = null;
  let environmentStatus: EnvironmentRuntimeStatus | null = null;
  let locationError = "";
  let locating = false;
  let selectionPreview: AssetPreview | null = null;
  let tilePreviewRenderer: TilePreviewRenderer | null = null;
  let tilePreviewsUnavailable = false;

  const getTilePreviewRenderer = (): TilePreviewRenderer | null => {
    if (!options.createAssetPreview || tilePreviewsUnavailable) return null;
    if (tilePreviewRenderer) return tilePreviewRenderer;

    try {
      tilePreviewRenderer = createTilePreviewRenderer(options.createAssetPreview);
      return tilePreviewRenderer;
    } catch {
      tilePreviewsUnavailable = true;
      return null;
    }
  };

  const shell = document.createElement("aside");
  shell.className = "town-builder";
  root.appendChild(shell);

  const getSelectedAsset = (): TownAsset | undefined => {
    const currentSelection = selection;
    if (currentSelection.kind !== "asset") return undefined;
    return schema.assets.find((asset) => asset.id === currentSelection.id);
  };
  const getSelectedCharacter = (): CharacterSchema | undefined => {
    const currentSelection = selection;
    if (currentSelection.kind === "player") return schema.player;
    if (currentSelection.kind === "citizen") return schema.citizens.find((citizen) => citizen.id === currentSelection.id);
    return undefined;
  };
  const getSelectedAnimal = (): AnimalSchema | undefined => {
    const currentSelection = selection;
    if (currentSelection.kind !== "animal") return undefined;
    return schema.animals.find((animal) => animal.id === currentSelection.id);
  };

  const notify = () => {
    saveTownSchemaDraft(schema);
    options.onSchemaChange(cloneTownSchema(schema));
  };

  const commit = (mutate: () => boolean | void) => {
    if (mutate() === false) {
      render();
      return;
    }
    if (!recordHistory()) return;
    notify();
    render();
  };

  const canPlaceAsset = (candidate: TownAsset) => !schema.assets.some((asset) => asset.id !== candidate.id && assetsOverlap(candidate, asset));
  const canTransformAsset = (_candidate: TownAsset) => true;

  const findAvailablePosition = (asset: TownAsset, preferred: [number, number]): [number, number] | null => {
    const centerX = snapToGrid(preferred[0]);
    const centerZ = snapToGrid(preferred[1]);
    const maximumSteps = Math.floor(PLACEMENT_LIMIT / GRID_SNAP);

    for (let radius = 0; radius <= maximumSteps; radius += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        for (let z = -radius; z <= radius; z += 1) {
          if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue;
          const position: [number, number] = [centerX + x * GRID_SNAP, centerZ + z * GRID_SNAP];
          if (Math.abs(position[0]) > PLACEMENT_LIMIT || Math.abs(position[1]) > PLACEMENT_LIMIT) continue;
          if (canPlaceAsset({ ...asset, position })) return position;
        }
      }
    }
    return null;
  };

  const recordHistory = () => {
    const snapshot = JSON.stringify(schema);
    if (snapshot === history[historyIndex]) return false;
    history.splice(historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    return true;
  };

  const restoreHistory = (index: number) => {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    schema = parseTownSchema(JSON.parse(history[index]));
    ensureSelection();
    notify();
    render();
  };

  const ensureSelection = () => {
    if (selection.kind === "asset") {
      const selectedId = selection.id;
      if (!schema.assets.some((asset) => asset.id === selectedId)) selection = schema.assets[0] ? { kind: "asset", id: schema.assets[0].id } : { kind: "player" };
    }
    if (selection.kind === "citizen") {
      const selectedId = selection.id;
      if (!schema.citizens.some((citizen) => citizen.id === selectedId)) selection = { kind: "player" };
    }
    if (selection.kind === "animal") {
      const selectedId = selection.id;
      if (!schema.animals.some((animal) => animal.id === selectedId)) selection = { kind: "player" };
    }
  };

  const setActive = (nextActive: boolean) => {
    if (!nextActive && dedicatedBuilderRoute) {
      window.location.assign("/");
      return;
    }
    active = nextActive;
    root.classList.toggle("builder-mode", active);
    options.onActiveChange(active);
    render();
  };

  const addAsset = (type: TownAssetType) => {
    const baseHistoryIndex = historyIndex;
    const id = `${type}-${Date.now().toString(36)}`;
    const asset: TownAsset = {
      id,
      type,
      position: [0, 0],
      label: type === "building" ? "New Studio" : type === "market" ? "New Market" : undefined,
      color: type === "building" ? "#a7a58d" : type === "market" ? "#d9bd7b" : type === "booth" ? "#d5745c" : undefined,
      roofColor: type === "building" ? "#806451" : undefined,
      stripeColor: type === "booth" ? "#f2d583" : undefined,
      collision: defaultCollision(type)
    };
    const position = findAvailablePosition(asset, asset.position);
    if (!position) return;

    commit(() => {
      asset.position = position;
      schema.assets.push(asset);
      selection = { kind: "asset", id };
      placement = { assetId: id, isNew: true, baseHistoryIndex };
      paletteOpen = false;
      inspectorOpen = false;
    });
  };

  const duplicateAsset = () => {
    const asset = getSelectedAsset();
    if (!asset) return;
    const copy = cloneTownSchema({ ...schema, assets: [asset] }).assets[0];
    copy.id = `${asset.id}-copy-${Date.now().toString(36)}`;
    const position = findAvailablePosition(copy, [asset.position[0] + 1, asset.position[1] + 1]);
    if (!position) return;

    commit(() => {
      copy.position = position;
      schema.assets.push(copy);
      selection = { kind: "asset", id: copy.id };
    });
  };

  const nudgeAsset = (x: number, z: number) => {
    const asset = getSelectedAsset();
    if (!asset) return;
    const position: [number, number] = [Number((asset.position[0] + x).toFixed(2)), Number((asset.position[1] + z).toFixed(2))];
    if (!canTransformAsset({ ...asset, position })) return;
    commit(() => { asset.position = position; });
  };

  const rotateAsset = (degrees: number) => {
    const asset = getSelectedAsset();
    if (!asset) return;
    const rotation = (asset.rotation ?? 0) + (degrees * Math.PI) / 180;
    const nextRotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
    if (!canTransformAsset({ ...asset, rotation: nextRotation })) return;
    commit(() => { asset.rotation = nextRotation; });
  };

  const moveAsset = (id: string, x: number, z: number) => {
    const asset = schema.assets.find((candidate) => candidate.id === id);
    if (!asset) return;
    const position: [number, number] = [snapToGrid(x), snapToGrid(z)];
    if (!canTransformAsset({ ...asset, position })) return;
    asset.position = position;
    options.onAssetPositionPreview?.(asset);
    options.onSelectionChange?.(asset);
  };

  const commitAssetMove = () => {
    placement = null;
    inspectorOpen = true;
    paletteOpen = false;
    if (recordHistory()) notify();
    render();
  };

  const cancelPlacement = () => {
    if (!placement) return;
    const wasNewPlacement = placement.isNew;
    if (placement.isNew) {
      schema = parseTownSchema(JSON.parse(history[placement.baseHistoryIndex]));
      history.splice(placement.baseHistoryIndex + 1);
      historyIndex = placement.baseHistoryIndex;
      ensureSelection();
      notify();
    } else {
      schema = parseTownSchema(JSON.parse(history[historyIndex]));
      ensureSelection();
      notify();
    }
    placement = null;
    inspectorOpen = !wasNewPlacement;
    paletteOpen = false;
    render();
  };

  const deleteAsset = () => {
    const asset = getSelectedAsset();
    if (!asset) return;
    confirmation = {
      kind: "delete-asset",
      assetId: asset.id,
      assetName: asset.label ?? assetTypeLabel(asset.type)
    };
    render();
  };

  const confirmDeleteAsset = (assetId: string) => {
    commit(() => {
      schema.assets = schema.assets.filter((candidate) => candidate.id !== assetId);
      selection = schema.assets[0] ? { kind: "asset", id: schema.assets[0].id } : { kind: "player" };
      confirmation = null;
    });
  };

  const randomizeCharacter = () => {
    const character = getSelectedCharacter();
    if (!character) return;
    commit(() => {
      const preset = CHARACTER_PRESETS[Math.floor(Math.random() * CHARACTER_PRESETS.length)];
      character.appearance = {
        ...preset.appearance,
        skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
        hair: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
        hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)]
      };
    });
  };

  const applyCharacterPreset = (index: number) => {
    const character = getSelectedCharacter();
    const preset = CHARACTER_PRESETS[index];
    if (!character || !preset) return;
    commit(() => { character.appearance = { ...preset.appearance }; });
  };

  const applyOutfitPreset = (id: string) => {
    const character = getSelectedCharacter();
    const preset = OUTFIT_PRESETS.find((candidate) => candidate.id === id);
    if (!character || !preset) return;
    commit(() => {
      character.appearance.shirt = preset.shirt;
      character.appearance.trim = preset.trim;
      character.appearance.pants = preset.pants;
      character.appearance.shoes = preset.shoes;
    });
  };

  const updateEnvironment = (field: keyof EnvironmentSettings, value: string | number) => {
    commit(() => {
      const environment = schema.environment;
      if (field === "latitude" || field === "longitude" || field === "timezoneOffset" || field === "manualHour") {
        environment[field] = Number(value);
        return;
      }
      if (field === "weatherMode") environment.weatherMode = value as EnvironmentSettings["weatherMode"];
      if (field === "weather") environment.weather = value as EnvironmentSettings["weather"];
      if (field === "dayNightMode") environment.dayNightMode = value as EnvironmentSettings["dayNightMode"];
      if (field === "seasonCycle") {
        environment.seasonCycle = value as EnvironmentSettings["seasonCycle"];
        if (environment.seasonCycle === "two" && !["auto", "wet", "dry"].includes(environment.season)) environment.season = "auto";
        if (environment.seasonCycle === "four" && !["auto", "spring", "summer", "autumn", "winter"].includes(environment.season)) environment.season = "auto";
      }
      if (field === "season") environment.season = value as EnvironmentSettings["season"];
      if (field === "foliage") environment.foliage = value as EnvironmentSettings["foliage"];
    });
  };

  const setEnvironmentControlMode = (mode: "live" | "override") => {
    commit(() => {
      const environment = schema.environment;
      if (mode === "live") {
        environment.weatherMode = "live";
        environment.dayNightMode = "timezone";
        environment.season = "auto";
        return;
      }
      environment.weather = environmentStatus?.weather ?? environment.weather;
      environment.weatherMode = "manual";
      environment.manualHour = Number((environmentStatus?.localHour ?? getTimezoneHour(environment.timezoneOffset)).toFixed(2));
      environment.dayNightMode = "manual";
      environment.season = environmentStatus?.season ?? inferAutomaticSeason(environment);
    });
  };

  const useCurrentLocation = () => {
    locationError = "";
    if (!navigator.geolocation) {
      locationError = "Location is not available in this browser.";
      render();
      return;
    }
    locating = true;
    render();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locating = false;
        commit(() => {
          schema.environment.latitude = Number(position.coords.latitude.toFixed(4));
          schema.environment.longitude = Number(position.coords.longitude.toFixed(4));
          schema.environment.timezoneOffset = Math.min(14, Math.max(-12, -new Date().getTimezoneOffset() / 60));
          schema.environment.weatherMode = "live";
        });
        root.dispatchEvent(new Event("town:weather-refresh"));
      },
      (failure) => {
        locating = false;
        locationError = failure.code === failure.PERMISSION_DENIED
          ? "Location permission was declined. Singapore remains the default."
          : "Your location could not be read. Try again later.";
        render();
      },
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 10000 }
    );
  };

  const resetShipped = () => {
    confirmation = { kind: "reset-draft" };
    render();
  };

  const confirmResetShipped = () => {
    schema = cloneTownSchema(options.shippedSchema);
    history.splice(0, history.length, JSON.stringify(schema));
    historyIndex = 0;
    selection = { kind: "asset", id: schema.assets[0]?.id ?? "" };
    confirmation = null;
    clearTownSchemaDraft();
    options.onSchemaChange(cloneTownSchema(schema));
    render();
  };

  const render = () => {
    const selectedAsset = getSelectedAsset();
    const selectedCharacter = getSelectedCharacter();
    const selectedAnimal = getSelectedAnimal();
    const paletteTitle = builderPanel === "environment" ? "Environment" : builderPanel === "specs" ? "Town specs" : "Town library";
    const paletteKicker = builderPanel === "environment" ? "World settings" : builderPanel === "specs" ? "Planning guide" : "Town tools";
    const paletteLabel = builderPanel === "environment" ? "Town environment settings" : builderPanel === "specs" ? "Town capacity and resource specs" : "Town builder library";
    const searchablePanel = builderPanel !== "environment" && builderPanel !== "specs";
    options.onSelectionChange?.(selectedAsset ?? null);
    shell.hidden = !active;
    shell.innerHTML = `
      ${paletteOpen ? `<section class="builder-palette builder-transient-drawer ${builderPanel === "environment" ? "builder-environment-drawer" : builderPanel === "specs" ? "builder-specs-drawer" : ""}" aria-label="${paletteLabel}">
        <header class="builder-header">
          <div>
            <span class="builder-kicker">${paletteKicker}</span>
            <strong>${paletteTitle}</strong>
          </div>
          <div class="builder-header-actions">
            <button class="builder-icon-button builder-tooltip" type="button" data-action="collapse-palette" aria-label="Close ${builderPanel === "environment" ? "environment settings" : builderPanel === "specs" ? "town specs" : "town library"}" data-tooltip="Close panel">×</button>
          </div>
        </header>
        <div class="builder-palette-body">
          ${searchablePanel ? `<div class="builder-library-toolbar">
            <label class="builder-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" data-palette-search value="${escapeHtml(paletteSearch)}" placeholder="${builderPanel === "catalog" ? "Search assets" : builderPanel === "placed" ? "Search placed items" : "Search residents"}" aria-label="Search ${builderPanel}" />
            </label>
            ${builderPanel === "residents" ? `<button type="button" class="builder-surprise-button" data-action="randomize-character" ${!selectedCharacter ? "disabled" : ""}>Surprise me</button>` : ""}
          </div>` : ""}
          ${builderPanel === "catalog" ? `<div class="builder-filter-row" role="tablist" aria-label="Asset categories">
            ${ASSET_TILE_GROUPS.map((group) => `<button type="button" data-filter="${group.id}" class="${paletteFilter === group.id ? "active" : ""}">${group.label}</button>`).join("")}
          </div>` : ""}
          <div class="builder-library-content">
            ${renderBuilderPanel(builderPanel, schema, selection, paletteFilter, paletteSearch, environmentStatus, locating, locationError)}
          </div>
          <div class="builder-history-bar">
            <span>${historyIndex + 1} / ${history.length} changes</span>
            <div class="builder-draft-row">
              <button type="button" data-action="undo" ${historyIndex === 0 ? "disabled" : ""} aria-label="Undo last change">Undo</button>
              <button type="button" data-action="redo" ${historyIndex >= history.length - 1 ? "disabled" : ""} aria-label="Redo last change">Redo</button>
            </div>
          </div>
        </div>
      </section>` : ""}
      ${placement ? "" : renderBuilderToolbar(builderPanel, schema, historyIndex, history.length)}
      ${inspectorOpen ? `<aside class="builder-inspector" aria-label="Selected town resident or asset inspector">
        <header class="builder-header">
          <div>
            <span class="builder-kicker">Selected</span>
            <strong>${selectedAsset ? escapeHtml(selectedAsset.label ?? assetTypeLabel(selectedAsset.type)) : selectedCharacter ? escapeHtml(selectedCharacter.kind === "player" ? "Player" : selectedCharacter.id.replace("citizen-", "")) : selectedAnimal ? escapeHtml(selectedAnimal.label) : "Nothing selected"}</strong>
          </div>
          <button class="builder-icon-button builder-tooltip" type="button" data-action="collapse-inspector" aria-label="Close inspector" data-tooltip="Close inspector">×</button>
        </header>
        <div class="builder-inspector-scroll">
          ${selectedAsset ? `<div class="builder-asset-preview builder-object-preview" data-selection-preview aria-label="${escapeHtml(assetTypeLabel(selectedAsset.type))} 3D preview"></div>${renderAssetForm(selectedAsset)}` : selectedCharacter ? `<div class="builder-asset-preview builder-character-preview" data-selection-preview aria-label="${escapeHtml(selectedCharacter.kind === "player" ? "Player" : selectedCharacter.id)} 3D preview"></div>${renderCharacterForm(selectedCharacter)}` : selectedAnimal ? `<div class="builder-asset-preview builder-animal-preview" data-selection-preview aria-label="${escapeHtml(selectedAnimal.label)} the ${selectedAnimal.kind} 3D preview"></div>${renderAnimalForm(selectedAnimal)}` : ""}
          <section class="builder-section builder-utility-section">
            <div class="builder-action-grid builder-utility-actions">
              <button type="button" data-action="reset" class="builder-danger">Reset draft</button>
            </div>
          </section>
        </div>
      </aside>` : ""}
      ${placement && selectedAsset ? renderPlacementHud(selectedAsset, placement.isNew) : ""}
      <div class="builder-map-controls ${inspectorOpen ? "builder-map-controls-inspector-open" : ""}" aria-label="Map controls">
        <button class="builder-tooltip" type="button" data-action="zoom-in" aria-label="Zoom in" data-tooltip="Zoom in">+</button>
        <button class="builder-tooltip" type="button" data-action="zoom-reset" aria-label="Reset map view" data-tooltip="Reset map view"><span class="builder-target-glyph" aria-hidden="true"></span></button>
        <button class="builder-tooltip" type="button" data-action="zoom-out" aria-label="Zoom out" data-tooltip="Zoom out">-</button>
      </div>
      ${confirmation ? renderConfirmation(confirmation) : ""}
    `;

    const refreshSelectionPreview = () => {
      const previewHost = shell.querySelector<HTMLElement>("[data-selection-preview]");
      const previewSource = selectedAsset
        ? options.createAssetPreview?.(getSelectedAsset() ?? selectedAsset)
        : selectedCharacter
          ? options.createCharacterPreview?.(getSelectedCharacter() ?? selectedCharacter)
          : selectedAnimal
            ? options.createAnimalPreview?.(getSelectedAnimal() ?? selectedAnimal)
            : null;
      if (!previewHost || !previewSource) {
        selectionPreview?.dispose();
        selectionPreview = null;
        return;
      }
      if (selectionPreview) {
        selectionPreview.attach(previewHost);
        selectionPreview.update(previewSource);
        return;
      }
      selectionPreview = mountAssetPreview(previewHost, previewSource);
    };

    if (active && inspectorOpen && (selectedAsset || selectedCharacter || selectedAnimal)) refreshSelectionPreview();
    else {
      selectionPreview?.dispose();
      selectionPreview = null;
    }

    const environmentScroller = shell.querySelector<HTMLElement>(".builder-environment-drawer .builder-library-content");
    if (environmentScroller) environmentScroller.scrollLeft = 0;

    if (active) {
      shell.querySelectorAll<HTMLImageElement>("[data-asset-thumbnail]").forEach((image) => {
        const type = image.dataset.assetThumbnail as TownAssetType;
        try {
          const thumbnail = getTilePreviewRenderer()?.render(type);
          if (thumbnail) image.src = thumbnail;
        } catch {
          tilePreviewRenderer?.dispose();
          tilePreviewRenderer = null;
          tilePreviewsUnavailable = true;
        }
      });
    }

    shell.querySelector<HTMLButtonElement>('[data-action="back-to-town"]')?.addEventListener("click", () => {
      window.location.assign("/");
    });
    shell.querySelector<HTMLButtonElement>('[data-action="collapse-palette"]')?.addEventListener("click", () => {
      paletteOpen = false;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="expand-palette"]')?.addEventListener("click", () => {
      paletteOpen = true;
      inspectorOpen = false;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="collapse-inspector"]')?.addEventListener("click", () => {
      inspectorOpen = false;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="expand-inspector"]')?.addEventListener("click", () => {
      inspectorOpen = true;
      paletteOpen = false;
      render();
    });
    shell.querySelectorAll<HTMLButtonElement>("[data-open-panel]").forEach((button) => button.addEventListener("click", () => {
      const nextPanel = button.dataset.openPanel as BuilderPanel;
      const closeActivePanel = paletteOpen && builderPanel === nextPanel;
      builderPanel = nextPanel;
      paletteSearch = "";
      paletteOpen = !closeActivePanel;
      inspectorOpen = false;
      render();
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-environment-choice]").forEach((button) => button.addEventListener("click", () => {
      const [field, value] = (button.dataset.environmentChoice ?? "").split(":");
      if (!field || !value) return;
      updateEnvironment(field as keyof EnvironmentSettings, value);
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-environment-mode]").forEach((button) => button.addEventListener("click", () => {
      const mode = button.dataset.environmentMode;
      if (mode === "live" || mode === "override") setEnvironmentControlMode(mode);
    }));
    shell.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-environment-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.environmentField as keyof EnvironmentSettings | undefined;
        if (!field) return;
        const value = input instanceof HTMLInputElement && input.type === "number" ? Number(input.value) : input.value;
        updateEnvironment(field, value);
      });
    });
    shell.querySelector<HTMLButtonElement>('[data-action="use-location"]')?.addEventListener("click", useCurrentLocation);
    shell.querySelector<HTMLButtonElement>('[data-action="refresh-weather"]')?.addEventListener("click", () => {
      root.dispatchEvent(new Event("town:weather-refresh"));
    });
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener("click", () => options.onCameraZoom?.(-7));
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener("click", () => options.onCameraZoom?.(7));
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-reset"]')?.addEventListener("click", () => options.onCameraReset?.());
    shell.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => button.addEventListener("click", () => {
      paletteFilter = button.dataset.filter as AssetTileGroup;
      render();
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-builder-panel]").forEach((button) => button.addEventListener("click", () => {
      builderPanel = button.dataset.builderPanel as BuilderPanel;
      paletteSearch = "";
      render();
    }));
    shell.querySelector<HTMLInputElement>("[data-palette-search]")?.addEventListener("input", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      paletteSearch = input.value;
      render();
      requestAnimationFrame(() => {
        const nextInput = shell.querySelector<HTMLInputElement>("[data-palette-search]");
        nextInput?.focus();
        nextInput?.setSelectionRange(paletteSearch.length, paletteSearch.length);
      });
    });
    shell.querySelectorAll<HTMLButtonElement>("[data-select-placed]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.selectPlaced;
      if (!id) return;
      selection = { kind: "asset", id };
      paletteOpen = false;
      inspectorOpen = true;
      render();
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-select-character]").forEach((button) => button.addEventListener("click", () => {
      const [kind, id] = (button.dataset.selectCharacter ?? "player").split(":");
      selection = kind === "citizen" && id ? { kind: "citizen", id } : { kind: "player" };
      paletteOpen = false;
      inspectorOpen = true;
      render();
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-select-animal]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.selectAnimal;
      if (!id || !schema.animals.some((animal) => animal.id === id)) return;
      selection = { kind: "animal", id };
      paletteOpen = false;
      inspectorOpen = true;
      render();
    }));

    shell.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => button.addEventListener("click", () => addAsset(button.dataset.add as TownAssetType)));
    shell.querySelectorAll<HTMLButtonElement>("[data-character-preset]").forEach((button) => button.addEventListener("click", () => applyCharacterPreset(Number(button.dataset.characterPreset))));
    shell.querySelectorAll<HTMLButtonElement>("[data-outfit-preset]").forEach((button) => button.addEventListener("click", () => applyOutfitPreset(button.dataset.outfitPreset ?? "")));
    shell.querySelectorAll<HTMLButtonElement>("[data-character-choice]").forEach((button) => button.addEventListener("click", () => {
      const [field, value] = (button.dataset.characterChoice ?? "").split(":");
      const character = getSelectedCharacter();
      if (!character || !field || !value) return;
      commit(() => applyFieldChange(`character.${field}`, value, undefined, character, undefined, canTransformAsset));
    }));
    shell.querySelector<HTMLButtonElement>('[data-action="randomize-character"]')?.addEventListener("click", randomizeCharacter);
    shell.querySelector<HTMLButtonElement>('[data-action="cancel-placement"]')?.addEventListener("click", cancelPlacement);
    shell.querySelectorAll<HTMLButtonElement>("[data-nudge]").forEach((button) => {
      button.addEventListener("click", () => {
        const [x, z] = (button.dataset.nudge ?? "0,0").split(",").map(Number);
        nudgeAsset(x, z);
      });
    });
    shell.querySelectorAll<HTMLButtonElement>("[data-rotate]").forEach((button) => {
      button.addEventListener("click", () => rotateAsset(Number(button.dataset.rotate)));
    });
    shell.querySelector<HTMLButtonElement>('[data-action="duplicate"]')?.addEventListener("click", duplicateAsset);
    shell.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener("click", deleteAsset);
    shell.querySelectorAll<HTMLButtonElement>('[data-action="undo"]').forEach((button) => button.addEventListener("click", () => restoreHistory(historyIndex - 1)));
    shell.querySelectorAll<HTMLButtonElement>('[data-action="redo"]').forEach((button) => button.addEventListener("click", () => restoreHistory(historyIndex + 1)));
    shell.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", resetShipped);
    shell.querySelectorAll<HTMLElement>('[data-action="cancel-confirmation"]').forEach((element) => element.addEventListener("click", () => {
      confirmation = null;
      render();
    }));
    shell.querySelector<HTMLElement>("[data-confirmation-card]")?.addEventListener("click", (event) => event.stopPropagation());
    shell.querySelector<HTMLButtonElement>('[data-action="confirm-destructive"]')?.addEventListener("click", () => {
      if (confirmation?.kind === "delete-asset") confirmDeleteAsset(confirmation.assetId);
      else if (confirmation?.kind === "reset-draft") confirmResetShipped();
    });

    if (confirmation) requestAnimationFrame(() => shell.querySelector<HTMLButtonElement>('[data-action="cancel-confirmation"]')?.focus());

    shell.querySelectorAll<HTMLInputElement>('[data-schema-field="asset.color"], [data-schema-field="asset.roofColor"], [data-schema-field="asset.stripeColor"], [data-schema-field^="character."][type="color"], [data-schema-field^="animal."][type="color"]').forEach((input) => {
      input.addEventListener("input", () => {
        const selectedAsset = getSelectedAsset();
        const selectedCharacter = getSelectedCharacter();
        const selectedAnimal = getSelectedAnimal();
        if (!selectedAsset && !selectedCharacter && !selectedAnimal) return;
        applyFieldChange(input.dataset.schemaField ?? "", input.value, selectedAsset, selectedCharacter, selectedAnimal, canTransformAsset);
        notify();
        refreshSelectionPreview();
      });
    });

    shell.querySelectorAll<HTMLInputElement>('[data-schema-field="asset.x"], [data-schema-field="asset.z"], [data-schema-field="asset.rotation"], [data-schema-field="asset.scale"]').forEach((input) => {
      input.addEventListener("input", () => {
        if (input.value === "" || !input.validity.valid) return;
        const selectedAsset = getSelectedAsset();
        if (!selectedAsset) return;
        const applied = applyFieldChange(input.dataset.schemaField ?? "", Number(input.value), selectedAsset, undefined, undefined, canTransformAsset);
        input.setCustomValidity(applied === false ? "This transform would overlap another asset." : "");
        if (applied === false) return;
        notify();
        refreshSelectionPreview();
      });
    });

    shell.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-schema-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.schemaField ?? "";
        const value = input instanceof HTMLInputElement && input.type === "number" ? Number(input.value) : input.value;
        commit(() => applyFieldChange(field, value, getSelectedAsset(), getSelectedCharacter(), getSelectedAnimal(), canTransformAsset));
      });
    });
  };

  window.addEventListener("keydown", (event) => {
    if (!active) return;
    if (isEditableTarget(event.target)) return;
    if (event.key === "Escape") {
      if (confirmation) {
        confirmation = null;
        render();
        return;
      }
      if (placement) {
        cancelPlacement();
        return;
      }
      if (paletteOpen) {
        paletteOpen = false;
        render();
        return;
      }
      if (inspectorOpen) {
        inspectorOpen = false;
        render();
        return;
      }
      setActive(false);
      return;
    }
    if (event.key.toLowerCase() === "b") {
      builderPanel = "catalog";
      paletteOpen = !paletteOpen;
      inspectorOpen = false;
      render();
      return;
    }
    if (placement && event.key.toLowerCase() === "q") {
      rotateAsset(-15);
      return;
    }
    if (placement && event.key.toLowerCase() === "e") {
      rotateAsset(15);
      return;
    }
    if (placement && event.key === "Enter") {
      commitAssetMove();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restoreHistory(event.shiftKey ? historyIndex + 1 : historyIndex - 1);
    }
  });

  root.addEventListener("pointerdown", (event) => {
    if (!active || !paletteOpen || !(event.target instanceof HTMLCanvasElement)) return;
    paletteOpen = false;
    render();
  });
  root.addEventListener("town:environment-status", (event) => {
    environmentStatus = (event as CustomEvent<EnvironmentRuntimeStatus>).detail;
    if (active && paletteOpen && builderPanel === "environment") render();
  });
  root.addEventListener("builder:toggle", () => setActive(!active));
  root.classList.toggle("builder-mode", active);
  options.onActiveChange(active);
  render();

  return {
    isActive: () => active,
    getPlacementAssetId: () => placement?.isNew ? placement.assetId : null,
    selectAsset: (id) => {
      if (!schema.assets.some((asset) => asset.id === id)) return;
      selection = { kind: "asset", id };
      placement = { assetId: id, isNew: false, baseHistoryIndex: historyIndex };
      paletteOpen = false;
      inspectorOpen = false;
      if (active) render();
    },
    selectCharacter: (kind, id) => {
      if (kind === "player") selection = { kind: "player" };
      else if (id && schema.citizens.some((citizen) => citizen.id === id)) selection = { kind: "citizen", id };
      placement = null;
      paletteOpen = false;
      inspectorOpen = true;
      if (active) render();
    },
    selectAnimal: (id) => {
      if (!schema.animals.some((animal) => animal.id === id)) return;
      selection = { kind: "animal", id };
      placement = null;
      paletteOpen = false;
      inspectorOpen = true;
      if (active) render();
    },
    moveAsset,
    commitAssetMove,
    getSchema: () => cloneTownSchema(schema)
  };
}

function mountAssetPreview(host: HTMLElement, source: THREE.Object3D): AssetPreview {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const attach = (nextHost: HTMLElement) => {
    if (renderer.domElement.parentElement !== nextHost) nextHost.appendChild(renderer.domElement);
  };
  attach(host);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);
  const keyLight = new THREE.DirectionalLight("#fff2cf", 2.2);
  keyLight.position.set(5, 8, 6);
  scene.add(keyLight, new THREE.HemisphereLight("#fff9e9", "#6e8260", 1.45));

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 48),
    new THREE.MeshBasicMaterial({ color: "#f1dfb6", transparent: true, opacity: 0.42, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  scene.add(floor);

  let model: THREE.Object3D | null = null;
  const update = (nextSource: THREE.Object3D) => {
    if (model) {
      modelRoot.remove(model);
      disposePreviewObject(model);
    }

    model = nextSource;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    modelRoot.add(model);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.position.y -= bounds.min.y - center.y;

    const span = Math.max(size.x, size.y, size.z, 1);
    floor.scale.setScalar(span);
    const target = new THREE.Vector3(0, size.y * 0.42, 0);
    camera.position.set(span * 1.45, span * 1.05, span * 1.58);
    camera.lookAt(target);
  };
  update(source);

  let rotationY = 0;
  let lastFrameAt = performance.now();
  let resumeAutoRotateAt = lastFrameAt;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let dragging = false;
  let frame = 0;
  const draw = (now: number) => {
    const delta = Math.min(now - lastFrameAt, 48);
    lastFrameAt = now;
    if (!dragging && now >= resumeAutoRotateAt) rotationY += delta * 0.00042;
    modelRoot.rotation.y = rotationY;
    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(draw);
  };
  frame = window.requestAnimationFrame(draw);

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    resumeAutoRotateAt = performance.now() + 1200;
    renderer.domElement.classList.remove("is-dragging");
  };

  renderer.domElement.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragStartX = event.clientX;
    dragStartRotation = rotationY;
    resumeAutoRotateAt = Number.POSITIVE_INFINITY;
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.classList.add("is-dragging");
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    rotationY = dragStartRotation + (event.clientX - dragStartX) * 0.014;
  });
  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointercancel", endDrag);

  return {
    attach,
    update,
    dispose: () => {
      window.cancelAnimationFrame(frame);
      if (model) disposePreviewObject(model);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function disposePreviewObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function renderBuilderToolbar(activePanel: BuilderPanel, schema: TownSchema, historyIndex: number, historyLength: number): string {
  const specs = getTownSpecs(schema);
  const resourcePercent = Math.round((specs.resources.used / specs.resources.total) * 100);
  return `
    <nav class="builder-bottom-toolbar" aria-label="Builder tools">
      <button type="button" data-action="back-to-town" class="builder-toolbar-icon" aria-label="Back to town">←</button>
      <span class="builder-toolbar-divider" aria-hidden="true"></span>
      <button type="button" data-open-panel="catalog" class="${activePanel === "catalog" ? "active" : ""}"><span aria-hidden="true">▦</span> Library <kbd>B</kbd></button>
      <button type="button" data-open-panel="placed" class="${activePanel === "placed" ? "active" : ""}">Placed <small>${schema.assets.length}</small></button>
      <button type="button" data-open-panel="residents" class="${activePanel === "residents" ? "active" : ""}">Residents <small>${schema.citizens.length + schema.animals.length + 1}</small></button>
      <button type="button" data-open-panel="environment" class="${activePanel === "environment" ? "active" : ""}"><span class="builder-weather-glyph" aria-hidden="true">☼</span> Environment</button>
      <button type="button" data-open-panel="specs" class="${activePanel === "specs" ? "active" : ""}"><span class="builder-specs-glyph" aria-hidden="true">▥</span> Specs <small>${resourcePercent}%</small></button>
      <span class="builder-toolbar-divider" aria-hidden="true"></span>
      <button type="button" data-action="undo" class="builder-toolbar-icon builder-history-button builder-tooltip" aria-label="Undo last change" data-tooltip="Undo last change · Ctrl/⌘ Z" ${historyIndex === 0 ? "disabled" : ""}>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M9 7 5 11l4 4"></path>
          <path d="M5 11h8a6 6 0 0 1 6 6v1"></path>
        </svg>
      </button>
      <button type="button" data-action="redo" class="builder-toolbar-icon builder-history-button builder-tooltip" aria-label="Redo last change" data-tooltip="Redo last change · Shift + Ctrl/⌘ Z" ${historyIndex >= historyLength - 1 ? "disabled" : ""}>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="m15 7 4 4-4 4"></path>
          <path d="M19 11h-8a6 6 0 0 0-6 6v1"></path>
        </svg>
      </button>
    </nav>
  `;
}

function renderPlacementHud(asset: TownAsset, isNew: boolean): string {
  return `
    <section class="builder-placement-hud" aria-live="polite">
      <span class="builder-placement-pulse" aria-hidden="true"></span>
      <span><small>${isNew ? "Placing" : "Moving"}</small><strong>${escapeHtml(asset.label ?? assetTypeLabel(asset.type))}</strong></span>
      <span class="builder-placement-instruction">${isNew ? "Move pointer, then click to place" : "Drag to reposition"}</span>
      <button type="button" data-rotate="-15" aria-label="Rotate left">↺ <kbd>Q</kbd></button>
      <button type="button" data-rotate="15" aria-label="Rotate right">↻ <kbd>E</kbd></button>
      <button type="button" data-action="cancel-placement" class="builder-placement-cancel">Cancel <kbd>Esc</kbd></button>
    </section>
  `;
}

function renderBuilderPanel(
  panel: BuilderPanel,
  schema: TownSchema,
  selection: BuilderSelection,
  filter: AssetTileGroup,
  search: string,
  environmentStatus: EnvironmentRuntimeStatus | null,
  locating: boolean,
  locationError: string
): string {
  const query = search.trim().toLowerCase();
  if (panel === "specs") {
    return renderTownSpecsPanel(schema);
  }
  if (panel === "environment") {
    return renderEnvironmentPanel(schema.environment, environmentStatus, locating, locationError);
  }
  if (panel === "catalog") {
    const tiles = renderAssetTiles(filter, query);
    return tiles ? `<div class="builder-tile-grid">${tiles}</div>` : renderEmptyState("No assets found", "Try another category or search term.");
  }
  if (panel === "placed") {
    const assets = schema.assets.filter((asset) => `${asset.label ?? ""} ${asset.id} ${assetTypeLabel(asset.type)}`.toLowerCase().includes(query));
    if (assets.length === 0) return renderEmptyState("Nothing placed matches", "Clear the search or add something from Catalog.");
    return `<div class="builder-placed-list">${assets.map((asset) => `
      <button type="button" data-select-placed="${escapeHtml(asset.id)}" class="builder-placed-card ${selection.kind === "asset" && selection.id === asset.id ? "selected" : ""}">
        <span class="builder-placed-thumb"><img data-asset-thumbnail="${asset.type}" alt="" aria-hidden="true" /></span>
        <span class="builder-placed-copy"><strong>${escapeHtml(asset.label ?? assetTypeLabel(asset.type))}</strong><small>${escapeHtml(assetTypeLabel(asset.type))} · ${asset.position[0]}, ${asset.position[1]}</small></span>
        <span aria-hidden="true">›</span>
      </button>`).join("")}</div>`;
  }

  const residents = [schema.player, ...schema.citizens].filter((character) => {
    const name = character.kind === "player" ? "Player" : character.id.replace("citizen-", "");
    return `${name} ${character.appearance.hairStyle} ${character.appearance.bodyPreset ?? "average"}`.toLowerCase().includes(query);
  });
  const animals = schema.animals.filter((animal) =>
    `${animal.label} ${animal.kind} animal pet roaming`.toLowerCase().includes(query)
  );
  if (residents.length === 0 && animals.length === 0) return renderEmptyState("No residents found", "Try searching by name, species, hair, or body style.");
  const peopleMarkup = residents.length > 0 ? `
    <section class="builder-roster-group">
      <div class="builder-roster-heading"><span>People</span><small>${residents.length}</small></div>
      <div class="builder-resident-roster">${residents.map((character) => {
    const selected = character.kind === "player"
      ? selection.kind === "player"
      : selection.kind === "citizen" && selection.id === character.id;
    return `<button type="button" data-select-character="${character.kind === "player" ? "player" : `citizen:${character.id}`}" class="builder-resident-card ${selected ? "selected" : ""}">
      <span class="builder-avatar" style="--avatar-skin:${character.appearance.skin};--avatar-hair:${character.appearance.hair};--avatar-shirt:${character.appearance.shirt}" aria-hidden="true"><i></i></span>
      <span><strong>${escapeHtml(character.kind === "player" ? "Player" : character.id.replace("citizen-", ""))}</strong><small>${humanizeLabel(character.appearance.hairStyle)} hair · ${humanizeLabel(character.appearance.bodyPreset ?? "average")}</small></span>
      <span class="builder-status-dot">Active</span>
    </button>`;
      }).join("")}</div>
    </section>` : "";
  const animalMarkup = animals.length > 0 ? `
    <section class="builder-roster-group">
      <div class="builder-roster-heading"><span>Animals</span><small>${animals.length}</small></div>
      <div class="builder-resident-roster">${animals.map((animal) => `
        <button type="button" data-select-animal="${escapeHtml(animal.id)}" class="builder-resident-card builder-animal-card ${selection.kind === "animal" && selection.id === animal.id ? "selected" : ""}">
          <span class="builder-animal-avatar builder-animal-${animal.kind}" style="--animal-primary:${animal.primaryColor};--animal-secondary:${animal.secondaryColor}" aria-hidden="true"><i></i></span>
          <span><strong>${escapeHtml(animal.label)}</strong><small>${humanizeLabel(animal.kind)} · ${animal.speed < 0.8 ? "Gentle" : animal.speed > 1.15 ? "Playful" : "Steady"} roaming</small></span>
          <span class="builder-status-dot builder-status-roaming">Roaming</span>
        </button>
      `).join("")}</div>
    </section>` : "";
  return `<div class="builder-roster-sections">${peopleMarkup}${animalMarkup}</div>`;
}

function renderTownSpecsPanel(schema: TownSchema): string {
  const specs = getTownSpecs(schema);
  const resourcePercent = Math.round((specs.resources.used / specs.resources.total) * 100);
  const resourceState = resourcePercent <= 75 ? "Healthy" : resourcePercent <= 90 ? "Plan carefully" : "At capacity";
  const resourceTone = resourcePercent <= 75 ? "healthy" : resourcePercent <= 90 ? "watch" : "full";
  return `
    <div class="builder-specs-panel">
      <section class="builder-specs-hero spec-tone-${resourceTone}">
        <div class="builder-specs-ring" style="--spec-progress:${Math.min(resourcePercent, 100) * 3.6}deg" role="progressbar" aria-label="Render resource usage" aria-valuemin="0" aria-valuemax="${specs.resources.total}" aria-valuenow="${specs.resources.used}">
          <span><strong>${resourcePercent}%</strong><small>used</small></span>
        </div>
        <div>
          <span class="builder-specs-eyebrow">Render resources</span>
          <strong>${specs.resources.used} of ${specs.resources.total} points</strong>
          <small>${specs.resources.remaining} points left · ${resourceState}</small>
        </div>
      </section>

      <div class="builder-specs-summary">
        ${renderSpecSummaryCard("Grid", "▦", specs.grid.used, specs.grid.total, `${specs.grid.remaining.toLocaleString()} cells left`, `${specs.grid.width} × ${specs.grid.height} at ${GRID_SNAP} step`)}
        ${renderSpecSummaryCard("Objects", "◇", specs.assetSlots.used, specs.assetSlots.total, `${specs.assetSlots.remaining} slots left`, "Recommended scene limit")}
        ${renderSpecSummaryCard("Residents", "●", specs.population.used, specs.population.total, `${specs.population.remaining} spaces left`, "People and animals")}
      </div>

      <section class="builder-specs-card">
        <div class="builder-card-heading"><span>Resource breakdown</span><small>Estimated GPU/CPU load</small></div>
        <div class="builder-specs-breakdown">
          ${specs.resourceGroups.map((group) => `
            <div class="builder-specs-row">
              <span><strong>${escapeHtml(group.label)}</strong><small>${group.count} ${group.count === 1 ? "item" : "items"}</small></span>
              <span><b>${group.points}</b><small>pts</small></span>
              <i aria-hidden="true"><span style="width:${Math.min((group.points / specs.resources.total) * 100, 100).toFixed(1)}%"></span></i>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="builder-specs-card builder-specs-grid-card">
        <div class="builder-card-heading"><span>How grid use is counted</span><small>Placement footprint</small></div>
        <div class="builder-specs-grid-visual" aria-hidden="true">
          ${Array.from({ length: 32 }, (_, index) => `<i class="${index < Math.round((specs.grid.used / specs.grid.total) * 32) ? "filled" : ""}"></i>`).join("")}
        </div>
        <p>Each visible square is a <strong>${GRID_SNAP} × ${GRID_SNAP}</strong> cell. Buildings consume their full collision footprint; small props use their placement radius.</p>
      </section>

      <aside class="builder-specs-note">
        <span aria-hidden="true">i</span>
        <p><strong>Planning guide, not a hard limit.</strong> Resource points estimate relative rendering cost: buildings cost up to 18 points, people 6, animals 4, and small props 1–3.</p>
      </aside>
    </div>
  `;
}

function renderSpecSummaryCard(label: string, icon: string, used: number, total: number, remaining: string, detail: string): string {
  const percent = Math.min((used / total) * 100, 100);
  return `
    <article class="builder-spec-summary-card">
      <span class="builder-spec-summary-icon" aria-hidden="true">${icon}</span>
      <span><small>${label}</small><strong>${used.toLocaleString()} <em>/ ${total.toLocaleString()}</em></strong></span>
      <i aria-hidden="true"><span style="width:${percent.toFixed(1)}%"></span></i>
      <b>${remaining}</b>
      <small>${detail}</small>
    </article>
  `;
}

function getTownSpecs(schema: TownSchema): TownSpecs {
  const gridWidth = Math.round((PLACEMENT_LIMIT * 2) / GRID_SNAP);
  const gridHeight = gridWidth;
  const totalGridCells = gridWidth * gridHeight;
  const cellArea = GRID_SNAP * GRID_SNAP;
  const usedGridCells = Math.min(totalGridCells, schema.assets.reduce((total, asset) => {
    const footprint = assetFootprint(asset);
    const area = footprint.kind === "circle"
      ? Math.PI * footprint.radius * footprint.radius
      : footprint.halfWidth * 2 * footprint.halfDepth * 2;
    return total + Math.max(1, Math.ceil(area / cellArea));
  }, 0));

  const assetGroups: Record<Exclude<AssetTileGroup, "all">, { label: string; count: number; points: number }> = {
    places: { label: "Places & structures", count: 0, points: 0 },
    landmarks: { label: "Landmarks", count: 0, points: 0 },
    nature: { label: "Nature & props", count: 0, points: 0 }
  };
  schema.assets.forEach((asset) => {
    const group = assetGroups[ASSET_TILE_CONFIG[asset.type].group];
    group.count += 1;
    group.points += ASSET_RESOURCE_COST[asset.type];
  });
  const populationCount = schema.citizens.length + schema.animals.length + 1;
  const residentPoints = (schema.citizens.length + 1) * CHARACTER_RESOURCE_COST + schema.animals.length * ANIMAL_RESOURCE_COST;
  const assetPoints = schema.assets.reduce((total, asset) => total + ASSET_RESOURCE_COST[asset.type], 0);
  const usedResourcePoints = assetPoints + residentPoints;

  return {
    grid: {
      used: usedGridCells,
      total: totalGridCells,
      remaining: Math.max(totalGridCells - usedGridCells, 0),
      width: gridWidth,
      height: gridHeight
    },
    resources: {
      used: usedResourcePoints,
      total: RENDER_RESOURCE_BUDGET,
      remaining: Math.max(RENDER_RESOURCE_BUDGET - usedResourcePoints, 0)
    },
    population: {
      used: populationCount,
      total: POPULATION_BUDGET,
      remaining: Math.max(POPULATION_BUDGET - populationCount, 0)
    },
    assetSlots: {
      used: schema.assets.length,
      total: ASSET_SLOT_BUDGET,
      remaining: Math.max(ASSET_SLOT_BUDGET - schema.assets.length, 0)
    },
    resourceGroups: [
      assetGroups.places,
      assetGroups.landmarks,
      assetGroups.nature,
      { label: "Residents", count: populationCount, points: residentPoints }
    ]
  };
}

function renderEnvironmentPanel(
  environment: EnvironmentSettings,
  status: EnvironmentRuntimeStatus | null,
  locating: boolean,
  locationError: string
): string {
  const effectiveWeather = status?.weather ?? environment.weather;
  const weatherIcons: Record<EnvironmentSettings["weather"], string> = {
    clear: "☀",
    cloudy: "☁",
    rain: "☂",
    storm: "ϟ",
    snow: "✦"
  };
  const weatherChoices: Array<{ value: EnvironmentSettings["weather"]; label: string }> = [
    { value: "clear", label: "Clear" },
    { value: "cloudy", label: "Cloudy" },
    { value: "rain", label: "Rain" },
    { value: "storm", label: "Storm" },
    { value: "snow", label: "Snow" }
  ];
  const seasonChoices: Array<{ value: SeasonChoice; label: string }> = environment.seasonCycle === "four"
    ? [
      { value: "auto", label: "Auto" },
      { value: "spring", label: "Spring" },
      { value: "summer", label: "Summer" },
      { value: "autumn", label: "Autumn" },
      { value: "winter", label: "Winter" }
    ]
    : [
      { value: "auto", label: "Auto" },
      { value: "wet", label: "Wet" },
      { value: "dry", label: "Dry" }
    ];
  const foliageChoices: Array<{ value: FallingFoliage; label: string; icon: string; description: string }> = [
    { value: "off", label: "Off", icon: "—", description: "Clean air" },
    { value: "sakura", label: "Sakura", icon: "✿", description: "Soft petals" },
    { value: "leaves", label: "Leaves", icon: "◆", description: "Season colours" },
    { value: "mixed", label: "Mixed", icon: "✦", description: "Petals + leaves" }
  ];
  const localHour = status?.localHour ?? environment.manualHour;
  const period = localHour >= 6 && localHour < 18
    ? "Daylight"
    : localHour >= 18 && localHour < 20
      ? "Dusk"
      : localHour >= 5 && localHour < 6
        ? "Dawn"
        : "Night";
  const liveSync = environment.weatherMode === "live" && environment.dayNightMode === "timezone" && environment.season === "auto";
  const creativeOverride = environment.weatherMode === "manual" && environment.dayNightMode === "manual" && environment.season !== "auto";
  const controlModeLabel = liveSync ? "Live sync" : creativeOverride ? "Creative override" : "Custom mix";
  const temperature = environment.weatherMode === "manual"
    ? "Art directed"
    : status?.snapshot
      ? `${Math.round(status.snapshot.temperature)}°C`
      : "—";
  const readingState = creativeOverride
    ? "Creative override"
    : environment.weatherMode === "manual"
      ? "Manual weather"
    : status?.loading
      ? "Listening for weather…"
      : status?.snapshot?.source === "stale-cache"
        ? "Offline · cached weather"
        : status?.snapshot?.source === "cache"
          ? "Cached weather"
      : status?.error
        ? "Using fallback weather"
        : status?.snapshot
          ? "Live weather connected"
          : "Waiting for live weather";
  const timezoneOptions = Array.from({ length: 27 }, (_, index) => index - 12)
    .map((offset) => `<option value="${offset}" ${environment.timezoneOffset === offset ? "selected" : ""}>GMT${offset >= 0 ? "+" : ""}${offset}</option>`)
    .join("");

  return `
    <div class="builder-environment-panel">
      <section class="builder-environment-hero">
        <span class="builder-environment-orb weather-${effectiveWeather}" aria-hidden="true">${weatherIcons[effectiveWeather]}</span>
        <div>
          <span class="builder-environment-eyebrow">${readingState}</span>
          <strong>${humanizeLabel(effectiveWeather)} · ${temperature}</strong>
          <small>${period} at ${formatEnvironmentHour(localHour)} · ${humanizeLabel(status?.season ?? (environment.season === "auto" ? environment.seasonCycle === "two" ? "wet" : "summer" : environment.season))}</small>
        </div>
        ${environment.weatherMode === "live" ? `<button type="button" class="builder-environment-refresh builder-tooltip" data-action="refresh-weather" aria-label="Refresh live weather" data-tooltip="Refresh weather" ${status?.loading ? "disabled" : ""}>↻</button>` : ""}
      </section>

      <section class="builder-environment-control ${creativeOverride ? "is-override" : liveSync ? "is-live" : "is-custom"}">
        <div class="builder-card-heading">
          <span>Environment control</span>
          <small>${controlModeLabel}</small>
        </div>
        <div class="builder-control-mode-grid" role="group" aria-label="Environment control mode">
          <button type="button" data-environment-mode="live" class="${liveSync ? "selected" : ""}" aria-pressed="${liveSync}">
            <span aria-hidden="true">◎</span>
            <strong>Live sync</strong>
            <small>Weather, clock and season follow the world</small>
          </button>
          <button type="button" data-environment-mode="override" class="${creativeOverride ? "selected" : ""}" aria-pressed="${creativeOverride}">
            <span aria-hidden="true">✦</span>
            <strong>Creative override</strong>
            <small>Freeze the world, then art-direct every layer</small>
          </button>
        </div>
        ${!liveSync && !creativeOverride ? `<p class="builder-control-mode-note">You are mixing live and manual settings. Choose a mode above to align all environment controls.</p>` : ""}
      </section>

      <section class="builder-environment-card">
        <div class="builder-card-heading"><span>Weather</span><small>${environment.weatherMode === "live" ? "Open-Meteo live" : "Your forecast"}</small></div>
        <div class="builder-segmented-control" aria-label="Weather source">
          ${environmentChoice("weatherMode", "live", "Live", environment.weatherMode === "live", "◎")}
          ${environmentChoice("weatherMode", "manual", "Manual", environment.weatherMode === "manual", "✦")}
        </div>
        ${environment.weatherMode === "manual" ? `
          <div class="builder-weather-grid">
            ${weatherChoices.map((choice) => environmentChoice("weather", choice.value, choice.label, environment.weather === choice.value, weatherIcons[choice.value])).join("")}
          </div>
        ` : `
          <div class="builder-location-summary">
            <span><small>Listening near</small><strong>${environment.latitude.toFixed(2)}, ${environment.longitude.toFixed(2)}</strong></span>
            <button type="button" data-action="use-location" ${locating ? "disabled" : ""}>${locating ? "Locating…" : "Use my location"}</button>
          </div>
          ${locationError ? `<p class="builder-environment-message error" role="status">${escapeHtml(locationError)}</p>` : ""}
          ${status?.error ? `<p class="builder-environment-message" role="status">${escapeHtml(status.error)} Clear weather remains active until the next refresh.</p>` : ""}
          <p class="builder-environment-attribution">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Cached locally for 30 minutes; location access is optional.</p>
        `}
      </section>

      <section class="builder-environment-card">
        <div class="builder-card-heading"><span>Day & night</span><small>Default GMT+8</small></div>
        ${renderSundial(localHour, environment.timezoneOffset)}
        <div class="builder-moon-summary">
          <span class="builder-moon-glyph" aria-hidden="true">◒</span>
          <span>
            <small>Moon tonight</small>
            <strong>${status?.moon?.phaseName ?? "Calculating phase…"}</strong>
          </span>
          <small>${status?.moon ? `${Math.round(status.moon.fraction * 100)}% lit · location-aware` : "Local astronomy"}</small>
        </div>
        <div class="builder-segmented-control" aria-label="Day and night mode">
          ${environmentChoice("dayNightMode", "timezone", "Follow clock", environment.dayNightMode === "timezone", "◷")}
          ${environmentChoice("dayNightMode", "manual", "Set time", environment.dayNightMode === "manual", "☼")}
        </div>
        ${environment.dayNightMode === "timezone" ? `
          <label class="builder-environment-select"><span>Town timezone</span><select data-environment-field="timezoneOffset">${timezoneOptions}</select></label>
        ` : `
          <label class="builder-environment-range">
            <span><strong>Time of day</strong><output>${formatEnvironmentHour(environment.manualHour)}</output></span>
            <input type="range" min="0" max="23" step="1" value="${environment.manualHour}" data-environment-field="manualHour" aria-label="Manual time of day" />
            <small><span>12 AM</span><span>12 PM</span><span>11 PM</span></small>
          </label>
        `}
      </section>

      <section class="builder-environment-card">
        <div class="builder-card-heading"><span>Seasons</span><small>${status ? humanizeLabel(status.season) : "Automatic"}</small></div>
        <div class="builder-segmented-control" aria-label="Season system">
          ${environmentChoice("seasonCycle", "four", "4 seasons", environment.seasonCycle === "four", "❖")}
          ${environmentChoice("seasonCycle", "two", "2 seasons", environment.seasonCycle === "two", "◒")}
        </div>
        <div class="builder-season-row" aria-label="Active season">
          ${seasonChoices.map((choice) => environmentChoice("season", choice.value, choice.label, environment.season === choice.value)).join("")}
        </div>
      </section>

      <section class="builder-environment-card">
        <div class="builder-card-heading"><span>Falling foliage</span><small>Particle style</small></div>
        <div class="builder-foliage-grid">
          ${foliageChoices.map((choice) => `
            <button type="button" data-environment-choice="foliage:${choice.value}" class="builder-foliage-card ${environment.foliage === choice.value ? "selected" : ""}" aria-pressed="${environment.foliage === choice.value}">
              <span aria-hidden="true">${choice.icon}</span><strong>${choice.label}</strong><small>${choice.description}</small>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function environmentChoice(
  field: keyof EnvironmentSettings,
  value: string,
  label: string,
  selected: boolean,
  icon = ""
): string {
  return `<button type="button" data-environment-choice="${field}:${value}" class="${selected ? "selected" : ""}" aria-pressed="${selected}">${icon ? `<span aria-hidden="true">${icon}</span>` : ""}${label}</button>`;
}

function getTimezoneHour(timezoneOffset: number): number {
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  return ((utcHours + timezoneOffset) % 24 + 24) % 24;
}

function inferAutomaticSeason(environment: EnvironmentSettings): Exclude<SeasonChoice, "auto"> {
  const shifted = new Date(Date.now() + environment.timezoneOffset * 60 * 60 * 1000);
  const month = shifted.getUTCMonth() + 1;
  if (environment.seasonCycle === "two") return month >= 11 || month <= 3 ? "wet" : "dry";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function formatEnvironmentHour(hour: number): string {
  const totalMinutes = ((Math.round(hour * 60) % 1440) + 1440) % 1440;
  const normalizedHour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const display = normalizedHour % 12 || 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function renderSundial(hour: number, timezoneOffset: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const isDay = normalized >= 6 && normalized < 18;
  const progress = isDay
    ? (normalized - 6) / 12
    : normalized >= 18
      ? (normalized - 18) / 12
      : (normalized + 6) / 12;
  const markerX = 20 + progress * 200;
  const markerY = 87 - Math.sin(progress * Math.PI) * 65;
  const phase = isDay
    ? normalized < 10
      ? "Morning"
      : normalized < 15
        ? "Afternoon"
        : "Evening"
    : normalized < 5
      ? "Late night"
      : normalized < 6
        ? "Before dawn"
        : "Night";
  const timezone = `GMT${timezoneOffset >= 0 ? "+" : ""}${timezoneOffset}`;
  const label = `${formatEnvironmentHour(normalized)}, ${phase}. ${isDay ? "The sun is above the horizon." : "The sun is below the horizon."}`;
  return `
    <div class="builder-sundial ${isDay ? "is-day" : "is-night"}" role="img" aria-label="${escapeHtml(label)}">
      <div class="builder-sundial-time">
        <span><strong>${formatEnvironmentHour(normalized)}</strong><small>${timezone}</small></span>
        <span class="builder-sundial-state"><i aria-hidden="true"></i>${isDay ? "Day" : "Night"}</span>
      </div>
      <svg viewBox="0 0 240 112" aria-hidden="true">
        <path class="builder-sundial-sky" d="M20 87 A100 65 0 0 1 220 87"></path>
        <path class="builder-sundial-arc" d="M20 87 A100 65 0 0 1 220 87"></path>
        <path class="builder-sundial-horizon" d="M12 87 H228"></path>
        <g class="builder-sundial-marker" transform="translate(${markerX.toFixed(2)} ${markerY.toFixed(2)})">
          ${isDay
            ? `<circle r="8"></circle><path d="M0-14v-4M0 14v4M-14 0h-4M14 0h4M-10-10l-3-3M10-10l3-3M-10 10l-3 3M10 10l3 3"></path>`
            : `<path d="M7-8A10 10 0 1 0 8 7 8 8 0 0 1 7-8Z"></path>`}
        </g>
        <text x="20" y="105">6 AM</text>
        <text x="120" y="105" text-anchor="middle">12 PM</text>
        <text x="220" y="105" text-anchor="end">6 PM</text>
      </svg>
      <div class="builder-sundial-caption"><span>${phase}</span><small>Sunrise → solar noon → sunset</small></div>
    </div>
  `;
}

function renderEmptyState(title: string, body: string): string {
  return `<div class="builder-empty-state"><span aria-hidden="true">⌕</span><strong>${title}</strong><small>${body}</small></div>`;
}

function renderConfirmation(confirmation: BuilderConfirmation): string {
  const deleting = confirmation.kind === "delete-asset";
  const title = deleting ? `Remove ${confirmation.assetName}?` : "Reset your town draft?";
  const description = deleting
    ? "This asset will disappear from the town. You can still restore it with Undo."
    : "Every local builder change will be replaced with the shipped town layout. This cannot be undone.";
  return `
    <div class="builder-confirmation-backdrop" data-action="cancel-confirmation">
      <section class="builder-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="builder-confirmation-title" aria-describedby="builder-confirmation-description" data-confirmation-card>
        <div class="builder-confirmation-icon" aria-hidden="true">${deleting ? "−" : "↺"}</div>
        <div class="builder-confirmation-copy">
          <span class="builder-kicker">${deleting ? "Remove asset" : "Reset draft"}</span>
          <h2 id="builder-confirmation-title">${escapeHtml(title)}</h2>
          <p id="builder-confirmation-description">${description}</p>
        </div>
        <div class="builder-confirmation-actions">
          <button type="button" data-action="cancel-confirmation">Keep it</button>
          <button type="button" data-action="confirm-destructive" class="builder-confirm-destructive">${deleting ? "Remove asset" : "Reset town"}</button>
        </div>
      </section>
    </div>
  `;
}

function renderAssetTiles(filter: AssetTileGroup, search = ""): string {
  return ASSET_TYPES
    .filter((type) => (filter === "all" || ASSET_TILE_CONFIG[type].group === filter) && assetTypeLabel(type).toLowerCase().includes(search))
    .map((type) => {
      return `<button type="button" class="builder-asset-tile asset-tile-${type}" data-add="${type}" title="Add ${assetTypeLabel(type)}"><span class="builder-add-badge" aria-hidden="true">+</span><img data-asset-thumbnail="${type}" alt="" aria-hidden="true" /><small>${assetTypeLabel(type)}</small></button>`;
    })
    .join("");
}

function createTilePreviewRenderer(createAsset: (asset: TownAsset) => THREE.Object3D | null): TilePreviewRenderer {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(120, 84, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 120 / 84, 0.1, 160);
  const keyLight = new THREE.DirectionalLight("#fff3d6", 2.1);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight, new THREE.HemisphereLight("#fff8e9", "#607557", 1.5));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color: "#f1dfb6", transparent: true, opacity: 0.38, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const cache = new Map<TownAssetType, string>();

  const render = (type: TownAssetType): string | null => {
    const cached = cache.get(type);
    if (cached) return cached;

    const model = createAsset(createPalettePreviewAsset(type));
    if (!model) return null;
    scene.add(model);
    try {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 1);
      model.position.sub(center);
      model.position.y -= bounds.min.y - center.y;
      model.rotation.y = -0.24;
      floor.scale.setScalar(span * 0.88);
      camera.position.set(span * 1.35, span * 0.95, span * 1.55);
      camera.lookAt(0, size.y * 0.36, 0);
      renderer.render(scene, camera);

      const image = renderer.domElement.toDataURL("image/png");
      cache.set(type, image);
      return image;
    } finally {
      scene.remove(model);
      disposePreviewObject(model);
    }
  };

  return {
    render,
    dispose: () => {
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    }
  };
}

function createPalettePreviewAsset(type: TownAssetType): TownAsset {
  return {
    id: `palette-preview-${type}`,
    type,
    position: [0, 0],
    label: assetTypeLabel(type),
    color: type === "building" ? "#7e9f95" : type === "market" ? "#d9bd7b" : type === "booth" ? "#d5745c" : type === "flowerBed" ? "#f2b35f" : type === "tinyFlag" ? "#2e6f72" : undefined,
    roofColor: type === "building" ? "#667c86" : undefined,
    stripeColor: type === "booth" ? "#f2d583" : undefined,
    collision: defaultCollision(type)
  };
}

function renderAssetForm(asset: TownAsset): string {
  const hasLabel = asset.type === "building" || asset.type === "market" || asset.type === "booth";
  const colorFields = [
    asset.color ? colorField("Color", "asset.color", asset.color) : "",
    asset.roofColor ? colorField("Roof", "asset.roofColor", asset.roofColor) : "",
    asset.stripeColor ? colorField("Stripe", "asset.stripeColor", asset.stripeColor) : "",
  ].filter(Boolean).join("");
  return `
    <section class="builder-section builder-asset-editor">
      <div class="builder-editor-heading">
        <span class="builder-section-title">${escapeHtml(assetTypeLabel(asset.type))}</span>
        <span class="builder-editor-status">Selected</span>
      </div>
      <div class="builder-inspector-card builder-identity-card">
        <label class="builder-field"><span>Id</span><input value="${escapeHtml(asset.id)}" disabled /></label>
        ${hasLabel ? `<label class="builder-field"><span>Label</span><input data-schema-field="asset.label" value="${escapeHtml(asset.label ?? "")}" /></label>` : ""}
      </div>
      <div class="builder-inspector-card builder-transform-card">
        <div class="builder-card-heading"><span>Transform</span><small>0.5 grid step</small></div>
        <div class="builder-field-row">
          ${numberField("X", "asset.x", asset.position[0], 0.1)}
          ${numberField("Z", "asset.z", asset.position[1], 0.1)}
        </div>
        <div class="builder-field-row">
          ${numberField("Rotation", "asset.rotation", THREE_TO_DEGREES(asset.rotation ?? 0), 5)}
          ${numberField("Scale", "asset.scale", asset.scale ?? 1, 0.05, 0.2, 3)}
        </div>
        <div class="builder-transform-toolbar">
          <span>Adjust</span>
          <div class="builder-control-cluster" aria-label="Move selected asset">
            <button type="button" class="builder-tooltip" data-nudge="0,-0.5" aria-label="Move up" data-tooltip="Move up">↑</button>
            <button type="button" class="builder-tooltip" data-nudge="-0.5,0" aria-label="Move left" data-tooltip="Move left">←</button>
            <button type="button" class="builder-tooltip" data-nudge="0,0.5" aria-label="Move down" data-tooltip="Move down">↓</button>
            <button type="button" class="builder-tooltip" data-nudge="0.5,0" aria-label="Move right" data-tooltip="Move right">→</button>
          </div>
          <div class="builder-control-cluster" aria-label="Rotate selected asset">
            <button type="button" class="builder-tooltip" data-rotate="-15" aria-label="Rotate left 15 degrees" data-tooltip="Rotate left">↺</button>
            <button type="button" class="builder-tooltip" data-rotate="15" aria-label="Rotate right 15 degrees" data-tooltip="Rotate right">↻</button>
          </div>
        </div>
      </div>
      ${colorFields ? `<div class="builder-inspector-card builder-appearance-card"><div class="builder-card-heading"><span>Appearance</span></div><div class="builder-asset-color-grid">${colorFields}</div></div>` : ""}
      <div class="builder-action-grid builder-asset-actions">
        <button type="button" data-action="duplicate">Duplicate</button>
        <button type="button" data-action="delete" class="builder-danger">Delete</button>
      </div>
    </section>
  `;
}

function renderCharacterForm(character: CharacterSchema): string {
  const movement = character.movement;
  const appearance = character.appearance;
  const choiceButtons = (field: string, choices: readonly string[], current: string) => choices.map((choice) => `
    <button type="button" data-character-choice="${field}:${choice}" class="builder-choice-card ${current === choice ? "selected" : ""}" aria-pressed="${current === choice}">
      <span class="builder-choice-icon builder-choice-${choice}" aria-hidden="true"></span>
      <small>${humanizeLabel(choice)}</small>
    </button>`).join("");
  const swatches = (field: string, colors: readonly string[], current: string) => colors.map((color) => `
    <button type="button" data-character-choice="${field}:${color}" class="builder-swatch ${current.toLowerCase() === color.toLowerCase() ? "selected" : ""}" style="--swatch:${color}" aria-label="${field} ${color}" aria-pressed="${current.toLowerCase() === color.toLowerCase()}"></button>`).join("");
  return `
    <section class="builder-section builder-character-editor">
      <div class="builder-editor-heading">
        <span class="builder-section-title">${character.kind === "player" ? "Player character" : escapeHtml(character.id)}</span>
        <button type="button" class="builder-randomize" data-action="randomize-character">↻ Randomize</button>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Start with a look</span><small>Presets</small></div>
        <div class="builder-preset-grid">
          ${CHARACTER_PRESETS.map((preset, index) => `<button type="button" data-character-preset="${index}" class="builder-preset-card"><span class="builder-avatar" style="--avatar-skin:${preset.appearance.skin};--avatar-hair:${preset.appearance.hair};--avatar-shirt:${preset.appearance.shirt}" aria-hidden="true"><i></i></span><small>${preset.label}</small></button>`).join("")}
        </div>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Body</span><small>Silhouette</small></div>
        <div class="builder-choice-grid builder-choice-grid-four">
          ${choiceButtons("bodyPreset", ["compact", "average", "tall", "broad"], appearance.bodyPreset ?? "average")}
        </div>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Hair</span><small>${humanizeLabel(appearance.hairStyle)}</small></div>
        <div class="builder-choice-grid">
          ${choiceButtons("hairStyle", HAIR_STYLES, appearance.hairStyle)}
        </div>
        <div class="builder-swatch-row">${swatches("hair", HAIR_COLORS, appearance.hair)}</div>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Skin tone</span><small>8 shades</small></div>
        <div class="builder-swatch-row builder-skin-row">${swatches("skin", SKIN_TONES, appearance.skin)}</div>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Face & accessories</span><small>Details</small></div>
        <div class="builder-choice-grid builder-choice-grid-four">
          ${choiceButtons("faceStyle", ["soft", "round", "bright"], appearance.faceStyle ?? "soft")}
        </div>
        <div class="builder-choice-grid builder-choice-grid-four">
          ${choiceButtons("accessory", ["none", "glasses", "cap", "beanie"], appearance.accessory ?? "none")}
        </div>
      </div>
      <div class="builder-customizer-block">
        <div class="builder-card-heading"><span>Outfit</span><small>Mix and match</small></div>
        <div class="builder-outfit-grid">
          ${OUTFIT_PRESETS.map((preset) => `<button type="button" data-outfit-preset="${preset.id}" class="builder-outfit-card"><span style="--shirt:${preset.shirt};--pants:${preset.pants};--shoes:${preset.shoes}" aria-hidden="true"></span><small>${preset.label}</small></button>`).join("")}
        </div>
        <details class="builder-advanced">
          <summary>Fine-tune colours</summary>
          <div class="builder-color-grid">${COLOR_FIELDS.map((field) => colorField(humanizeLabel(field), `character.${field}`, appearance[field])).join("")}</div>
        </details>
      </div>
      ${movement ? `<details class="builder-advanced"><summary>Movement tuning</summary><div class="builder-field-row">${numberField("Walk", "character.walk", movement.walk, 0.01, 0.5, 1.5)}${numberField("Sprint", "character.sprint", movement.sprint, 0.01, 0.5, 1.5)}${numberField("Jump", "character.jump", movement.jump, 0.01, 0.5, 1.5)}</div></details>` : ""}
    </section>
  `;
}

function renderAnimalForm(animal: AnimalSchema): string {
  const pace = animal.speed < 0.8 ? "Gentle" : animal.speed > 1.15 ? "Playful" : "Steady";
  return `
    <section class="builder-section builder-animal-editor">
      <div class="builder-editor-heading">
        <span class="builder-section-title">${humanizeLabel(animal.kind)}</span>
        <span class="builder-editor-status">Town animal</span>
      </div>
      <div class="builder-inspector-card builder-identity-card">
        <label class="builder-field"><span>Name</span><input data-schema-field="animal.label" value="${escapeHtml(animal.label)}" maxlength="24" /></label>
        <label class="builder-field"><span>Species</span><input value="${humanizeLabel(animal.kind)}" disabled /></label>
      </div>
      <div class="builder-inspector-card builder-appearance-card">
        <div class="builder-card-heading"><span>Coat & markings</span><small>Live preview</small></div>
        <div class="builder-asset-color-grid">
          ${colorField(animal.kind === "goose" ? "Feathers" : "Coat", "animal.primaryColor", animal.primaryColor)}
          ${colorField(animal.kind === "goose" ? "Beak & feet" : "Markings", "animal.secondaryColor", animal.secondaryColor)}
        </div>
      </div>
      <div class="builder-inspector-card builder-animal-behaviour">
        <div class="builder-card-heading"><span>Roaming</span><small>${pace} pace</small></div>
        <label class="builder-animal-speed">
          <span><strong>Movement speed</strong><output>${animal.speed.toFixed(2)}×</output></span>
          <input type="range" min="0.2" max="1.6" step="0.01" value="${animal.speed}" data-schema-field="animal.speed" aria-label="${escapeHtml(animal.label)} movement speed" />
          <small><span>Calm</span><span>Playful</span></small>
        </label>
        <p class="builder-animal-note">${escapeHtml(animal.label)} follows a safe roaming route around town. Their path stays unchanged while you tune their look and pace.</p>
      </div>
    </section>
  `;
}

function applyFieldChange(
  field: string,
  value: string | number,
  asset?: TownAsset,
  character?: CharacterSchema,
  animal?: AnimalSchema,
  canApplyTransform?: (asset: TownAsset) => boolean
): boolean | void {
  if (asset) {
    const candidate: TownAsset = { ...asset, position: [...asset.position] as [number, number] };
    if (field === "asset.x") candidate.position[0] = Number(value);
    if (field === "asset.z") candidate.position[1] = Number(value);
    if (field === "asset.rotation") {
      const rotation = (Number(value) * Math.PI) / 180;
      candidate.rotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
    }
    if (field === "asset.scale") candidate.scale = Math.min(3, Math.max(0.2, Number(value) || 1));
    if (["asset.x", "asset.z", "asset.rotation", "asset.scale"].includes(field) && canApplyTransform && !canApplyTransform(candidate)) return false;
    if (field === "asset.x" || field === "asset.z") asset.position = candidate.position;
    if (field === "asset.rotation") asset.rotation = candidate.rotation;
    if (field === "asset.scale") asset.scale = candidate.scale;
    if (field === "asset.label") asset.label = String(value);
    if (field === "asset.color") asset.color = String(value);
    if (field === "asset.roofColor") asset.roofColor = String(value);
    if (field === "asset.stripeColor") asset.stripeColor = String(value);
  }
  if (character) {
    if (field === "character.hairStyle") character.appearance.hairStyle = value as CharacterAppearance["hairStyle"];
    if (field === "character.skin") character.appearance.skin = String(value);
    if (field === "character.hair") character.appearance.hair = String(value);
    if (field === "character.shirt") character.appearance.shirt = String(value);
    if (field === "character.trim") character.appearance.trim = String(value);
    if (field === "character.pants") character.appearance.pants = String(value);
    if (field === "character.shoes") character.appearance.shoes = String(value);
    if (field === "character.bodyPreset") character.appearance.bodyPreset = value as NonNullable<CharacterAppearance["bodyPreset"]>;
    if (field === "character.faceStyle") character.appearance.faceStyle = value as NonNullable<CharacterAppearance["faceStyle"]>;
    if (field === "character.accessory") character.appearance.accessory = value as NonNullable<CharacterAppearance["accessory"]>;
    if (character.movement) {
      if (field === "character.walk") character.movement.walk = Number(value);
      if (field === "character.sprint") character.movement.sprint = Number(value);
      if (field === "character.jump") character.movement.jump = Number(value);
    }
  }
  if (animal) {
    if (field === "animal.label") animal.label = String(value).trim().slice(0, 24) || humanizeLabel(animal.kind);
    if (field === "animal.primaryColor") animal.primaryColor = String(value);
    if (field === "animal.secondaryColor") animal.secondaryColor = String(value);
    if (field === "animal.speed") animal.speed = Math.min(1.6, Math.max(0.2, Number(value) || 0.2));
  }
}

function defaultCollision(type: TownAssetType): TownAsset["collision"] | undefined {
  if (type === "tree" || type === "lamp") return { kind: "circle", radius: type === "tree" ? 0.55 : 0.32 };
  if (type === "fountain" || type === "monument") return { kind: "circle", radius: type === "fountain" ? 1.75 : 1.55 };
  if (type === "waterTower") return { kind: "circle", radius: 2.35 };
  if (type === "shrub") return { kind: "circle", radius: 0.5 };
  if (type === "rock") return { kind: "circle", radius: 0.55 };
  if (type === "grassClump") return { kind: "circle", radius: 0.22 };
  if (type === "tinyFlag") return { kind: "circle", radius: 0.28 };
  if (type === "picnicTable") return { kind: "box", width: 1.65, depth: 1.45, top: 0.85 };
  if (type === "bench") return { kind: "box", width: 0.9, depth: 2.05, top: 1.04 };
  if (type === "fence") return { kind: "box", width: 5.1, depth: 0.35 };
  if (type === "gardenPlot") return { kind: "box", width: 1.9, depth: 1.18, top: 0.32 };
  if (type === "flowerBed") return { kind: "box", width: 1.5, depth: 1.1, top: 0.35 };
  if (type === "parcelCart") return { kind: "box", width: 1.5, depth: 0.9, top: 1.08 };
  if (type === "communityBoard") return { kind: "box", width: 1.8, depth: 0.35 };
  if (type === "welcomeSign") return { kind: "box", width: 4.1, depth: 0.55 };
  if (type === "building") return { kind: "box", width: 4.9, depth: 4.25 };
  if (type === "market") return { kind: "box", width: 3.3, depth: 2 };
  if (type === "booth") return { kind: "box", width: 2.5, depth: 1.45 };
  return { kind: "circle", radius: 0.4 };
}

type Point2 = { x: number; z: number };
type CircleFootprint = { kind: "circle"; center: Point2; radius: number };
type BoxFootprint = { kind: "box"; center: Point2; halfWidth: number; halfDepth: number; rotation: number };
type AssetFootprint = CircleFootprint | BoxFootprint;

const PLACEMENT_CLEARANCE = 0.16;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

function assetsOverlap(first: TownAsset, second: TownAsset): boolean {
  return footprintsOverlap(assetFootprint(first), assetFootprint(second));
}

function assetFootprint(asset: TownAsset): AssetFootprint {
  const collision = asset.collision ?? defaultCollision(asset.type);
  const scale = Math.max(asset.scale ?? 1, 0.2);
  const center = { x: asset.position[0], z: asset.position[1] };
  const padding = PLACEMENT_CLEARANCE / 2;

  if (collision?.kind === "box") {
    return {
      kind: "box",
      center,
      halfWidth: (collision.width * scale) / 2 + padding,
      halfDepth: (collision.depth * scale) / 2 + padding,
      rotation: asset.rotation ?? 0
    };
  }

  return {
    kind: "circle",
    center,
    radius: (collision?.kind === "circle" ? collision.radius : 0.4) * scale + padding
  };
}

function footprintsOverlap(first: AssetFootprint, second: AssetFootprint): boolean {
  if (first.kind === "circle" && second.kind === "circle") return circlesOverlap(first, second);
  if (first.kind === "box" && second.kind === "box") return boxesOverlap(first, second);
  if (first.kind === "circle" && second.kind === "box") return circleOverlapsBox(first, second);
  return circleOverlapsBox(second as CircleFootprint, first as BoxFootprint);
}

function circlesOverlap(first: CircleFootprint, second: CircleFootprint): boolean {
  const x = first.center.x - second.center.x;
  const z = first.center.z - second.center.z;
  const radius = first.radius + second.radius;
  return x * x + z * z < radius * radius;
}

function boxesOverlap(first: BoxFootprint, second: BoxFootprint): boolean {
  const delta = { x: second.center.x - first.center.x, z: second.center.z - first.center.z };
  const axes = [boxWidthAxis(first.rotation), boxDepthAxis(first.rotation), boxWidthAxis(second.rotation), boxDepthAxis(second.rotation)];

  return axes.every((axis) => {
    const distance = Math.abs(dot(delta, axis));
    const firstReach = projectionRadius(first, axis);
    const secondReach = projectionRadius(second, axis);
    return distance < firstReach + secondReach;
  });
}

function circleOverlapsBox(circle: CircleFootprint, box: BoxFootprint): boolean {
  const delta = { x: circle.center.x - box.center.x, z: circle.center.z - box.center.z };
  const widthAxis = boxWidthAxis(box.rotation);
  const depthAxis = boxDepthAxis(box.rotation);
  const localX = dot(delta, widthAxis);
  const localZ = dot(delta, depthAxis);
  const nearestX = clamp(localX, -box.halfWidth, box.halfWidth);
  const nearestZ = clamp(localZ, -box.halfDepth, box.halfDepth);
  const distanceX = localX - nearestX;
  const distanceZ = localZ - nearestZ;
  return distanceX * distanceX + distanceZ * distanceZ < circle.radius * circle.radius;
}

function boxWidthAxis(rotation: number): Point2 {
  return { x: Math.cos(rotation), z: Math.sin(rotation) };
}

function boxDepthAxis(rotation: number): Point2 {
  return { x: -Math.sin(rotation), z: Math.cos(rotation) };
}

function projectionRadius(box: BoxFootprint, axis: Point2): number {
  return box.halfWidth * Math.abs(dot(boxWidthAxis(box.rotation), axis))
    + box.halfDepth * Math.abs(dot(boxDepthAxis(box.rotation), axis));
}

function dot(first: Point2, second: Point2): number {
  return first.x * second.x + first.z * second.z;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function numberField(label: string, field: string, value: number, step: number, min?: number, max?: number): string {
  return `<label class="builder-field"><span>${label}</span><input data-schema-field="${field}" type="number" value="${Number(value.toFixed(3))}" step="${step}" ${min !== undefined ? `min="${min}"` : ""} ${max !== undefined ? `max="${max}"` : ""} /></label>`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}

function colorField(label: string, field: string, value: string): string {
  return `<label class="builder-color-field"><span>${label}</span><input data-schema-field="${field}" type="color" value="${value}" /></label>`;
}

function assetTypeLabel(type: TownAssetType): string {
  return humanizeLabel(type);
}

function humanizeLabel(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function THREE_TO_DEGREES(value: number): number {
  return (value * 180) / Math.PI;
}
