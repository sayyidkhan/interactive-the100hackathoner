import * as THREE from "three";
import { DISCOVERIES, type DiscoveryEntry } from "../data/discoveries";
import {
  TownAsset,
  TownSchema,
  SHIPPED_TOWN_SCHEMA,
  loadTownSchemaDraft
} from "../data/townSchema";
import { createInput, InputControl, setInputControl } from "../systems/input";
import { loadDiscovered, saveDiscovered } from "../systems/storage";
import { createTownBuilder } from "../ui/builder";
import { createHud } from "../ui/hud";
import {
  applyCharacterAppearance,
  applyPlayerPersona,
  createCharacterPreview as createCharacterPreviewModel,
  createCitizens,
  createPlayer,
  updateCitizens,
  updatePlayerRig
} from "./characters";
import {
  createDiscoveryMarkers,
  createRouteBreadcrumbs,
  createUnlockBurst,
  findNearestDiscovery,
  findWaypointSelection,
  type DiscoveryMarker,
  type RouteBreadcrumb,
  type UnlockBurst,
  updateMarkers,
  updateRouteBreadcrumbs,
  updateUnlockBursts
} from "./discoveries";
import {
  type CollisionShape,
  type PlayerMotion,
  updatePlayerMovement
} from "./player/movement";
import { createTownAnimals, type TownAnimal, updateTownAnimals } from "./animals";
import {
  createAtmosphere,
  createFireflies,
  createSakuraPetals,
  type AtmosphereObject,
  type Firefly,
  type SakuraPetal,
  updateAtmosphere,
  updateFireflies,
  updateSakuraPetals
} from "./atmosphere";
import { createFootballPitch, type TownBall, updateFootball } from "./football";
import {
  type WaterTowerAnchor,
  type WaterTowerClimbState,
  getWaterTowerAnchor,
  toggleWaterTowerClimb,
  updateWaterTowerClimb
} from "./interactions/waterTower";
import {
  bindLookControls,
  createCinematicState,
  initializeGameplayCamera,
  registerCinematicActivity,
  startIdleCinematic,
  updateCinematicCamera,
  updateCinematicExit,
  updateGameplayCamera,
  updateWaterTowerCamera
} from "./camera/gameplay";
import {
  bindBuilderCanvasInteractions,
  createBuilderCameraState,
  resetBuilderCamera,
  updateBuilderCamera,
  zoomBuilderCamera
} from "./camera/builder";
import { applySceneShadows, createSoftShadow, createTownLights } from "./rendering/shadows";
import {
  addLandscapeDetails,
  addPath,
  addPathStones,
  addPerimeterWalls,
  addWaterfront,
  createTownAsset,
  renderTownAssets
} from "./rendering/townAssets";
import {
  PLAYER_RADIUS,
  TOWN_SPREAD,
  WORLD_LIMIT
} from "./worldConstants";

type TownRuntime = {
  colliders: CollisionShape[];
  assetLayer: THREE.Group;
};

const NEW_DISCOVERY_CARD_DELAY_MS = 620;

type LoopTownOptions = {
  initialBuilder?: boolean;
};

