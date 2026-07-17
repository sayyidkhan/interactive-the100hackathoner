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
import { applySceneShadows, createSoftShadow, createTownLights } from "./rendering/shadows";
import {
  addLandscapeDetails,
  addPath,
  addPathStones,
  addPerimeterWalls,
  addWaterfront,
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

type CameraLookState = {
  yaw: number;
  targetYaw: number;
  distance: number;
  targetDistance: number;
  zoomBy: (amount: number) => void;
};

type BuilderCameraState = {
  focus: THREE.Vector3;
  targetFocus: THREE.Vector3;
  height: number;
  targetHeight: number;
};

type CinematicState = {
  active: boolean;
  exiting: boolean;
  lastInteraction: number;
  startedAt: number;
  exitStartedAt: number;
  startAngle: number;
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  exitPosition: THREE.Vector3;
  exitTarget: THREE.Vector3;
};

const CAMERA_OFFSET = new THREE.Vector3(-5.8, 5.05, 8.75);
const CAMERA_DEFAULT_DISTANCE = CAMERA_OFFSET.length();
const CAMERA_MIN_DISTANCE = 9.5;
const CAMERA_MAX_DISTANCE = 20;
const NEW_DISCOVERY_CARD_DELAY_MS = 620;
const CINEMATIC_IDLE_MS = 60_000;
const CINEMATIC_TRANSITION_MS = 4_000;
const CINEMATIC_EXIT_MS = 900;
const CINEMATIC_RADIUS = 31;
const BUILDER_CAMERA_DEFAULT_HEIGHT = 54;
const BUILDER_CAMERA_MIN_HEIGHT = 22;
const BUILDER_CAMERA_MAX_HEIGHT = 88;

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
  camera.position.copy(player.position).add(CAMERA_OFFSET);
  camera.lookAt(player.position.x, 0.82, player.position.z);

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

  const townBuilder = createTownBuilder(root, {
    initialSchema: townSchema,
    shippedSchema: SHIPPED_TOWN_SCHEMA,
    startActive: dedicatedBuilderRoute,
    onSchemaChange: (nextSchema) => {
      townSchema = nextSchema;
      clearGroup(town.assetLayer);
      renderTownAssets(town.assetLayer, townSchema.assets);
      colliders = createTownColliders(townSchema);
      applyCharacterAppearance(player, townSchema.player.appearance, townSchema.player.movement);
      clearGroup(citizenLayer);
      citizens = createCitizens(citizenLayer, townSchema.citizens);
      applySceneShadows(town.assetLayer);
      applySceneShadows(citizenLayer);
    },
    onSelectionChange: (asset) => {
      if (builderActive) updateBuilderSelectionMarker(builderSelectionMarker, asset);
    },
    onAssetPositionPreview: (asset) => {
      const root = town.assetLayer.getObjectByName(`asset:${asset.id}`);
      root?.position.set(asset.position[0] * TOWN_SPREAD, 0, asset.position[1] * TOWN_SPREAD);
      if (builderActive) updateBuilderSelectionMarker(builderSelectionMarker, asset);
    },
    createAssetPreview: (asset) => town.assetLayer.getObjectByName(`asset:${asset.id}`)?.clone(true) ?? null,
    onCameraZoom: (amount) => {
      builderCamera.targetHeight = THREE.MathUtils.clamp(
        builderCamera.targetHeight + amount,
        BUILDER_CAMERA_MIN_HEIGHT,
        BUILDER_CAMERA_MAX_HEIGHT
      );
    },
    onCameraReset: () => {
      builderCamera.targetFocus.set(0, 0, 0);
      builderCamera.targetHeight = BUILDER_CAMERA_DEFAULT_HEIGHT;
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

  const cinematic: CinematicState = {
    active: false,
    exiting: false,
    lastInteraction: performance.now(),
    startedAt: 0,
    exitStartedAt: 0,
    startAngle: 0,
    startPosition: camera.position.clone(),
    startTarget: player.position.clone(),
    exitPosition: camera.position.clone(),
    exitTarget: player.position.clone()
  };

  const registerActivity = () => {
    cinematic.lastInteraction = performance.now();
    if (!cinematic.active) return;
    cinematic.active = false;
    cinematic.exiting = true;
    cinematic.exitStartedAt = performance.now();
    cinematic.exitPosition.copy(camera.position);
    camera.getWorldDirection(cinematic.exitTarget);
    cinematic.exitTarget.multiplyScalar(12).add(camera.position);
    root.classList.remove("cinematic-mode");
  };
  window.addEventListener("keydown", registerActivity, { passive: true });
  renderer.domElement.addEventListener("pointerdown", registerActivity, { passive: true });
  renderer.domElement.addEventListener("pointermove", registerActivity, { passive: true });
  renderer.domElement.addEventListener("wheel", registerActivity, { passive: true });

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

    if (!builderActive && !cinematic.active && !cinematic.exiting && !hud.isModalOpen() && !cardOpen && now - cinematic.lastInteraction >= CINEMATIC_IDLE_MS) {
      cinematic.active = true;
      cinematic.startedAt = now;
      cinematic.startPosition.copy(camera.position);
      cinematic.startTarget.set(player.position.x, 0.82, player.position.z);
      cinematic.startAngle = Math.atan2(camera.position.z, camera.position.x);
      root.classList.add("cinematic-mode");
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
      updateCinematicExit(camera, cinematic, player.position, lookState, now, root);
    } else if (waterTowerClimb.mode === "platform" && waterTowerAnchor) {
      updateWaterTowerCamera(camera, waterTowerAnchor);
    } else {
      updateCamera(camera, player.position, lookState);
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

function bindLookControls(element: HTMLCanvasElement): CameraLookState {
  const look: CameraLookState = {
    yaw: 0,
    targetYaw: 0,
    distance: CAMERA_DEFAULT_DISTANCE,
    targetDistance: CAMERA_DEFAULT_DISTANCE,
    zoomBy(amount) {
      look.targetDistance = THREE.MathUtils.clamp(look.targetDistance + amount, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
    }
  };
  let dragging = false;
  let lastX = 0;
  let pinchDistance = 0;
  const pointers = new Map<number, { x: number; y: number }>();

  const getPinchDistance = () => {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return 0;
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  element.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastX = event.clientX;
    element.setPointerCapture(event.pointerId);
    dragging = pointers.size === 1;
    if (pointers.size >= 2) {
      pinchDistance = getPinchDistance();
    }
  });

  element.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const nextPinchDistance = getPinchDistance();
      if (pinchDistance > 0) look.zoomBy((pinchDistance - nextPinchDistance) * 0.012);
      pinchDistance = nextPinchDistance;
      return;
    }
    if (!dragging) return;
    const deltaX = event.clientX - lastX;
    lastX = event.clientX;
    look.targetYaw -= deltaX * 0.006;
  });

  element.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      look.zoomBy(event.deltaY * 0.008);
    },
    { passive: false }
  );

  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    dragging = pointers.size === 1;
    if (dragging) {
      const remainingPointer = [...pointers.values()][0];
      lastX = remainingPointer.x;
    } else {
      pinchDistance = 0;
    }
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  };

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("dblclick", () => {
    look.targetYaw = 0;
    look.targetDistance = CAMERA_DEFAULT_DISTANCE;
  });

  return look;
}

