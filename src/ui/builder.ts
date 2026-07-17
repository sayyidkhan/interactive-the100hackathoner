import * as THREE from "three";
import {
  CharacterAppearance,
  CharacterSchema,
  TownAsset,
  TownAssetType,
  TownSchema,
  clearTownSchemaDraft,
  cloneTownSchema,
  parseTownSchema,
  saveTownSchemaDraft
} from "../data/townSchema";

type BuilderSelection = { kind: "asset"; id: string } | { kind: "player" } | { kind: "citizen"; id: string };

export type TownBuilderApi = {
  isActive: () => boolean;
  selectAsset: (id: string) => void;
  selectCharacter: (kind: "player" | "citizen", id?: string) => void;
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
  onCameraZoom?: (amount: number) => void;
  onCameraReset?: () => void;
};

type AssetPreview = { dispose: () => void };

const ASSET_TYPES: TownAssetType[] = ["building", "market", "booth", "picnicTable", "bench", "tree", "shrub", "flowerBed", "gardenPlot", "rock", "fence", "grassClump", "lamp", "tinyFlag", "communityBoard", "parcelCart", "fountain", "monument", "welcomeSign", "waterTower"];
const COLOR_FIELDS: Array<keyof CharacterAppearance> = ["skin", "hair", "shirt", "trim", "pants", "shoes"];
const GRID_SNAP = 0.5;
const ASSET_TILE_GROUPS = [
  { id: "all", label: "All" },
  { id: "places", label: "Places" },
  { id: "landmarks", label: "Landmarks" },
  { id: "nature", label: "Nature" }
] as const;
type AssetTileGroup = (typeof ASSET_TILE_GROUPS)[number]["id"];

const ASSET_TILE_CONFIG: Record<TownAssetType, { group: Exclude<AssetTileGroup, "all">; glyph: string }> = {
  building: { group: "places", glyph: "H" },
  market: { group: "places", glyph: "M" },
  booth: { group: "places", glyph: "B" },
  parcelCart: { group: "places", glyph: "C" },
  communityBoard: { group: "places", glyph: "S" },
  welcomeSign: { group: "landmarks", glyph: "W" },
  fountain: { group: "landmarks", glyph: "F" },
  monument: { group: "landmarks", glyph: "T" },
  waterTower: { group: "landmarks", glyph: "O" },
  tree: { group: "nature", glyph: "Y" },
  shrub: { group: "nature", glyph: "U" },
  picnicTable: { group: "places", glyph: "P" },
  bench: { group: "places", glyph: "N" },
  flowerBed: { group: "nature", glyph: "F" },
  gardenPlot: { group: "nature", glyph: "G" },
  rock: { group: "nature", glyph: "R" },
  fence: { group: "places", glyph: "E" },
  grassClump: { group: "nature", glyph: "V" },
  lamp: { group: "nature", glyph: "L" },
  tinyFlag: { group: "landmarks", glyph: "A" }
};

