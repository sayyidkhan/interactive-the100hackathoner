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
  createCharacterPreview?: (character: CharacterSchema) => THREE.Object3D | null;
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
const COLOR_FIELDS: Array<keyof CharacterAppearance> = ["skin", "hair", "shirt", "trim", "pants", "shoes"];
const GRID_SNAP = 0.5;
const PLACEMENT_LIMIT = 28;
const ASSET_TILE_GROUPS = [
  { id: "all", label: "All" },
  { id: "places", label: "Places" },
  { id: "landmarks", label: "Landmarks" },
  { id: "nature", label: "Nature" }
] as const;
type AssetTileGroup = (typeof ASSET_TILE_GROUPS)[number]["id"];

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
  let paletteOpen = true;
  let inspectorOpen = true;
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
    if (!canPlaceAsset({ ...asset, position })) return;
    commit(() => { asset.position = position; });
  };

  const rotateAsset = (degrees: number) => {
    const asset = getSelectedAsset();
    if (!asset) return;
    const rotation = (asset.rotation ?? 0) + (degrees * Math.PI) / 180;
    const nextRotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
    if (!canPlaceAsset({ ...asset, rotation: nextRotation })) return;
    commit(() => { asset.rotation = nextRotation; });
  };

  const moveAsset = (id: string, x: number, z: number) => {
    const asset = schema.assets.find((candidate) => candidate.id === id);
    if (!asset) return;
    const position: [number, number] = [snapToGrid(x), snapToGrid(z)];
    if (!canPlaceAsset({ ...asset, position })) return;
    asset.position = position;
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

  const render = () => {
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
            <div class="builder-palette-section-heading">
              <span class="builder-section-title">Residents</span>
              <small>${schema.citizens.length + 1} active</small>
            </div>
            <div class="builder-character-grid">
              <button type="button" data-select-character="player" class="builder-character-tile ${selection.kind === "player" ? "selected" : ""}"><span class="builder-resident-mark builder-resident-player" aria-hidden="true"></span><span>Player</span></button>
              ${schema.citizens.map((citizen, index) => `<button type="button" data-select-character="citizen:${citizen.id}" class="builder-character-tile ${selection.kind === "citizen" && selection.id === citizen.id ? "selected" : ""}"><span class="builder-resident-mark builder-resident-${index % 4}" aria-hidden="true"></span><span>${escapeHtml(citizen.id.replace("citizen-", ""))}</span></button>`).join("")}
            </div>
          </section>
          <div class="builder-history-bar">
            <span>History</span>
            <div class="builder-draft-row">
              <button type="button" data-action="undo" ${historyIndex === 0 ? "disabled" : ""} aria-label="Undo last change">Undo</button>
              <button type="button" data-action="redo" ${historyIndex >= history.length - 1 ? "disabled" : ""} aria-label="Redo last change">Redo</button>
            </div>
          </div>
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
          ${selectedAsset ? `<div class="builder-asset-preview" data-selection-preview aria-label="${escapeHtml(assetTypeLabel(selectedAsset.type))} 3D preview"></div>${renderAssetForm(selectedAsset)}` : selectedCharacter ? `<div class="builder-asset-preview builder-character-preview" data-selection-preview aria-label="${escapeHtml(selectedCharacter.kind === "player" ? "Player" : selectedCharacter.id)} 3D preview"></div>${renderCharacterForm(selectedCharacter)}` : ""}
          <section class="builder-section builder-utility-section">
            <div class="builder-action-grid builder-utility-actions">
              <button type="button" data-action="reset" class="builder-danger">Reset draft</button>
            </div>
          </section>
        </div>
      </aside>` : `<button class="builder-drawer-button builder-inspector-toggle builder-tooltip" type="button" data-action="expand-inspector" aria-label="Open inspector" data-tooltip="Open inspector"><span aria-hidden="true">i</span></button>`}
      <div class="builder-map-controls ${inspectorOpen ? "builder-map-controls-inspector-open" : ""}" aria-label="Map controls">
        <button class="builder-tooltip" type="button" data-action="zoom-in" aria-label="Zoom in" data-tooltip="Zoom in">+</button>
        <button class="builder-tooltip" type="button" data-action="zoom-reset" aria-label="Reset map view" data-tooltip="Reset map view"><span class="builder-target-glyph" aria-hidden="true"></span></button>
        <button class="builder-tooltip" type="button" data-action="zoom-out" aria-label="Zoom out" data-tooltip="Zoom out">-</button>
      </div>
    `;

    const refreshSelectionPreview = () => {
      const previewHost = shell.querySelector<HTMLElement>("[data-selection-preview]");
      const previewSource = selectedAsset
        ? options.createAssetPreview?.(getSelectedAsset() ?? selectedAsset)
        : selectedCharacter
          ? options.createCharacterPreview?.(getSelectedCharacter() ?? selectedCharacter)
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

    if (active && inspectorOpen && (selectedAsset || selectedCharacter)) refreshSelectionPreview();
    else {
      selectionPreview?.dispose();
      selectionPreview = null;
    }

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
    shell.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", resetShipped);

    shell.querySelectorAll<HTMLInputElement>('[data-schema-field="asset.color"], [data-schema-field="asset.roofColor"], [data-schema-field="asset.stripeColor"], [data-schema-field^="character."][type="color"]').forEach((input) => {
      input.addEventListener("input", () => {
        const selectedAsset = getSelectedAsset();
        const selectedCharacter = getSelectedCharacter();
        if (!selectedAsset && !selectedCharacter) return;
        applyFieldChange(input.dataset.schemaField ?? "", input.value, selectedAsset, selectedCharacter, canPlaceAsset);
        notify();
        refreshSelectionPreview();
      });
    });

    shell.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-schema-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.schemaField ?? "";
        const value = input instanceof HTMLInputElement && input.type === "number" ? Number(input.value) : input.value;
        commit(() => applyFieldChange(field, value, getSelectedAsset(), getSelectedCharacter(), canPlaceAsset));
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

function renderAssetTiles(filter: AssetTileGroup): string {
  return ASSET_TYPES
    .filter((type) => filter === "all" || ASSET_TILE_CONFIG[type].group === filter)
    .map((type) => {
      return `<button type="button" class="builder-asset-tile asset-tile-${type}" data-add="${type}" title="Add ${assetTypeLabel(type)}"><img data-asset-thumbnail="${type}" alt="" aria-hidden="true" /><small>${assetTypeLabel(type)}</small></button>`;
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

function applyFieldChange(
  field: string,
  value: string | number,
  asset?: TownAsset,
  character?: CharacterSchema,
  canPlaceAsset?: (asset: TownAsset) => boolean
): boolean | void {
  if (asset) {
    const candidate: TownAsset = { ...asset, position: [...asset.position] as [number, number] };
    if (field === "asset.x") candidate.position[0] = Number(value);
    if (field === "asset.z") candidate.position[1] = Number(value);
    if (field === "asset.rotation") candidate.rotation = (Number(value) * Math.PI) / 180;
    if (field === "asset.scale") candidate.scale = Math.min(3, Math.max(0.2, Number(value) || 1));
    if (["asset.x", "asset.z", "asset.rotation", "asset.scale"].includes(field) && canPlaceAsset && !canPlaceAsset(candidate)) return false;
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
  return type.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function THREE_TO_DEGREES(value: number): number {
  return (value * 180) / Math.PI;
}