function createBuilderCameraState(): BuilderCameraState {
  return {
    focus: new THREE.Vector3(0, 0, 0),
    targetFocus: new THREE.Vector3(0, 0, 0),
    height: BUILDER_CAMERA_DEFAULT_HEIGHT,
    targetHeight: BUILDER_CAMERA_DEFAULT_HEIGHT
  };
}

function bindBuilderCanvasInteractions(
  element: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  assetLayer: THREE.Group,
  isActive: () => boolean,
  builder: ReturnType<typeof createTownBuilder>,
  cameraState: BuilderCameraState
): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundPoint = new THREE.Vector3();
  let interaction:
    | { kind: "pan"; pointerId: number; x: number; y: number }
    | { kind: "asset"; pointerId: number; id: string; offsetX: number; offsetZ: number }
    | null = null;

  const getGroundPoint = (event: MouseEvent): THREE.Vector3 | null => {
    const bounds = element.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(ground, groundPoint) ? groundPoint.clone() : null;
  };

  const getAssetIdAtPointer = (event: PointerEvent): string | null => {
    const bounds = element.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(assetLayer.children, true).find((candidate) => {
      let object: THREE.Object3D | null = candidate.object;
      while (object) {
        if (typeof object.userData.schemaAssetId === "string") return true;
        object = object.parent;
      }
      return false;
    });
    if (!hit) return null;

    let object: THREE.Object3D | null = hit.object;
    while (object && typeof object.userData.schemaAssetId !== "string") object = object.parent;
    return object ? String(object.userData.schemaAssetId) : null;
  };

  element.addEventListener("pointerdown", (event) => {
    if (!isActive() || event.button !== 0) return;
    const assetId = getAssetIdAtPointer(event);
    const point = getGroundPoint(event);
    element.setPointerCapture(event.pointerId);

    if (assetId && point) {
      const asset = builder.getSchema().assets.find((candidate) => candidate.id === assetId);
      if (!asset) return;
      builder.selectAsset(assetId);
      interaction = {
        kind: "asset",
        pointerId: event.pointerId,
        id: assetId,
        offsetX: asset.position[0] * TOWN_SPREAD - point.x,
        offsetZ: asset.position[1] * TOWN_SPREAD - point.z
      };
      element.style.cursor = "grabbing";
      return;
    }

    interaction = { kind: "pan", pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    element.style.cursor = "grabbing";
  });

  element.addEventListener("pointermove", (event) => {
    if (!isActive()) return;
    if (!interaction) {
      element.style.cursor = getAssetIdAtPointer(event) ? "grab" : "default";
      return;
    }
    if (interaction.pointerId !== event.pointerId) return;

    if (interaction.kind === "asset") {
      const point = getGroundPoint(event);
      if (!point) return;
      builder.moveAsset(interaction.id, (point.x + interaction.offsetX) / TOWN_SPREAD, (point.z + interaction.offsetZ) / TOWN_SPREAD);
      return;
    }

    const worldPerPixel = cameraState.targetHeight * 0.00072;
    const worldLimit = WORLD_LIMIT * TOWN_SPREAD;
    cameraState.targetFocus.x = THREE.MathUtils.clamp(
      cameraState.targetFocus.x - (event.clientX - interaction.x) * worldPerPixel,
      -worldLimit,
      worldLimit
    );
    cameraState.targetFocus.z = THREE.MathUtils.clamp(
      cameraState.targetFocus.z - (event.clientY - interaction.y) * worldPerPixel,
      -worldLimit,
      worldLimit
    );
    interaction.x = event.clientX;
    interaction.y = event.clientY;
  });

  const finishInteraction = (event: PointerEvent) => {
    const current = interaction;
    interaction = null;
    if (current?.kind === "asset" && current.pointerId === event.pointerId) builder.commitAssetMove();
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (isActive()) element.style.cursor = "default";
  };
  element.addEventListener("pointerup", finishInteraction);
  element.addEventListener("pointercancel", finishInteraction);
  element.addEventListener(
    "wheel",
    (event) => {
      if (!isActive()) return;
      event.preventDefault();
      const cursorPoint = getGroundPoint(event);
      const previousHeight = cameraState.targetHeight;
      const nextHeight = THREE.MathUtils.clamp(
        previousHeight * Math.exp(event.deltaY * 0.0012),
        BUILDER_CAMERA_MIN_HEIGHT,
        BUILDER_CAMERA_MAX_HEIGHT
      );

      if (cursorPoint && nextHeight < previousHeight) {
        const pull = (1 - nextHeight / previousHeight) * 0.72;
        cameraState.targetFocus.lerp(cursorPoint, pull);
      }

      cameraState.targetHeight = nextHeight;
    },
    { passive: false }
  );
  element.addEventListener("dblclick", () => {
    if (!isActive()) return;
    cameraState.targetFocus.set(0, 0, 0);
    cameraState.targetHeight = BUILDER_CAMERA_DEFAULT_HEIGHT;
  });
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


function getGameplayCameraPosition(target: THREE.Vector3, look: CameraLookState): THREE.Vector3 {
  look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, 0.12);
  look.distance = THREE.MathUtils.lerp(look.distance, look.targetDistance, 0.12);
  const offset = CAMERA_OFFSET.clone().setLength(look.distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
  return new THREE.Vector3(target.x + offset.x, target.y + offset.y, target.z + offset.z);
}

function updateCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, look: CameraLookState): void {
  camera.up.set(0, 1, 0);
  const desired = getGameplayCameraPosition(target, look);
  camera.position.lerp(desired, 0.075);
  camera.lookAt(target.x, 0.82, target.z);
}