export function createTownBuilder(root: HTMLElement, options: BuilderOptions): TownBuilderApi {
  const dedicatedBuilderRoute = window.location.pathname === "/local-builder";
  let schema = cloneTownSchema(options.initialSchema);
  let selection: BuilderSelection = { kind: "asset", id: schema.assets[0]?.id ?? "" };
  let active = options.startActive ?? (dedicatedBuilderRoute || new URLSearchParams(window.location.search).has("builder"));
  const history = [JSON.stringify(schema)];
  let historyIndex = 0;
  let paletteFilter: AssetTileGroup = "all";
  let paletteOpen = true;
  let inspectorOpen = true;
  let assetPreview: AssetPreview | null = null;

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

  const notify = () => {
    saveTownSchemaDraft(schema);
    options.onSchemaChange(cloneTownSchema(schema));
  };

  const commit = (mutate: () => void) => {
    mutate();
    if (!recordHistory()) return;
    notify();
    render();
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
    commit(() => {
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
      schema.assets.push(asset);
      selection = { kind: "asset", id };
    });
  };

  const duplicateAsset = () => {
    const asset = getSelectedAsset();
    if (!asset) return;
    commit(() => {
      const copy = cloneTownSchema({ ...schema, assets: [asset] }).assets[0];
      copy.id = `${asset.id}-copy-${Date.now().toString(36)}`;
      copy.position = [asset.position[0] + 1, asset.position[1] + 1];
      schema.assets.push(copy);
      selection = { kind: "asset", id: copy.id };
    });
  };

  const nudgeAsset = (x: number, z: number) => {
    const asset = getSelectedAsset();
    if (!asset) return;
    commit(() => {
      asset.position[0] = Number((asset.position[0] + x).toFixed(2));
      asset.position[1] = Number((asset.position[1] + z).toFixed(2));
    });
  };

  const rotateAsset = (degrees: number) => {
    const asset = getSelectedAsset();
    if (!asset) return;
    commit(() => {
      const rotation = (asset.rotation ?? 0) + (degrees * Math.PI) / 180;
      asset.rotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
    });
  };

  const moveAsset = (id: string, x: number, z: number) => {
    const asset = schema.assets.find((candidate) => candidate.id === id);
    if (!asset) return;
    asset.position[0] = Math.round(x / GRID_SNAP) * GRID_SNAP;
    asset.position[1] = Math.round(z / GRID_SNAP) * GRID_SNAP;
    options.onAssetPositionPreview?.(asset);
    options.onSelectionChange?.(asset);
  };

  const commitAssetMove = () => {
    if (!recordHistory()) return;
    notify();
    render();
  };

  const deleteAsset = () => {
    const asset = getSelectedAsset();
    if (!asset || !window.confirm(`Remove ${asset.label ?? asset.id}?`)) return;
    commit(() => {
      schema.assets = schema.assets.filter((candidate) => candidate.id !== asset.id);
      selection = schema.assets[0] ? { kind: "asset", id: schema.assets[0].id } : { kind: "player" };
    });
  };

  const resetShipped = () => {
    if (!window.confirm("Reset this browser draft to the shipped town schema?")) return;
    schema = cloneTownSchema(options.shippedSchema);
    history.splice(0, history.length, JSON.stringify(schema));
    historyIndex = 0;
    selection = { kind: "asset", id: schema.assets[0]?.id ?? "" };
    clearTownSchemaDraft();
    options.onSchemaChange(cloneTownSchema(schema));
    render();
  };

  const exportSchema = () => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "the-100th-hackathoner-ville.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSchema = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        schema = parseTownSchema(JSON.parse(String(reader.result)));
        history.splice(0, history.length, JSON.stringify(schema));
        historyIndex = 0;
        selection = { kind: "asset", id: schema.assets[0]?.id ?? "" };
        notify();
        render();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not import that schema.");
      }
    };
    reader.readAsText(file);
  };

  const render = () => {
    assetPreview?.dispose();
    assetPreview = null;
    const selectedAsset = getSelectedAsset();
    const selectedCharacter = getSelectedCharacter();
    options.onSelectionChange?.(selectedAsset ?? null);
    shell.hidden = !active;
    shell.innerHTML = `
      ${paletteOpen ? `<section class="builder-palette" aria-label="Town asset palette">
        <header class="builder-header">
          <div>
            <span class="builder-kicker">Local builder</span>
            <strong>Town kit</strong>
          </div>
          <div class="builder-header-actions">
            <button class="builder-icon-button builder-tooltip" type="button" data-action="collapse-palette" aria-label="Close town kit" data-tooltip="Close town kit">×</button>
          </div>
        </header>
        <div class="builder-palette-body">
          <div class="builder-filter-row" role="tablist" aria-label="Asset categories">
            ${ASSET_TILE_GROUPS.map((group) => `<button type="button" data-filter="${group.id}" class="${paletteFilter === group.id ? "active" : ""}">${group.label}</button>`).join("")}
          </div>
          <div class="builder-tile-grid">
            ${renderAssetTiles(paletteFilter)}
          </div>
          <section class="builder-characters">
            <span class="builder-section-title">Characters</span>
            <div class="builder-character-grid">
              <button type="button" data-select-character="player" class="builder-character-tile ${selection.kind === "player" ? "selected" : ""}">Player</button>
              ${schema.citizens.map((citizen) => `<button type="button" data-select-character="citizen:${citizen.id}" class="builder-character-tile ${selection.kind === "citizen" && selection.id === citizen.id ? "selected" : ""}">${escapeHtml(citizen.id.replace("citizen-", ""))}</button>`).join("")}
            </div>
          </section>
          <div class="builder-draft-row">
            <button type="button" data-action="undo" ${historyIndex === 0 ? "disabled" : ""}>Undo</button>
            <button type="button" data-action="redo" ${historyIndex >= history.length - 1 ? "disabled" : ""}>Redo</button>
            <button type="button" data-action="export">Export</button>
            <button type="button" data-action="import">Import</button>
          </div>
          <input data-field="import" type="file" accept="application/json" hidden />
        </div>
      </section>` : `<div class="builder-drawer-group builder-drawer-group-left">
        <button class="builder-drawer-button builder-back-button builder-tooltip" type="button" data-action="back-to-town" aria-label="Back to town" data-tooltip="Back to town"><span aria-hidden="true">←</span></button>
        <button class="builder-drawer-button builder-tooltip" type="button" data-action="expand-palette" aria-label="Open town kit" data-tooltip="Open town kit"><span aria-hidden="true">▦</span></button>
      </div>`}
      ${inspectorOpen ? `<aside class="builder-inspector" aria-label="Selected asset inspector">
        <header class="builder-header">
          <div>
            <span class="builder-kicker">Selected</span>
            <strong>${selectedAsset ? escapeHtml(selectedAsset.label ?? assetTypeLabel(selectedAsset.type)) : selectedCharacter ? escapeHtml(selectedCharacter.kind === "player" ? "Player" : selectedCharacter.id.replace("citizen-", "")) : "Nothing selected"}</strong>
          </div>
          <button class="builder-icon-button builder-tooltip" type="button" data-action="collapse-inspector" aria-label="Close inspector" data-tooltip="Close inspector">×</button>
        </header>
        <div class="builder-inspector-scroll">
          ${selectedAsset ? `<div class="builder-asset-preview" data-asset-preview aria-label="${escapeHtml(assetTypeLabel(selectedAsset.type))} 3D preview"></div>${renderAssetForm(selectedAsset)}` : selectedCharacter ? renderCharacterForm(selectedCharacter) : ""}
          <section class="builder-section builder-utility-section">
            <div class="builder-action-grid">
              <button type="button" data-action="copy">Copy JSON</button>
              <button type="button" data-action="reset" class="builder-danger">Reset draft</button>
            </div>
          </section>
        </div>
      </aside>` : `<button class="builder-drawer-button builder-drawer-button-right builder-tooltip" type="button" data-action="expand-inspector" aria-label="Open inspector" data-tooltip="Open inspector"><span aria-hidden="true">i</span></button>`}
      <div class="builder-map-controls ${inspectorOpen ? "builder-map-controls-inspector-open" : ""}" aria-label="Map controls">
        <button class="builder-tooltip" type="button" data-action="zoom-in" aria-label="Zoom in" data-tooltip="Zoom in">+</button>
        <button class="builder-tooltip" type="button" data-action="zoom-reset" aria-label="Reset map view" data-tooltip="Reset map view"><span class="builder-target-glyph" aria-hidden="true"></span></button>
        <button class="builder-tooltip" type="button" data-action="zoom-out" aria-label="Zoom out" data-tooltip="Zoom out">-</button>
      </div>
    `;

    const refreshAssetPreview = () => {
      assetPreview?.dispose();
      assetPreview = null;
      const previewHost = shell.querySelector<HTMLElement>("[data-asset-preview]");
      const previewSource = options.createAssetPreview?.(getSelectedAsset() ?? selectedAsset!);
      if (previewHost && previewSource) assetPreview = mountAssetPreview(previewHost, previewSource);
    };

    if (selectedAsset) refreshAssetPreview();

    shell.querySelector<HTMLButtonElement>('[data-action="back-to-town"]')?.addEventListener("click", () => {
      window.location.assign("/");
    });
    shell.querySelector<HTMLButtonElement>('[data-action="collapse-palette"]')?.addEventListener("click", () => {
      paletteOpen = false;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="expand-palette"]')?.addEventListener("click", () => {
      paletteOpen = true;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="collapse-inspector"]')?.addEventListener("click", () => {
      inspectorOpen = false;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="expand-inspector"]')?.addEventListener("click", () => {
      inspectorOpen = true;
      render();
    });
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener("click", () => options.onCameraZoom?.(-7));
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener("click", () => options.onCameraZoom?.(7));
    shell.querySelector<HTMLButtonElement>('[data-action="zoom-reset"]')?.addEventListener("click", () => options.onCameraReset?.());
    shell.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => button.addEventListener("click", () => {
      paletteFilter = button.dataset.filter as AssetTileGroup;
      render();
    }));
    shell.querySelectorAll<HTMLButtonElement>("[data-select-character]").forEach((button) => button.addEventListener("click", () => {
      const [kind, id] = (button.dataset.selectCharacter ?? "player").split(":");
      selection = kind === "citizen" && id ? { kind: "citizen", id } : { kind: "player" };
      render();
    }));

    shell.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => button.addEventListener("click", () => addAsset(button.dataset.add as TownAssetType)));
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
    shell.querySelector<HTMLButtonElement>('[data-action="undo"]')?.addEventListener("click", () => restoreHistory(historyIndex - 1));
    shell.querySelector<HTMLButtonElement>('[data-action="redo"]')?.addEventListener("click", () => restoreHistory(historyIndex + 1));
    shell.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener("click", exportSchema);
    shell.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener("click", () => void navigator.clipboard?.writeText(JSON.stringify(schema, null, 2)));
    shell.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener("click", () => shell.querySelector<HTMLInputElement>('[data-field="import"]')?.click());
    shell.querySelector<HTMLInputElement>('[data-field="import"]')?.addEventListener("change", (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (file) importSchema(file);
    });
    shell.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", resetShipped);

    shell.querySelectorAll<HTMLInputElement>('[data-schema-field="asset.color"], [data-schema-field="asset.roofColor"], [data-schema-field="asset.stripeColor"]').forEach((input) => {
      input.addEventListener("input", () => {
        const selected = getSelectedAsset();
        if (!selected) return;
        applyFieldChange(input.dataset.schemaField ?? "", input.value, selected, undefined);
        notify();
        refreshAssetPreview();
      });
    });

    shell.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-schema-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.schemaField ?? "";
        const value = input instanceof HTMLInputElement && input.type === "number" ? Number(input.value) : input.value;
        commit(() => applyFieldChange(field, value, getSelectedAsset(), getSelectedCharacter()));
      });
    });
  };

  window.addEventListener("keydown", (event) => {
    if (!active) return;
    if (isEditableTarget(event.target)) return;
    if (event.key === "Escape") {
      setActive(false);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restoreHistory(event.shiftKey ? historyIndex + 1 : historyIndex - 1);
    }
  });

  root.addEventListener("builder:toggle", () => setActive(!active));
  root.classList.toggle("builder-mode", active);
  options.onActiveChange(active);
  render();

  return {
    isActive: () => active,
    selectAsset: (id) => {
      if (!schema.assets.some((asset) => asset.id === id)) return;
      selection = { kind: "asset", id };
      if (active) render();
    },
    selectCharacter: (kind, id) => {
      if (kind === "player") selection = { kind: "player" };
      else if (id && schema.citizens.some((citizen) => citizen.id === id)) selection = { kind: "citizen", id };
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
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);
  const keyLight = new THREE.DirectionalLight("#fff2cf", 2.2);
  keyLight.position.set(5, 8, 6);
  scene.add(keyLight, new THREE.HemisphereLight("#fff9e9", "#6e8260", 1.45));

  const model = source.clone(true);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  scene.add(model);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y -= bounds.min.y - center.y;

  const span = Math.max(size.x, size.y, size.z, 1);
  const target = new THREE.Vector3(0, size.y * 0.42, 0);
  camera.position.set(span * 1.45, span * 1.05, span * 1.58);
  camera.lookAt(target);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(span * 0.82, 48),
    new THREE.MeshBasicMaterial({ color: "#f1dfb6", transparent: true, opacity: 0.42, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  scene.add(floor);

  const startedAt = performance.now();
  let frame = 0;
  const draw = (now: number) => {
    model.rotation.y = (now - startedAt) * 0.00042;
    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(draw);
  };
  frame = window.requestAnimationFrame(draw);

  return {
    dispose: () => {
      window.cancelAnimationFrame(frame);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function renderAssetTiles(filter: AssetTileGroup): string {
  return ASSET_TYPES
    .filter((type) => filter === "all" || ASSET_TILE_CONFIG[type].group === filter)
    .map((type) => {
      const config = ASSET_TILE_CONFIG[type];
      return `<button type="button" class="builder-asset-tile asset-tile-${type}" data-add="${type}" title="Add ${assetTypeLabel(type)}"><span>${config.glyph}</span><small>${assetTypeLabel(type)}</small></button>`;
    })
    .join("");
}

function renderAssetForm(asset: TownAsset): string {
  const hasLabel = asset.type === "building" || asset.type === "market" || asset.type === "booth";
  const colorFields = [
    asset.color ? colorField("Color", "asset.color", asset.color) : "",
    asset.roofColor ? colorField("Roof", "asset.roofColor", asset.roofColor) : "",
    asset.stripeColor ? colorField("Stripe", "asset.stripeColor", asset.stripeColor) : "",
  ].filter(Boolean).join("");
  return `
    <section class="builder-section">
      <span class="builder-section-title">${escapeHtml(assetTypeLabel(asset.type))}</span>
      <label class="builder-field"><span>Id</span><input value="${escapeHtml(asset.id)}" disabled /></label>
      ${hasLabel ? `<label class="builder-field"><span>Label</span><input data-schema-field="asset.label" value="${escapeHtml(asset.label ?? "")}" /></label>` : ""}
      <div class="builder-field-row">
        ${numberField("X", "asset.x", asset.position[0], 0.1)}
        ${numberField("Z", "asset.z", asset.position[1], 0.1)}
      </div>
      <div class="builder-field-row">
        ${numberField("Rotation", "asset.rotation", THREE_TO_DEGREES(asset.rotation ?? 0), 5)}
        ${numberField("Scale", "asset.scale", asset.scale ?? 1, 0.05, 0.2, 3)}
      </div>
      <div class="builder-nudge" aria-label="Move selected asset">
        <span>Move</span>
        <button type="button" data-nudge="0,-0.5" aria-label="Move up" title="Move up">↑</button>
        <button type="button" data-nudge="-0.5,0" aria-label="Move left" title="Move left">←</button>
        <button type="button" data-nudge="0,0.5" aria-label="Move down" title="Move down">↓</button>
        <button type="button" data-nudge="0.5,0" aria-label="Move right" title="Move right">→</button>
      </div>
      <div class="builder-nudge builder-rotate" aria-label="Rotate selected asset">
        <span>Rotate</span>
        <button type="button" data-rotate="-15" aria-label="Rotate left 15 degrees" title="Rotate left 15 degrees">↺</button>
        <button type="button" data-rotate="15" aria-label="Rotate right 15 degrees" title="Rotate right 15 degrees">↻</button>
      </div>
      ${colorFields ? `<div class="builder-asset-color-grid">${colorFields}</div>` : ""}
      <div class="builder-action-grid builder-asset-actions">
        <button type="button" data-action="duplicate">Duplicate</button>
        <button type="button" data-action="delete" class="builder-danger">Delete</button>
      </div>
    </section>
  `;
}

function renderCharacterForm(character: CharacterSchema): string {
  const movement = character.movement;
  return `
    <section class="builder-section">
      <span class="builder-section-title">${character.kind === "player" ? "Player character" : escapeHtml(character.id)}</span>
      <label class="builder-field"><span>Hair style</span>
        <select data-schema-field="character.hairStyle">
          ${["crop", "swept", "afro", "bald"].map((style) => `<option value="${style}" ${character.appearance.hairStyle === style ? "selected" : ""}>${style}</option>`).join("")}
        </select>
      </label>
      <div class="builder-color-grid">
        ${COLOR_FIELDS.map((field) => colorField(field, `character.${field}`, character.appearance[field])).join("")}
      </div>
      ${movement ? `<div class="builder-field-row">${numberField("Walk", "character.walk", movement.walk, 0.01, 0.5, 1.5)}${numberField("Sprint", "character.sprint", movement.sprint, 0.01, 0.5, 1.5)}${numberField("Jump", "character.jump", movement.jump, 0.01, 0.5, 1.5)}</div>` : ""}
    </section>
  `;
}

function applyFieldChange(field: string, value: string | number, asset?: TownAsset, character?: CharacterSchema): void {
  if (asset) {
    if (field === "asset.x") asset.position[0] = Number(value);
    if (field === "asset.z") asset.position[1] = Number(value);
    if (field === "asset.rotation") asset.rotation = (Number(value) * Math.PI) / 180;
    if (field === "asset.scale") asset.scale = Math.min(3, Math.max(0.2, Number(value) || 1));
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
    if (character.movement) {
      if (field === "character.walk") character.movement.walk = Number(value);
      if (field === "character.sprint") character.movement.sprint = Number(value);
      if (field === "character.jump") character.movement.jump = Number(value);
    }
  }
}

function defaultCollision(type: TownAssetType): TownAsset["collision"] | undefined {
  if (type === "tree" || type === "lamp") return { kind: "circle", radius: type === "tree" ? 0.55 : 0.32 };
  if (type === "fountain" || type === "monument") return { kind: "circle", radius: type === "fountain" ? 1.75 : 1.55 };
  if (type === "waterTower") return { kind: "circle", radius: 2.35 };
  if (type === "shrub") return { kind: "circle", radius: 0.5 };
  if (type === "picnicTable") return { kind: "box", width: 1.65, depth: 1.45, top: 0.85 };
  if (type === "bench") return { kind: "box", width: 0.9, depth: 2.05, top: 1.04 };
  if (type === "fence") return { kind: "box", width: 5.1, depth: 0.35 };
  if (type === "gardenPlot") return { kind: "box", width: 1.9, depth: 1.18, top: 0.32 };
  if (type === "building") return { kind: "box", width: 4.9, depth: 4.25 };
  if (type === "market") return { kind: "box", width: 3.3, depth: 2 };
  if (type === "booth") return { kind: "box", width: 2.5, depth: 1.45 };
  return undefined;
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
  return type.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function THREE_TO_DEGREES(value: number): number {
  return (value * 180) / Math.PI;
}