export function initLoopTown(root: HTMLElement, options: LoopTownOptions = {}): void {
  root.className = "game-root";
  const dedicatedBuilderRoute = options.initialBuilder || window.location.pathname === "/local-builder";
  root.classList.toggle("local-builder-route", dedicatedBuilderRoute);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4ecdd");
  scene.fog = new THREE.Fog("#f4ecdd", 46, 96);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 130);
  camera.position.set(9, 7, 10);
  camera.lookAt(0, 0, 0);
  const lookState = bindLookControls(renderer.domElement);
  let builderActive = dedicatedBuilderRoute;
  const builderCamera = createBuilderCameraState();

  const clock = new THREE.Clock();
  const input = createInput();
  const discovered = loadDiscovered();

  let townSchema = loadTownSchemaDraft();
  const player = createPlayer();
  applyCharacterAppearance(player, townSchema.player.appearance, townSchema.player.movement);
  const playerMotion: PlayerMotion = { verticalVelocity: 0, grounded: true, facingAngle: 0, walkTime: 0 };
  player.position.set(1, 0, 2);
  player.rotation.y = 0;
  scene.add(player);
  initializeGameplayCamera(camera, player.position);

  let selectedWaypointId: string | null = null;
  const hud = createHud(root, {
    onPersonaChange: (persona) => {
      applyPlayerPersona(player, persona);
      root.dataset.playerPersona = persona.id;
      root.dataset.personaTrait = persona.trait;
      root.dataset.personaWalk = persona.movement.walk.toFixed(2);
      root.dataset.personaSprint = persona.movement.sprint.toFixed(2);
      root.dataset.personaJump = persona.movement.jump.toFixed(2);
    },
    onWaypointSelect: (entry) => {
      selectedWaypointId = entry.id;
      root.dataset.trackedDiscovery = entry.id;
    },
    onCameraZoom: (amount) => {
      lookState.zoomBy(amount);
    },
    onBuilderToggle: () => {
      if (dedicatedBuilderRoute) {
        root.dispatchEvent(new Event("builder:toggle"));
      } else {
        window.location.assign("/local-builder");
      }
    }
  });
  bindVirtualControls(root, input);
  hud.setProgress(discovered);

  createTownLights(scene);
  const town = createTown(scene, townSchema);
  const builderSelectionMarker = createBuilderSelectionMarker(scene);
  const builderGrid = createBuilderGrid(scene);
  let colliders = town.colliders;
  const waterTowerClimb: WaterTowerClimbState = { mode: "ground" };
  const football = createFootballPitch(scene);
  const markers = createDiscoveryMarkers(scene);
  const routeBreadcrumbs = createRouteBreadcrumbs(scene);
  const citizenLayer = new THREE.Group();
  citizenLayer.name = "town-schema-citizens";
  scene.add(citizenLayer);
  let citizens = createCitizens(citizenLayer, townSchema.citizens);
  const atmosphere = createAtmosphere(scene);
  const animals = createTownAnimals(scene);
  const sakuraPetals = createSakuraPetals(scene);
  const fireflies = createFireflies(scene);
  const unlockBursts: UnlockBurst[] = [];
  applySceneShadows(scene);

  let pendingTownSchema: TownSchema | null = null;
  let schemaUpdateFrame: number | undefined;
  const applyTownSchema = (nextSchema: TownSchema) => {
    clearGroup(town.assetLayer);
    renderTownAssets(town.assetLayer, nextSchema.assets);
    colliders = createTownColliders(nextSchema);
    applyCharacterAppearance(player, nextSchema.player.appearance, nextSchema.player.movement);
    clearGroup(citizenLayer);
    citizens = createCitizens(citizenLayer, nextSchema.citizens);
    applySceneShadows(town.assetLayer);
    applySceneShadows(citizenLayer);
  };
  const scheduleTownSchemaUpdate = (nextSchema: TownSchema) => {
    townSchema = nextSchema;
    pendingTownSchema = nextSchema;
    if (schemaUpdateFrame !== undefined) return;
    schemaUpdateFrame = window.requestAnimationFrame(() => {
      schemaUpdateFrame = undefined;
      const schemaToApply = pendingTownSchema;
      pendingTownSchema = null;
      if (schemaToApply) applyTownSchema(schemaToApply);
    });
  };

  const townBuilder = createTownBuilder(root, {
    initialSchema: townSchema,
    shippedSchema: SHIPPED_TOWN_SCHEMA,
    startActive: dedicatedBuilderRoute,
    onSchemaChange: scheduleTownSchemaUpdate,
    onSelectionChange: (asset) => {
      if (builderActive) updateBuilderSelectionMarker(builderSelectionMarker, asset);
    },
    onAssetPositionPreview: (asset) => {
      const root = town.assetLayer.getObjectByName(`asset:${asset.id}`);
      root?.position.set(asset.position[0] * TOWN_SPREAD, 0, asset.position[1] * TOWN_SPREAD);
      if (builderActive) updateBuilderSelectionMarker(builderSelectionMarker, asset);
    },
    createAssetPreview: createTownAsset,
    createCharacterPreview: (character) => createCharacterPreviewModel(character),
    onCameraZoom: (amount) => {
      zoomBuilderCamera(builderCamera, amount);
    },
    onCameraReset: () => {
      resetBuilderCamera(builderCamera);
    },
    onActiveChange: (active) => {
      builderActive = active;
      builderGrid.visible = active;
      if (!active) {
        builderSelectionMarker.visible = false;
        return;
      }
      input.forward = false;
      input.backward = false;
      input.left = false;
      input.right = false;
      input.moveX = 0;
      input.moveY = 0;
      input.sprint = false;
      input.jumpRequested = false;
      input.inspectRequested = false;
    }
  });
  bindBuilderCanvasInteractions(renderer.domElement, camera, town.assetLayer, () => builderActive, townBuilder, builderCamera);

  const cinematic = createCinematicState(camera, player.position);
  registerCinematicActivity(root, renderer.domElement, camera, cinematic);

  let nearest: DiscoveryEntry | null = null;
  let waypointMarker: DiscoveryMarker | null = null;
  let waypointTracked = false;
  let cardOpen = false;
  let pendingCardTimer: number | undefined;
  let started = true;

  const resize = () => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height);

    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", resize);
  resize();

  const animate = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    if (!builderActive && !hud.isModalOpen() && !cardOpen) {
      startIdleCinematic(camera, player.position, cinematic, now, root);
    }

    if (builderActive) {
      input.jumpRequested = false;
      input.inspectRequested = false;
    }

    const waterTowerAnchor = getWaterTowerAnchor(townSchema);

    if (!builderActive && input.jumpRequested && nearest) {
      input.jumpRequested = false;
      input.inspectRequested = true;
    }

    if (!builderActive && input.inspectRequested && toggleWaterTowerClimb(player, playerMotion, waterTowerClimb, waterTowerAnchor)) {
      input.inspectRequested = false;
    }

    if (started && !builderActive && !cinematic.active && !hud.isModalOpen() && !cardOpen) {
      const climbing = updateWaterTowerClimb(
        player,
        playerMotion,
        waterTowerClimb,
        delta,
        waterTowerAnchor,
        updatePlayerRig
      );
      if (!climbing) updatePlayerMovement(player, playerMotion, input, delta, colliders, camera, updatePlayerRig);
      nearest = findNearestDiscovery(player.position, markers);
      hud.setPrompt(nearest);
      if (selectedWaypointId && discovered.has(selectedWaypointId)) {
        selectedWaypointId = null;
        delete root.dataset.trackedDiscovery;
      }
      const waypoint = findWaypointSelection(player.position, markers, discovered, selectedWaypointId);
      waypointMarker = waypoint?.marker ?? null;
      waypointTracked = waypoint?.tracked ?? false;
      hud.setWaypoint(waypoint?.marker.entry ?? null, waypoint?.distance, waypoint?.heading, waypoint?.tracked);
    }

    if (!builderActive && input.inspectRequested) {
      input.inspectRequested = false;
      if (cardOpen) {
        if (pendingCardTimer !== undefined) {
          window.clearTimeout(pendingCardTimer);
          pendingCardTimer = undefined;
        } else {
          hud.closeCard();
        }
        cardOpen = false;
      } else if (hud.isModalOpen()) {
        hud.closeCard();
      } else if (nearest) {
        const savedEntry = nearest;
        const wasNewDiscovery = !discovered.has(nearest.id);
        discovered.add(nearest.id);
        if (selectedWaypointId === nearest.id) {
          selectedWaypointId = null;
          delete root.dataset.trackedDiscovery;
        }
        saveDiscovered(discovered);
        hud.setProgress(discovered);
        hud.setPrompt(savedEntry);
        const nextWaypoint = findWaypointSelection(player.position, markers, discovered, selectedWaypointId);
        waypointMarker = nextWaypoint?.marker ?? null;
        waypointTracked = nextWaypoint?.tracked ?? false;
        hud.setWaypoint(nextWaypoint?.marker.entry ?? null, nextWaypoint?.distance, nextWaypoint?.heading, nextWaypoint?.tracked);
        if (wasNewDiscovery) {
          const savedMarker = markers.find((marker) => marker.entry.id === savedEntry.id);
          if (savedMarker) {
            unlockBursts.push(createUnlockBurst(scene, savedMarker, clock.elapsedTime));
          }
          hud.showDiscoveryToast(nearest, discovered.size);
        }
        cardOpen = true;
        const openSavedCard = () => hud.openCard(savedEntry, () => {
          cardOpen = false;
        });
        if (wasNewDiscovery) {
          pendingCardTimer = window.setTimeout(() => {
            pendingCardTimer = undefined;
            openSavedCard();
          }, NEW_DISCOVERY_CARD_DELAY_MS);
        } else {
          openSavedCard();
        }
      }
    }

    updateRouteBreadcrumbs(
      routeBreadcrumbs,
      player.position,
      waypointTracked ? waypointMarker : null,
      clock.elapsedTime,
      waypointTracked
    );
    updateMarkers(markers, discovered, clock.elapsedTime, waypointMarker?.entry.id ?? null, waypointTracked, player.position);
    updateUnlockBursts(scene, unlockBursts, clock.elapsedTime);
    updateCitizens(citizens, clock.elapsedTime, player.position);
    if (updateFootball(football, player, delta)) {
      hud.showGoalToast();
    }
    updateAtmosphere(atmosphere, delta);
    updateTownAnimals(animals, clock.elapsedTime, delta);
    updateSakuraPetals(sakuraPetals, clock.elapsedTime);
    updateFireflies(fireflies, clock.elapsedTime);
    if (builderActive) {
      updateBuilderCamera(camera, builderCamera, delta);
    } else if (cinematic.active) {
      updateCinematicCamera(camera, cinematic, now);
    } else if (cinematic.exiting) {
      updateCinematicExit(camera, cinematic, player.position, lookState, now);
    } else if (waterTowerClimb.mode === "platform" && waterTowerAnchor) {
      updateWaterTowerCamera(camera, waterTowerAnchor);
    } else {
      updateGameplayCamera(camera, player.position, lookState);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
}