function updateBuilderCamera(camera: THREE.PerspectiveCamera, state: BuilderCameraState, delta: number): void {
  const stableDelta = Math.min(delta, 0.05);
  state.focus.x = THREE.MathUtils.damp(state.focus.x, state.targetFocus.x, 8.5, stableDelta);
  state.focus.z = THREE.MathUtils.damp(state.focus.z, state.targetFocus.z, 8.5, stableDelta);
  state.height = THREE.MathUtils.damp(state.height, state.targetHeight, 9.5, stableDelta);
  camera.up.set(0, 0, -1);
  camera.position.set(state.focus.x, state.height, state.focus.z);
  camera.lookAt(state.focus.x, 0, state.focus.z);
}

function updateWaterTowerCamera(camera: THREE.PerspectiveCamera, towerAnchor: WaterTowerAnchor): void {
  const tower = new THREE.Vector3(towerAnchor.x, towerAnchor.platformHeight, towerAnchor.z);
  const townFocus = new THREE.Vector3(-0.8, 1.15, 0.8);
  const towardTown = townFocus.clone().sub(tower).setY(0);
  if (towardTown.lengthSq() < 0.001) towardTown.set(0, 0, -1);
  towardTown.normalize();

  // Keep the tower in the foreground and frame the town as a stable lookout shot.
  const outward = towardTown.clone().multiplyScalar(-1);
  const side = new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(1.65);
  const desired = tower.clone().addScaledVector(outward, 6.5).add(side);
  desired.y += 4.25;
  const target = tower.clone().addScaledVector(towardTown, 18);
  target.y = 1.2;

  camera.position.lerp(desired, 0.065);
  camera.lookAt(target);
}

function updateCinematicExit(
  camera: THREE.PerspectiveCamera,
  state: CinematicState,
  playerPosition: THREE.Vector3,
  look: CameraLookState,
  now: number,
  root: HTMLElement
): void {
  const progress = THREE.MathUtils.smoothstep(
    Math.min((now - state.exitStartedAt) / CINEMATIC_EXIT_MS, 1),
    0,
    1
  );
  const gameplayPosition = getGameplayCameraPosition(playerPosition, look);
  const gameplayTarget = new THREE.Vector3(playerPosition.x, 0.82, playerPosition.z);
  const target = new THREE.Vector3().lerpVectors(state.exitTarget, gameplayTarget, progress);
  camera.position.lerpVectors(state.exitPosition, gameplayPosition, progress);
  camera.lookAt(target);

  if (progress >= 1) {
    state.exiting = false;
  }
}

function updateCinematicCamera(camera: THREE.PerspectiveCamera, state: CinematicState, now: number): void {
  camera.up.set(0, 1, 0);
  const elapsedSeconds = (now - state.startedAt) / 1000;
  const transition = THREE.MathUtils.smoothstep(
    Math.min((now - state.startedAt) / CINEMATIC_TRANSITION_MS, 1),
    0,
    1
  );
  const angle = state.startAngle + elapsedSeconds * 0.05;
  const orbit = new THREE.Vector3(
    Math.cos(angle) * CINEMATIC_RADIUS,
    18 + Math.sin(elapsedSeconds * 0.12) * 3,
    Math.sin(angle) * CINEMATIC_RADIUS
  );
  const target = new THREE.Vector3().lerpVectors(state.startTarget, new THREE.Vector3(0, 0.8, 0), transition);
  camera.position.lerpVectors(state.startPosition, orbit, transition);
  camera.lookAt(target);
}