function createTown(scene: THREE.Scene, schema: TownSchema): TownRuntime {
  addWaterfront(scene);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(72, 72),
    new THREE.MeshStandardMaterial({ color: "#a9bd8f", roughness: 0.82 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.005;
  ground.receiveShadow = true;
  scene.add(ground);
  addLandscapeDetails(scene);
  addPerimeterWalls(scene);

  addPath(scene, 0, 0, 58, 4.6, 0);
  addPath(scene, 0, 0, 4.6, 58, 0);
  addPath(scene, 0, -12.4, 34, 3.2, 0);
  addPath(scene, 1.5, 7.3, 39, 3.2, 0);
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 56),
    new THREE.MeshStandardMaterial({ color: "#dfc49a", roughness: 0.74 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.018;
  plaza.receiveShadow = true;
  scene.add(plaza);
  addPathStones(scene);

  const townObjectsStart = scene.children.length;
  const assetLayer = new THREE.Group();
  assetLayer.name = "town-schema-assets";
  scene.add(assetLayer);
  renderTownAssets(assetLayer, schema.assets);

  for (const object of scene.children.slice(townObjectsStart)) {
    if (object === assetLayer) continue;
    object.position.x *= TOWN_SPREAD;
    object.position.z *= TOWN_SPREAD;
  }

  return { colliders: createTownColliders(schema), assetLayer };
}


function createBuilderSelectionMarker(scene: THREE.Scene): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.74, 0.92, 40),
    new THREE.MeshBasicMaterial({
      color: "#f1b936",
      transparent: true,
      opacity: 0.88,
      depthTest: false
    })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.19;
  marker.visible = false;
  marker.renderOrder = 4;
  scene.add(marker);
  return marker;
}

function createBuilderGrid(scene: THREE.Scene): THREE.GridHelper {
  const size = WORLD_LIMIT * 2 * TOWN_SPREAD;
  const divisions = Math.round(size / (0.5 * TOWN_SPREAD));
  const grid = new THREE.GridHelper(size, divisions, "#81906f", "#bdc89f");
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];

  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.52;
    material.depthWrite = false;
  });

  grid.position.y = 0.035;
  grid.visible = false;
  scene.add(grid);
  return grid;
}

function updateBuilderSelectionMarker(marker: THREE.Mesh, asset: TownAsset | null): void {
  if (!asset) {
    marker.visible = false;
    return;
  }

  const collision = asset.collision;
  const baseRadius = collision?.kind === "circle"
    ? collision.radius
    : collision?.kind === "box"
      ? Math.max(collision.width, collision.depth) * 0.52
      : 0.85;
  const scale = Math.max(0.95, baseRadius * (asset.scale ?? 1) * 1.16);
  marker.position.set(asset.position[0] * TOWN_SPREAD, 0.19, asset.position[1] * TOWN_SPREAD);
  marker.scale.setScalar(scale);
  marker.visible = true;
}

function clearGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  group.clear();
}

function createTownColliders(schema: TownSchema): CollisionShape[] {
  const colliders: CollisionShape[] = [];

  const addBox = (x: number, z: number, width: number, depth: number, top?: number) => {
    colliders.push({ kind: "box", x: x * TOWN_SPREAD, z: z * TOWN_SPREAD, width, depth, top });
  };
  const addCircle = (x: number, z: number, radius: number, top?: number) => {
    colliders.push({ kind: "circle", x: x * TOWN_SPREAD, z: z * TOWN_SPREAD, radius, top });
  };

  for (const asset of schema.assets) {
    if (!asset.collision) continue;
    const [x, z] = asset.position;
    const scale = asset.scale ?? 1;
    const top = asset.collision.top === undefined ? undefined : asset.collision.top * scale;
    if (asset.collision.kind === "box") {
      addBox(x, z, asset.collision.width * scale, asset.collision.depth * scale, top);
    } else {
      addCircle(x, z, asset.collision.radius * scale, top);
    }
  }

  addBox(-5.1, -2.5, 0.9, 2.05, 1.04);
  addBox(4.9, -2.7, 0.9, 2.05, 1.04);
  addBox(2.3, 6.4, 1.95, 0.9, 1.04);
  addBox(9.4, 7.2, 5.1, 0.35);
  addBox(-9.5, 9.2, 4.7, 0.35);
  addBox(-13.4, 2.5, 1.9, 1.18, 0.32);
  addBox(6.5, 11.7, 1.9, 1.18, 0.32);

  for (const [x, z] of [
    [-12.2, 8.1],
    [6.7, -2.4],
    [9.2, 2.65]
  ] as const) {
    addCircle(x, z, 1.02, 0.45);
  }

  for (const [x, z, radius, top] of [
    [-12.4, -5.4, 0.55, 0.42],
    [11.4, -8.2, 0.48, 0.36],
    [12.4, 5.8, 0.58, 0.46]
  ] as const) {
    addCircle(x, z, radius, top);
  }

  return colliders;
}


function bindVirtualControls(root: HTMLElement, input: ReturnType<typeof createInput>): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-control]");

  for (const button of buttons) {
    const control = button.dataset.control as InputControl | undefined;
    if (!control) continue;

    const setActive = (active: boolean) => {
      setInputControl(input, control, active);
      button.classList.toggle("active", active);
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setActive(true);
    });
    button.addEventListener("pointerup", () => setActive(false));
    button.addEventListener("pointerleave", () => setActive(false));
    button.addEventListener("click", () => {
      if (control === "jump" || control === "inspect") setInputControl(input, control, true);
    });
  }

  const joystick = root.querySelector<HTMLElement>("[data-joystick]");
  const knob = joystick?.querySelector<HTMLElement>(".joystick-knob");
  if (!joystick || !knob) return;

  let activePointerId: number | null = null;

  const updateJoystick = (event: PointerEvent) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.3;
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    input.moveX = x / radius;
    input.moveY = -y / radius;
    knob.style.transform = `translate(${x}px, ${y}px)`;
  };

  const releaseJoystick = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    input.moveX = 0;
    input.moveY = 0;
    knob.style.transform = "translate(0, 0)";
    joystick.classList.remove("active");
    if (joystick.hasPointerCapture(event.pointerId)) joystick.releasePointerCapture(event.pointerId);
    activePointerId = null;
  };

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    joystick.classList.add("active");
    updateJoystick(event);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (activePointerId === event.pointerId) updateJoystick(event);
  });
  joystick.addEventListener("pointerup", releaseJoystick);
  joystick.addEventListener("pointercancel", releaseJoystick);
}
