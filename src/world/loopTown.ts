import * as THREE from "three";
import { DISCOVERIES, DiscoveryEntry } from "../data/discoveries";
import { createInput, InputControl, setInputControl } from "../systems/input";
import { loadDiscovered, saveDiscovered } from "../systems/storage";
import { createHud, PersonaOption } from "../ui/hud";

type DiscoveryMarker = {
  entry: DiscoveryEntry;
  object: THREE.Object3D;
  plinth: THREE.Mesh;
  plinthMaterial: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  halo: THREE.Mesh;
  badge: THREE.Sprite;
  savedSeal: THREE.Sprite;
  beacon: THREE.Mesh;
  callout: THREE.Sprite;
  calloutMaterial: THREE.SpriteMaterial;
  calloutNextTexture: THREE.CanvasTexture;
  calloutTrackedTexture: THREE.CanvasTexture;
};

type PlayerMotion = {
  verticalVelocity: number;
  grounded: boolean;
  facingAngle: number;
  walkTime: number;
};

type WaterTowerClimbState = {
  mode: "ground" | "ascending" | "platform" | "descending";
};

type PlayerRig = {
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  torso: THREE.Object3D;
  shadow: THREE.Object3D;
  personaAura?: THREE.Mesh;
  personaAuraMaterial?: THREE.MeshBasicMaterial;
  trailDots?: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    phase: number;
  }>;
  shirtMaterial?: THREE.MeshStandardMaterial;
  trimMaterial?: THREE.MeshStandardMaterial;
  pantsMaterial?: THREE.MeshStandardMaterial;
  shoeMaterial?: THREE.MeshStandardMaterial;
  hairMaterial?: THREE.MeshStandardMaterial;
};

type CameraLookState = {
  yaw: number;
  targetYaw: number;
  distance: number;
  targetDistance: number;
  zoomBy: (amount: number) => void;
};

type AtmosphereObject = {
  object: THREE.Object3D;
  speed: number;
};

type TownAnimal = {
  object: THREE.Group;
  waypoints: THREE.Vector3[];
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  phase: number;
  bob: number;
  nextDecision: number;
};

type TownBall = {
  object: THREE.Mesh;
  velocity: THREE.Vector3;
  lastPlayerPosition: THREE.Vector3;
  center: THREE.Vector3;
  halfWidth: number;
  halfDepth: number;
  goalHalfWidth: number;
  goalNetDepth: number;
  radius: number;
  goalCooldown: number;
};

type SakuraPetal = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  origin: THREE.Vector3;
  phase: number;
  drift: number;
  fallSpeed: number;
};

type Firefly = {
  sprite: THREE.Sprite;
  origin: THREE.Vector3;
  phase: number;
  radius: number;
  speed: number;
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

type Citizen = {
  object: THREE.Group;
  origin: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  speechMaterial: THREE.SpriteMaterial;
};

type RouteBreadcrumb = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  rail: THREE.Mesh;
  railMaterial: THREE.MeshBasicMaterial;
  phase: number;
};

type UnlockBurst = {
  group: THREE.Group;
  startedAt: number;
  rings: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
  }>;
  sparks: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    angle: number;
    radius: number;
    height: number;
  }>;
};

type CollisionShape =
  | { kind: "box"; x: number; z: number; width: number; depth: number; top?: number }
  | { kind: "circle"; x: number; z: number; radius: number; top?: number };

const TOWN_SPREAD = 1.45;
const WORLD_LIMIT = 27;
const INSPECT_RADIUS = 2.35;
const GRAVITY = 18;
const JUMP_VELOCITY = 7.4;
const SHADOW_Y = 0.026;
const PLAYER_RADIUS = 0.42;
const PLAYER_STEP_HEIGHT = 0.48;
const SURFACE_CLEARANCE = 0.06;
const WATER_TOWER_LOCATION = { x: -14, z: 11 } as const;
const WATER_TOWER_PLATFORM_RADIUS = 2.55;
const WATER_TOWER_LADDER_Z_OFFSET = -2.02;
const WATER_TOWER_PLATFORM_HEIGHT = 4.82;
const CAMERA_OFFSET = new THREE.Vector3(-5.8, 5.05, 8.75);
const CAMERA_DEFAULT_DISTANCE = CAMERA_OFFSET.length();
const CAMERA_MIN_DISTANCE = 9.5;
const CAMERA_MAX_DISTANCE = 20;
const UNLOCK_BURST_DURATION = 1.45;
const NEW_DISCOVERY_CARD_DELAY_MS = 620;
const CINEMATIC_IDLE_MS = 60_000;
const CINEMATIC_TRANSITION_MS = 4_000;
const CINEMATIC_EXIT_MS = 900;
const CINEMATIC_RADIUS = 31;

let softShadowTexture: THREE.CanvasTexture | null = null;

export function initLoopTown(root: HTMLElement): void {
  root.className = "game-root";

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

  const clock = new THREE.Clock();
  const input = createInput();
  const discovered = loadDiscovered();

  const player = createPlayer();
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
    }
  });
  bindVirtualControls(root, input);
  hud.setProgress(discovered);

  createLights(scene);
  const colliders = createTown(scene);
  const waterTowerClimb: WaterTowerClimbState = { mode: "ground" };
  const football = createFootballPitch(scene);
  const markers = createDiscoveryMarkers(scene);
  const routeBreadcrumbs = createRouteBreadcrumbs(scene);
  const citizens = createCitizens(scene);
  const atmosphere = createAtmosphere(scene);
  const animals = createTownAnimals(scene);
  const sakuraPetals = createSakuraPetals(scene);
  const fireflies = createFireflies(scene);
  const unlockBursts: UnlockBurst[] = [];
  applySceneShadows(scene);

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

    if (!cinematic.active && !cinematic.exiting && !hud.isModalOpen() && !cardOpen && now - cinematic.lastInteraction >= CINEMATIC_IDLE_MS) {
      cinematic.active = true;
      cinematic.startedAt = now;
      cinematic.startPosition.copy(camera.position);
      cinematic.startTarget.set(player.position.x, 0.82, player.position.z);
      cinematic.startAngle = Math.atan2(camera.position.z, camera.position.x);
      root.classList.add("cinematic-mode");
    }

    if (input.jumpRequested && nearest) {
      input.jumpRequested = false;
      input.inspectRequested = true;
    }

    if (input.inspectRequested && toggleWaterTowerClimb(player, playerMotion, waterTowerClimb)) {
      input.inspectRequested = false;
    }

    if (started && !cinematic.active && !hud.isModalOpen() && !cardOpen) {
      const climbing = updateWaterTowerClimb(player, playerMotion, waterTowerClimb, delta);
      if (!climbing) updatePlayer(player, playerMotion, input, delta, colliders, camera);
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

    if (input.inspectRequested) {
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
    if (cinematic.active) {
      updateCinematicCamera(camera, cinematic, now);
    } else if (cinematic.exiting) {
      updateCinematicExit(camera, cinematic, player.position, lookState, now, root);
    } else if (waterTowerClimb.mode === "platform") {
      updateWaterTowerCamera(camera, lookState);
    } else {
      updateCamera(camera, player.position, lookState);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
}

function createLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#fff9ed", "#8b9d77", 0.96));

  const sun = new THREE.DirectionalLight("#fff1d5", 2.25);
  sun.position.set(-25, 32, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 92;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#dce9e4", 0.42);
  fill.position.set(26, 18, -22);
  scene.add(fill);
}

function getSoftShadowTexture(): THREE.CanvasTexture {
  if (softShadowTexture) return softShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create shadow canvas");

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(30, 39, 25, 0.5)");
  gradient.addColorStop(0.46, "rgba(30, 39, 25, 0.2)");
  gradient.addColorStop(0.78, "rgba(30, 39, 25, 0.05)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  softShadowTexture = new THREE.CanvasTexture(canvas);
  softShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return softShadowTexture;
}

function createSoftShadow(width: number, depth: number, opacity: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#46513a",
      map: getSoftShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width, depth, 1);
  shadow.renderOrder = 1;
  shadow.userData.softShadow = true;
  return shadow;
}

function addSoftShadow(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  opacity: number
): THREE.Mesh {
  const shadow = createSoftShadow(width, depth, opacity);
  shadow.position.set(x, SHADOW_Y, z);
  shadow.rotation.z = rotation;
  parent.add(shadow);
  return shadow;
}

function makeDarkerMaterial(
  color: string,
  amount = 0.82,
  side: THREE.Side = THREE.FrontSide
): THREE.MeshStandardMaterial {
  const shaded = new THREE.Color(color);
  shaded.lerp(new THREE.Color("#5f6258"), THREE.MathUtils.clamp(1 - amount, 0.08, 0.28));
  return new THREE.MeshStandardMaterial({ color: shaded, roughness: 0.78, side });
}

function createGable(width: number, rise: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(width / 2, 0);
  shape.lineTo(-width / 2, 0);
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}

function applySceneShadows(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const isSpriteLike = material instanceof THREE.SpriteMaterial;
    const isEmissiveGlow =
      material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0.7;
    const isTransparent = Boolean(material?.transparent);
    const isFlatReceiver = object.geometry.type === "PlaneGeometry" || object.geometry.type === "CircleGeometry";
    const isSoftShadow = Boolean(object.userData.softShadow);

    object.castShadow = !isSpriteLike && !isEmissiveGlow && !isTransparent && !isFlatReceiver && !isSoftShadow;
    object.receiveShadow = !isSpriteLike && !isEmissiveGlow && !isSoftShadow;
  });
}

function createTown(scene: THREE.Scene): CollisionShape[] {
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

  addBuilding(scene, "AI Agents Lab", -8, -7, "#88aaa2", "#5f817a");
  addBuilding(scene, "SaaS Studio", 8, -6, "#d3a08c", "#a96f63");
  addBuilding(scene, "Sustainability Garden", 12, 7.8, "#95ae83", "#6b8563");
  addBuilding(scene, "Crypto Alley", -9, 7, "#929eae", "#6c7787");
  addBuilding(scene, "Founder School", -1.5, 13.1, "#cfb889", "#9d835c");
  addBuilding(scene, "Winners Hall", 0, -11, "#bc967c", "#896957");
  addMarket(scene, "Devtools", 12, 1, "#d9bd7b");
  addMarketLawn(scene, 7.4, 2.85);
  addMarketBooth(scene, 7.4, 2.85, "Idea Exchange", "#d5745c", "#f2d583");
  addMarketBooth(scene, -4.9, -7.3, "Demo Bar", "#5f8f83", "#f2ead8");
  addParcelCart(scene, 5.2, -7.4, -0.18);
  addCommunityBoard(scene, -6.4, 4.1, 0.08);
  addTownWelcomeSign(scene, -10.8, -1.8);

  addFountain(scene, 0, 0);
  addLoopMonument(scene, -2.85, 2.15);
  addDistrictProps(scene);
  addWaterTower(scene, WATER_TOWER_LOCATION.x, WATER_TOWER_LOCATION.z);
  addTrees(scene);
  addLamp(scene, -3.5, -2.5);
  addLamp(scene, 4, 3.5);
  addLamp(scene, 7.2, -1.8);
  addLamp(scene, -2, 7.8);

  for (const object of scene.children.slice(townObjectsStart)) {
    object.position.x *= TOWN_SPREAD;
    object.position.z *= TOWN_SPREAD;
  }

  return createTownColliders();
}

function createTownColliders(): CollisionShape[] {
  const colliders: CollisionShape[] = [];

  const addBox = (x: number, z: number, width: number, depth: number, top?: number) => {
    colliders.push({ kind: "box", x: x * TOWN_SPREAD, z: z * TOWN_SPREAD, width, depth, top });
  };
  const addCircle = (x: number, z: number, radius: number, top?: number) => {
    colliders.push({ kind: "circle", x: x * TOWN_SPREAD, z: z * TOWN_SPREAD, radius, top });
  };

  for (const [x, z] of [
    [-8, -7],
    [8, -6],
    [12, 7.8],
    [-9, 7],
    [-1.5, 13.1],
    [0, -11]
  ] as const) {
    addBox(x, z, 4.9, 4.25);
  }

  addBox(12, 1, 3.3, 2);
  addCircle(0, 0, 1.75, 0.45);
  addCircle(-2.85, 2.15, 1.55, 0.42);

  for (const [x, z] of [
    [-13, -8],
    [-12, 8],
    [13, -9],
    [13, 8],
    [5, 12],
    [-6, 12],
    [-15.2, -4.1],
    [-5, -12],
    [5.5, -12],
    [13.5, 0.5],
    [-1.2, 13],
    [10.8, 10.5]
  ] as const) {
    addCircle(x, z, 0.55);
  }

  for (const [x, z] of [
    [-3.5, -2.5],
    [4, 3.5],
    [7.2, -1.8],
    [-2, 7.8]
  ] as const) {
    addCircle(x, z, 0.32);
  }

  addBox(-5.1, -2.5, 0.9, 2.05, 1.04);
  addBox(4.9, -2.7, 0.9, 2.05, 1.04);
  addBox(2.3, 6.4, 1.95, 0.9, 1.04);
  addBox(9.4, 7.2, 5.1, 0.35);
  addBox(-9.5, 9.2, 4.7, 0.35);
  addBox(7.4, 2.85, 2.5, 1.45);
  addBox(-4.9, -7.3, 2.5, 1.45);
  addBox(5.2, -7.4, 1.5, 0.9, 1.08);
  addBox(-6.4, 4.1, 1.8, 0.35);
  addBox(-9.2, -7, 4.1, 0.55);
  addCircle(WATER_TOWER_LOCATION.x, WATER_TOWER_LOCATION.z, WATER_TOWER_PLATFORM_RADIUS, WATER_TOWER_PLATFORM_HEIGHT);
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

function addWaterfront(scene: THREE.Scene): void {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 18),
    new THREE.MeshStandardMaterial({
      color: "#52aac0",
      roughness: 0.35,
      metalness: 0.05
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-8, -0.02, 31);
  scene.add(water);

  for (let i = 0; i < 26; i += 1) {
    addRock(scene, -31 + i * 2.45, 22.2 + Math.sin(i) * 0.85, 0.45 + (i % 3) * 0.12);
  }
}

function addPerimeterWalls(scene: THREE.Scene): void {
  const boundary = 35;
  const wallHeight = 3.25;
  const wallThickness = 1.45;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#456d43",
    emissive: "#29472d",
    emissiveIntensity: 0.18,
    roughness: 0.96
  });
  const capMaterial = new THREE.MeshStandardMaterial({ color: "#5d8954", roughness: 0.94 });
  const wallSpecs = [
    { x: 0, z: -boundary, width: 72, depth: wallThickness },
    { x: 0, z: boundary, width: 72, depth: wallThickness },
    { x: -boundary, z: 0, width: wallThickness, depth: 72 },
    { x: boundary, z: 0, width: wallThickness, depth: 72 }
  ];

  for (const spec of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(spec.width, wallHeight, spec.depth), wallMaterial);
    wall.position.set(spec.x, wallHeight / 2, spec.z);
    wall.castShadow = false;
    wall.receiveShadow = true;
    scene.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.18, 0.48, spec.depth + 0.18), capMaterial);
    cap.position.set(spec.x, wallHeight + 0.12, spec.z);
    cap.castShadow = false;
    cap.receiveShadow = true;
    scene.add(cap);
  }
}

function addLandscapeDetails(scene: THREE.Scene): void {
  const lawnMaterials = [
    new THREE.MeshStandardMaterial({ color: "#b5c98d", roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: "#b0c486", roughness: 0.98 })
  ];
  const patches = [
    [-23, -19, 6.8, 0.82, 0.15, 0],
    [21, -18, 7.4, 0.76, -0.18, 1],
    [-23, 11, 7.1, 0.84, 0.34, 1],
    [22, 11, 7.7, 0.78, -0.28, 0],
    [0, 20, 8.6, 0.7, 0.08, 0]
  ] as const;

  for (const [x, z, radius, stretch, rotation, materialIndex] of patches) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), lawnMaterials[materialIndex]);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rotation;
    patch.scale.set(1, stretch, 1);
    patch.position.set(x, 0.008, z);
    patch.receiveShadow = true;
    scene.add(patch);
  }
}

function createAtmosphere(scene: THREE.Scene): AtmosphereObject[] {
  const atmosphere: AtmosphereObject[] = [];

  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: "#fff8e7",
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });

  for (const [x, y, z, scale, speed] of [
    [-28, 9.2, -29, 1.05, 0.24],
    [-9, 10.4, -34, 1.4, 0.18],
    [13, 9.8, -30, 0.92, 0.2],
    [29, 10.8, -12, 1.18, 0.16]
  ] as const) {
    const cloud = createCloud(cloudMaterial.clone(), scale);
    cloud.position.set(x, y, z);
    scene.add(cloud);
    atmosphere.push({ object: cloud, speed });
  }

  return atmosphere;
}

function createTownAnimals(scene: THREE.Scene): TownAnimal[] {
  const scaleWaypoints = (points: Array<[number, number]>) =>
    points.map(([x, z]) => new THREE.Vector3(x * TOWN_SPREAD, 0, z * TOWN_SPREAD));
  const specs = [
    {
      object: createGoose(),
      waypoints: scaleWaypoints([[2.8, 3.3], [5.4, 2.8], [7.1, 4.5], [5.8, 6.2], [2.6, 6.1], [1.7, 4.5], [4.2, 5.1]]),
      speed: 0.72,
      phase: 0.2,
      bob: 0.025,
      nextDecision: 0
    },
    {
      object: createCorgi(),
      waypoints: scaleWaypoints([[-6.6, -2.8], [-4.3, -5.7], [-0.8, -6.2], [2.7, -4.2], [3.4, -1.7], [-1.8, -2.6], [-5.1, -1.1], [0.8, -3.4]]),
      speed: 1.05,
      phase: 2.4,
      bob: 0.035,
      nextDecision: 0
    }
  ];

  for (const animal of specs) {
    animal.object.position.copy(animal.waypoints[0]);
    scene.add(animal.object);
  }
  return specs.map((animal) => ({
    ...animal,
    target: animal.waypoints[1].clone(),
    velocity: new THREE.Vector3()
  }));
}

function createGoose(): THREE.Group {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: "#fbf5e8", roughness: 0.58 });
  const orange = new THREE.MeshStandardMaterial({ color: "#d99537", roughness: 0.54 });
  const dark = new THREE.MeshStandardMaterial({ color: "#2e302d", roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), white);
  body.scale.set(1.28, 0.8, 1.55);
  body.position.y = 0.4;
  group.add(body);

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.27, 5, 10), white);
  neck.position.set(0, 0.69, -0.26);
  neck.rotation.x = -0.18;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), white);
  head.scale.set(1, 0.94, 1.08);
  head.position.set(0, 0.91, -0.33);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), orange);
  beak.scale.set(0.8, 0.35, 1.32);
  beak.position.set(0, 0.88, -0.48);
  group.add(beak);

  for (const x of [-0.28, 0.28]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), white);
    wing.scale.set(0.48, 0.48, 1.12);
    wing.position.set(x, 0.45, 0.03);
    wing.rotation.z = x * 0.65;
    group.add(wing);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), dark);
    eye.position.set(x, 0.95, -0.43);
    group.add(eye);

    const legRig = new THREE.Group();
    legRig.position.set(x * 2.4, 0.27, 0.02);
    group.add(legRig);
    legs.push(legRig);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 6), orange);
    leg.position.y = -0.12;
    legRig.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.13), orange);
    foot.position.set(0, -0.25, -0.04);
    legRig.add(foot);
  }

  group.userData.legs = legs;
  addSoftShadow(group, 0.08, 0.06, 0.82, 0.48, 0, 0.16);
  group.scale.setScalar(0.76);
  return group;
}

function createCorgi(): THREE.Group {
  const group = new THREE.Group();
  const tan = new THREE.MeshStandardMaterial({ color: "#bc763b", roughness: 0.56 });
  const cream = new THREE.MeshStandardMaterial({ color: "#f2dfbc", roughness: 0.58 });
  const dark = new THREE.MeshStandardMaterial({ color: "#302820", roughness: 0.56 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), tan);
  body.scale.set(1.25, 0.72, 1.05);
  body.position.y = 0.42;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 9), cream);
  chest.scale.set(1.08, 1.12, 0.35);
  chest.position.set(0, 0.41, -0.29);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), tan);
  head.scale.set(1.06, 0.94, 0.95);
  head.position.set(0, 0.7, -0.34);
  group.add(head);

  for (const x of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), tan);
    ear.position.set(x, 0.99, -0.31);
    ear.rotation.y = Math.PI / 4;
    group.add(ear);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.12, 0.12]) {
      const legRig = new THREE.Group();
      legRig.position.set(x, 0.29, z);
      group.add(legRig);
      legs.push(legRig);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 7), cream);
      leg.position.y = -0.14;
      legRig.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), cream);
      paw.scale.z = 1.25;
      paw.position.set(0, -0.29, -0.025);
      legRig.add(paw);
    }
  }

  const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), cream);
  forehead.scale.set(0.72, 1.18, 0.35);
  forehead.position.set(0, 0.79, -0.58);
  group.add(forehead);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), cream);
  muzzle.scale.set(1.1, 0.75, 0.75);
  muzzle.position.set(0, 0.64, -0.55);
  group.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
  nose.position.set(0, 0.66, -0.68);
  group.add(nose);
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark);
    eye.position.set(x, 0.75, -0.58);
    group.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 7), tan);
  tail.position.set(0, 0.61, 0.35);
  tail.rotation.x = 0.62;
  group.add(tail);

  group.userData.legs = legs;
  group.userData.tail = tail;
  addSoftShadow(group, 0.08, 0.08, 0.92, 0.5, 0, 0.16);
  group.scale.setScalar(0.88);
  return group;
}

function createSakuraPetals(scene: THREE.Scene): SakuraPetal[] {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.13);
  shape.quadraticCurveTo(0.1, 0.03, 0, -0.13);
  shape.quadraticCurveTo(-0.1, 0.03, 0, 0.13);
  const geometry = new THREE.ShapeGeometry(shape);
  const colors = ["#e7a4ae", "#f1c2c0", "#c49bad", "#dfb0b4"];
  const petals: SakuraPetal[] = [];

  for (let index = 0; index < 46; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: colors[index % colors.length],
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 42, 0.65 + Math.random() * 7, (Math.random() - 0.5) * 38);
    mesh.position.copy(origin);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, phase);
    mesh.scale.setScalar(0.65 + Math.random() * 1.25);
    mesh.renderOrder = 2;
    scene.add(mesh);
    petals.push({ mesh, origin, phase, drift: 0.45 + Math.random() * 0.7, fallSpeed: 0.28 + Math.random() * 0.26 });
  }
  return petals;
}

function createFireflyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create firefly texture");
  const glow = context.createRadialGradient(48, 48, 1, 48, 48, 45);
  glow.addColorStop(0, "rgba(255, 252, 208, 1)");
  glow.addColorStop(0.16, "rgba(255, 221, 112, 0.95)");
  glow.addColorStop(0.45, "rgba(255, 197, 74, 0.3)");
  glow.addColorStop(1, "rgba(255, 197, 74, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFireflies(scene: THREE.Scene): Firefly[] {
  const texture = createFireflyTexture();
  const fireflies: Firefly[] = [];
  for (let index = 0; index < 30; index += 1) {
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 38, 0.55 + Math.random() * 3.5, (Math.random() - 0.5) * 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, color: "#ffd76a", transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sprite.position.copy(origin);
    sprite.scale.setScalar(0.22 + Math.random() * 0.2);
    sprite.renderOrder = 3;
    scene.add(sprite);
    fireflies.push({ sprite, origin, phase, radius: 0.14 + Math.random() * 0.35, speed: 0.65 + Math.random() * 0.8 });
  }
  return fireflies;
}

function createCloud(material: THREE.Material, scale: number): THREE.Group {
  const group = new THREE.Group();
  const pieces = [
    [-0.9, 0, 0, 0.7],
    [-0.25, 0.12, 0.05, 0.95],
    [0.48, 0.02, -0.03, 0.78],
    [1.05, -0.04, 0.02, 0.52]
  ] as const;

  for (const [x, y, z, radius] of pieces) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 18, 12), material);
    puff.position.set(x * scale, y * scale, z * scale);
    puff.scale.y = 0.58;
    group.add(puff);
  }

  return group;
}

function addPath(scene: THREE.Scene, x: number, z: number, width: number, depth: number, rotation: number): void {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: "#d9c29c", roughness: 0.76 })
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.012, z);
  path.receiveShadow = true;
  scene.add(path);
}

function addPathStones(scene: THREE.Scene): void {
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#d7c59c", roughness: 0.95 });
  const positions = [
    [-5.8, -0.7],
    [-3.9, 0.6],
    [-1.9, -0.5],
    [2.2, 0.7],
    [4.6, -0.6],
    [0.6, 3.3],
    [-0.7, -4.2],
    [6.4, 4.8],
    [-6.2, 4.8]
  ];
  for (const [x, z] of positions) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.045, 7), stoneMaterial);
    stone.position.set(x * TOWN_SPREAD, 0.04, z * TOWN_SPREAD);
    stone.rotation.y = x + z;
    stone.receiveShadow = true;
    scene.add(stone);
  }
}

function addBuilding(scene: THREE.Scene, label: string, x: number, z: number, color: string, roofColor: string): void {
  const group = new THREE.Group();
  const width = 4.4;
  const depth = 3.8;
  const height = 3.15;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.64, metalness: 0.02 })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const sideShade = new THREE.Mesh(new THREE.BoxGeometry(0.055, height - 0.12, depth + 0.02), makeDarkerMaterial(color, 0.74));
  sideShade.position.set(width / 2 + 0.03, height / 2 + 0.02, 0);
  sideShade.castShadow = true;
  sideShade.receiveShadow = true;
  group.add(sideShade);

  const visibleSideShade = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, height - 0.18, depth - 0.14),
    makeDarkerMaterial(color, 0.86)
  );
  visibleSideShade.position.set(-width / 2 - 0.03, height / 2 + 0.02, 0.04);
  visibleSideShade.castShadow = true;
  visibleSideShade.receiveShadow = true;
  group.add(visibleSideShade);

  const frontShade = new THREE.Mesh(new THREE.BoxGeometry(width - 0.35, height - 0.24, 0.045), makeDarkerMaterial(color, 0.88));
  frontShade.position.set(0.22, height / 2 + 0.03, depth / 2 + 0.035);
  frontShade.castShadow = true;
  frontShade.receiveShadow = true;
  group.add(frontShade);

  const baseTrim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.2, 0.16, depth + 0.2),
    new THREE.MeshStandardMaterial({ color: "#d8d0bd", roughness: 0.75 })
  );
  baseTrim.position.y = 0.12;
  baseTrim.castShadow = true;
  group.add(baseTrim);

  const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.54, metalness: 0.03 });
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-(width + 0.8) / 2, 0);
  roofShape.lineTo(0, 1.12);
  roofShape.lineTo((width + 0.8) / 2, 0);
  roofShape.lineTo(-(width + 0.8) / 2, 0);
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: depth + 0.62,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 1
    }),
    roofMaterial
  );
  roof.position.set(0, height, -(depth + 0.62) / 2);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const gableMaterial = makeDarkerMaterial(color, 0.9, THREE.DoubleSide);
  const frontGable = createGable(width + 0.08, 0.9, gableMaterial);
  frontGable.position.set(0, height + 0.02, -depth / 2 - 0.07);
  frontGable.castShadow = true;
  frontGable.receiveShadow = true;
  group.add(frontGable);

  const rearGable = createGable(width + 0.08, 0.9, gableMaterial);
  rearGable.position.set(0, height + 0.02, depth / 2 + 0.07);
  rearGable.rotation.y = Math.PI;
  rearGable.castShadow = true;
  rearGable.receiveShadow = true;
  group.add(rearGable);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, depth + 0.86), roofMaterial);
  ridge.position.y = height + 1.1;
  ridge.castShadow = true;
  group.add(ridge);

  const eaveMaterial = makeDarkerMaterial(roofColor, 0.58);
  const roofLipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, depth + 0.76), eaveMaterial);
  roofLipLeft.position.set(-(width + 0.55) / 2, height + 0.04, 0);
  roofLipLeft.rotation.z = -0.38;
  roofLipLeft.castShadow = true;
  group.add(roofLipLeft);

  const roofLipRight = roofLipLeft.clone();
  roofLipRight.position.x = (width + 0.55) / 2;
  roofLipRight.rotation.z = 0.38;
  roofLipRight.castShadow = true;
  group.add(roofLipRight);

  const underEaveRear = new THREE.Mesh(new THREE.BoxGeometry(width + 0.78, 0.1, 0.08), eaveMaterial);
  underEaveRear.position.set(0, height - 0.04, depth / 2 + 0.24);
  underEaveRear.castShadow = true;
  group.add(underEaveRear);

  const underEaveFront = underEaveRear.clone();
  underEaveFront.position.z = -depth / 2 - 0.24;
  group.add(underEaveFront);

  const frontFascia = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.92, 0.16, 0.18),
    new THREE.MeshStandardMaterial({ color: "#4d4a47", roughness: 0.75 })
  );
  frontFascia.position.set(0, height + 0.04, -depth / 2 - 0.34);
  frontFascia.castShadow = true;
  group.add(frontFascia);

  const rearFascia = frontFascia.clone();
  rearFascia.position.z = depth / 2 + 0.34;
  rearFascia.castShadow = true;
  group.add(rearFascia);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#f2ead8", roughness: 0.58 });
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.62, 0.08), frameMaterial);
  doorFrame.position.set(0, 0.81, -depth / 2 - 0.045);
  doorFrame.castShadow = true;
  group.add(doorFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 1.42, 0.1),
    new THREE.MeshStandardMaterial({ color: "#7a4a2d", roughness: 0.62 })
  );
  door.position.set(0, 0.72, -depth / 2 - 0.06);
  door.castShadow = true;
  group.add(door);

  const frontStep = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.13, 0.42),
    new THREE.MeshStandardMaterial({ color: "#d9d0ba", roughness: 0.82 })
  );
  frontStep.position.set(0, 0.065, -depth / 2 - 0.35);
  frontStep.castShadow = true;
  frontStep.receiveShadow = true;
  group.add(frontStep);

  const doorShadow = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.32, 0.035),
    new THREE.MeshStandardMaterial({ color: "#3f2d22", roughness: 0.85 })
  );
  doorShadow.position.set(-0.32, 0.77, -depth / 2 - 0.13);
  group.add(doorShadow);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#f2c96a", roughness: 0.38, metalness: 0.2 })
  );
  knob.position.set(0.25, 0.76, -depth / 2 - 0.13);
  group.add(knob);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: "#cde0d3",
    emissive: "#b5d8cb",
    emissiveIntensity: 0.08,
    roughness: 0.27,
    metalness: 0.05
  });
  for (const offset of [-1.35, 1.35]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.08), frameMaterial);
    frame.position.set(offset, 1.48, -depth / 2 - 0.055);
    frame.castShadow = true;
    group.add(frame);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), windowMaterial);
    window.position.set(offset, 1.48, -depth / 2 - 0.11);
    group.add(window);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.15), frameMaterial);
    sill.position.set(offset, 1.08, -depth / 2 - 0.12);
    sill.castShadow = true;
    group.add(sill);
  }

  const roundWindowFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), frameMaterial);
  roundWindowFrame.position.set(0, 2.25, -depth / 2 - 0.06);
  roundWindowFrame.rotation.x = Math.PI / 2;
  group.add(roundWindowFrame);
  const roundWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24), windowMaterial);
  roundWindow.position.set(0, 2.25, -depth / 2 - 0.11);
  roundWindow.rotation.x = Math.PI / 2;
  group.add(roundWindow);

  const rearDoor = door.clone();
  rearDoor.position.z = depth / 2 + 0.06;
  const rearDoorFrame = doorFrame.clone();
  rearDoorFrame.position.z = depth / 2 + 0.045;
  group.add(rearDoorFrame);
  group.add(rearDoor);
  const rearKnob = knob.clone();
  rearKnob.position.set(-0.25, 0.76, depth / 2 + 0.13);
  group.add(rearKnob);
  const rearStep = frontStep.clone();
  rearStep.position.z = depth / 2 + 0.35;
  group.add(rearStep);
  for (const offset of [-1.35, 1.35]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.08), frameMaterial);
    frame.position.set(offset, 1.48, depth / 2 + 0.055);
    frame.castShadow = true;
    group.add(frame);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), windowMaterial);
    window.position.set(offset, 1.48, depth / 2 + 0.11);
    group.add(window);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.15), frameMaterial);
    sill.position.set(offset, 1.08, depth / 2 + 0.12);
    sill.castShadow = true;
    group.add(sill);
  }
  const rearRoundFrame = roundWindowFrame.clone();
  rearRoundFrame.position.z = depth / 2 + 0.06;
  group.add(rearRoundFrame);
  const rearRoundWindow = roundWindow.clone();
  rearRoundWindow.position.z = depth / 2 + 0.11;
  group.add(rearRoundWindow);

  for (const side of [-1, 1]) {
    const xEdge = side * (width / 2 + 0.055);
    const cornerPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, height + 0.1, 0.14),
      new THREE.MeshStandardMaterial({ color: "#e7dcc8", roughness: 0.76 })
    );
    cornerPost.position.set(side * (width / 2 + 0.04), height / 2, 0);
    cornerPost.castShadow = true;
    group.add(cornerPost);

    for (const zOffset of [-0.85, 0.85]) {
      const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.68), frameMaterial);
      sideFrame.position.set(xEdge, 1.5, zOffset);
      sideFrame.castShadow = true;
      group.add(sideFrame);
      const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.46), windowMaterial);
      sideWindow.position.set(side * (width / 2 + 0.11), 1.5, zOffset);
      group.add(sideWindow);

      const sideSill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.72), frameMaterial);
      sideSill.position.set(side * (width / 2 + 0.13), 1.1, zOffset);
      sideSill.castShadow = true;
      group.add(sideSill);
    }
  }

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1, 0.45),
    new THREE.MeshStandardMaterial({ color: "#75644f", roughness: 0.78 })
  );
  chimney.position.set(1.25, height + 1.1, 0.75);
  chimney.castShadow = true;
  group.add(chimney);

  const chimneyCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.16, 0.62),
    new THREE.MeshStandardMaterial({ color: "#4e4236", roughness: 0.72 })
  );
  chimneyCap.position.set(1.25, height + 1.66, 0.75);
  chimneyCap.castShadow = true;
  group.add(chimneyCap);

  const sign = createLabelSign(label);
  sign.position.set(0, height + 0.53, -depth / 2 - 0.46);
  sign.scale.setScalar(0.76);
  group.add(sign);
  const rearSign = createLabelSign(label);
  rearSign.position.set(0, height + 0.53, depth / 2 + 0.46);
  rearSign.scale.setScalar(0.76);
  group.add(rearSign);

  addLampToGroup(group, -2.35, -depth / 2 - 0.36);
  addLampToGroup(group, 2.35, depth / 2 + 0.36);
  addBuildingCharacter(group, label, width, depth, height);
  addSoftShadow(group, 1.35, 0.82, width + 2.35, 2.15, -0.16, 0.24);
  addSoftShadow(group, 0.12, 0.06, width + 0.72, depth + 0.46, 0.02, 0.14);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBuildingCharacter(group: THREE.Group, label: string, width: number, depth: number, height: number): void {
  const accents: Record<string, string> = {
    "AI Agents Lab": "#4b8da0",
    "SaaS Studio": "#d16f58",
    "Sustainability Garden": "#6d9c5a",
    "Crypto Alley": "#697eb0",
    "Founder School": "#c19a4b",
    "Winners Hall": "#bc7853"
  };
  const accent = accents[label] ?? "#b58452";
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 });
  const terracotta = new THREE.MeshStandardMaterial({ color: "#ad7650", roughness: 0.82 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#5d8d53", roughness: 0.9 });

  if (label !== "Winners Hall") {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.13, 0.7), accentMaterial);
    awning.position.set(0, 1.96, -depth / 2 - 0.42);
    awning.rotation.x = 0.12;
    awning.castShadow = true;
    group.add(awning);

    const awningTrim = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.1, 0.1), terracotta);
    awningTrim.position.set(0, 1.92, -depth / 2 - 0.78);
    awningTrim.castShadow = true;
    group.add(awningTrim);
  }

  if (label === "AI Agents Lab" || label === "Crypto Alley") {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), accentMaterial);
    mast.position.set(-1.35, height + 1.55, 0.55);
    mast.castShadow = true;
    group.add(mast);
    const receiver = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), accentMaterial);
    receiver.position.set(-1.35, height + 2.02, 0.55);
    receiver.castShadow = true;
    group.add(receiver);
  }

  if (label === "Sustainability Garden" || label === "Founder School") {
    for (const x of [-1.78, 1.78]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 10), terracotta);
      pot.position.set(x, 0.14, -depth / 2 - 0.42);
      pot.castShadow = true;
      group.add(pot);
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), leaf);
      plant.position.set(x, 0.38, -depth / 2 - 0.42);
      plant.castShadow = true;
      group.add(plant);
    }
  }

  if (label === "Sustainability Garden") {
    const solar = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.06, 0.78),
      new THREE.MeshStandardMaterial({ color: "#49687c", roughness: 0.46, metalness: 0.08 })
    );
    solar.position.set(0.55, height + 0.69, 0.28);
    solar.rotation.x = -0.36;
    solar.castShadow = true;
    group.add(solar);
  }

  if (label === "Winners Hall") {
    const medal = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: "#e7ba4e", roughness: 0.38, metalness: 0.18 })
    );
    medal.position.set(0, 1.84, -depth / 2 - 0.16);
    medal.castShadow = true;
    group.add(medal);
  }
}

function addMarket(scene: THREE.Scene, label: string, x: number, z: number, color: string): void {
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1, 1.5),
    new THREE.MeshStandardMaterial({ color: "#f6ead4", roughness: 0.75 })
  );
  counter.position.y = 0.5;
  counter.castShadow = true;
  stall.add(counter);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.25, 1.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  roof.position.y = 1.35;
  roof.castShadow = true;
  stall.add(roof);

  const sign = createLabelSign(label);
  sign.position.set(0, 1.9, -0.95);
  stall.add(sign);

  addSoftShadow(stall, 0.6, 0.45, 3.4, 1.9, -0.12, 0.2);
  stall.position.set(x, 0, z);
  scene.add(stall);
}

function addMarketBooth(
  scene: THREE.Scene,
  x: number,
  z: number,
  label: string,
  canopyColor: string,
  stripeColor: string
): void {
  const booth = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#9b7046", roughness: 0.82 });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#5e4734", roughness: 0.86 });
  const canopyMaterials = [canopyColor, stripeColor, canopyColor].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.72, 1.18), wood);
  counter.position.y = 0.48;
  counter.castShadow = true;
  booth.add(counter);

  for (const [index, offset] of [-0.82, 0, 0.82].entries()) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 1.65), canopyMaterials[index]);
    stripe.position.set(offset, 1.92, 0);
    stripe.rotation.z = index === 1 ? 0.02 : -0.02;
    stripe.castShadow = true;
    booth.add(stripe);
  }

  for (const poleX of [-1.08, 1.08]) {
    for (const poleZ of [-0.58, 0.58]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.82, 0.07), darkWood);
      pole.position.set(poleX, 1.02, poleZ);
      pole.castShadow = true;
      booth.add(pole);
    }
  }

  const sign = createLabelSign(label);
  sign.position.set(0, 1.55, -0.66);
  sign.scale.setScalar(0.52);
  booth.add(sign);

  const crateMaterial = new THREE.MeshStandardMaterial({ color: "#bd8d55", roughness: 0.9 });
  for (const crateX of [-0.72, 0.72]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.52), crateMaterial);
    crate.position.set(crateX, 0.94, -0.06);
    crate.castShadow = true;
    booth.add(crate);
    for (let item = 0; item < 3; item += 1) {
      const produce = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: item % 2 ? "#f0b65c" : "#6d985d", roughness: 0.78 })
      );
      produce.position.set(crateX + (item - 1) * 0.15, 1.17, -0.06);
      produce.castShadow = true;
      booth.add(produce);
    }
  }

  addSoftShadow(booth, 0.38, 0.3, 3.1, 1.6, -0.1, 0.18);
  booth.position.set(x, 0, z);
  scene.add(booth);
}

function addMarketLawn(scene: THREE.Scene, x: number, z: number): void {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(3.75, 2.55),
    new THREE.MeshStandardMaterial({ color: "#96af78", roughness: 0.96 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(x, 0.014, z);
  lawn.receiveShadow = true;
  scene.add(lawn);

  for (const [offsetX, offsetZ, size] of [
    [-1.42, -0.86, 0.6],
    [1.35, 0.78, 0.55],
    [-1.52, 0.76, 0.42]
  ] as const) {
    addGrassClump(scene, x + offsetX, z + offsetZ, size);
  }
}

function addParcelCart(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const cart = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.58, 0.82),
    new THREE.MeshStandardMaterial({ color: "#7f9a78", roughness: 0.78 })
  );
  body.position.y = 0.66;
  body.castShadow = true;
  cart.add(body);

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.94),
    new THREE.MeshStandardMaterial({ color: "#f0d18b", roughness: 0.7 })
  );
  lid.position.y = 1.01;
  lid.castShadow = true;
  cart.add(lid);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#3d403c", roughness: 0.72 });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.02, 10), wheelMaterial);
  axle.position.set(-0.55, 0.32, 0);
  axle.rotation.x = Math.PI / 2;
  axle.castShadow = true;
  cart.add(axle);

  for (const wheelZ of [-0.5, 0.5]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.12, 14), wheelMaterial);
    wheel.position.set(-0.55, 0.3, wheelZ);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    cart.add(wheel);
  }

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: "#5e4734", roughness: 0.8 })
  );
  handle.position.set(1.12, 0.48, 0);
  handle.rotation.z = Math.PI / 2;
  cart.add(handle);
  addSoftShadow(cart, 0.25, 0.18, 2.1, 1.05, -0.1, 0.16);
  cart.position.set(x, 0, z);
  cart.rotation.y = rotation;
  scene.add(cart);
}

function addCommunityBoard(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const board = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: "#76583b", roughness: 0.84 });
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 1.05, 0.12),
    new THREE.MeshStandardMaterial({ color: "#e9d7ae", roughness: 0.86 })
  );
  panel.position.y = 1.2;
  panel.castShadow = true;
  board.add(panel);
  for (const postX of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.1), frame);
    post.position.set(postX, 0.88, 0);
    post.castShadow = true;
    board.add(post);
  }
  for (const [noteX, noteY, color] of [
    [-0.45, 1.35, "#d5745c"],
    [0.05, 1.12, "#6f9d91"],
    [0.48, 1.42, "#e7b956"]
  ] as const) {
    const note = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.3, 0.025),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    );
    note.position.set(noteX, noteY, -0.075);
    board.add(note);
  }
  addSoftShadow(board, 0.36, 0.16, 2.3, 0.5, -0.15, 0.18);
  board.position.set(x, 0, z);
  board.rotation.y = rotation;
  scene.add(board);
}

function addTownWelcomeSign(scene: THREE.Scene, x: number, z: number): void {
  const sign = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: "#765238", roughness: 0.62 });
  const panelBacking = new THREE.Mesh(
    new THREE.BoxGeometry(4.35, 1.56, 0.16),
    new THREE.MeshStandardMaterial({ color: "#5b422f", roughness: 0.68 })
  );
  panelBacking.position.y = 1.54;
  panelBacking.castShadow = true;
  sign.add(panelBacking);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.06, 1.3),
    new THREE.MeshBasicMaterial({ map: createTownWelcomeTexture(), side: THREE.DoubleSide })
  );
  panel.position.set(0, 1.54, 0.092);
  sign.add(panel);

  for (const postX of [-1.68, 1.68]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.75, 0.18), timber);
    post.position.set(postX, 1.02, 0);
    post.castShadow = true;
    sign.add(post);

    const postCap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 4), timber);
    postCap.position.set(postX, 2.48, 0);
    postCap.rotation.y = Math.PI / 4;
    postCap.castShadow = true;
    sign.add(postCap);
  }

  const flowerMaterial = new THREE.MeshStandardMaterial({ color: "#f0b65c", roughness: 0.7 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#5a8a4f", roughness: 0.9 });
  for (const offsetX of [-1.2, -0.8, 0.8, 1.2]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), leafMaterial);
    leaf.position.set(offsetX, 0.15, -0.08);
    leaf.castShadow = true;
    sign.add(leaf);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), flowerMaterial);
    bloom.position.set(offsetX, 0.31, -0.08);
    sign.add(bloom);
  }

  addSoftShadow(sign, 0.28, 0.18, 4.8, 1, -0.14, 0.26);
  sign.position.set(x, 0, z);
  scene.add(sign);
}

function createFootballPitch(scene: THREE.Scene): TownBall {
  const center = new THREE.Vector3(20, 0, -18);
  const halfWidth = 5.2;
  const halfDepth = 3.3;
  const goalHalfWidth = 1.5;
  const goalHeight = 1.65;
  const goalNetDepth = 0.95;
  const pitch = new THREE.Group();
  pitch.position.copy(center);

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2),
    new THREE.MeshStandardMaterial({ color: "#8fa878", roughness: 0.95 })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.028;
  surface.receiveShadow = true;
  pitch.add(surface);

  const lineMaterial = new THREE.MeshBasicMaterial({ color: "#f2ead8" });
  const addLine = (x: number, z: number, width: number, depth: number) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.018, depth), lineMaterial);
    line.position.set(x, 0.052, z);
    pitch.add(line);
  };
  addLine(0, -halfDepth, halfWidth * 2, 0.055);
  addLine(0, halfDepth, halfWidth * 2, 0.055);
  addLine(-halfWidth, 0, 0.055, halfDepth * 2);
  addLine(halfWidth, 0, 0.055, halfDepth * 2);
  addLine(0, 0, 0.045, halfDepth * 2);
  const centerCircle = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.03, 6, 48), lineMaterial);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.055;
  pitch.add(centerCircle);

  const goalMaterial = new THREE.MeshStandardMaterial({ color: "#e7e3d8", roughness: 0.62 });
  const netMaterial = new THREE.MeshBasicMaterial({
    color: "#e6eee4",
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  });
  for (const side of [-1, 1]) {
    const goal = new THREE.Group();
    goal.position.x = side * halfWidth;
    for (const z of [-goalHalfWidth, goalHalfWidth]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, goalHeight, 12), goalMaterial);
      post.position.set(0, goalHeight / 2, z);
      post.castShadow = true;
      goal.add(post);
    }
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, goalHalfWidth * 2, 12), goalMaterial);
    crossbar.position.y = goalHeight - 0.04;
    crossbar.rotation.x = Math.PI / 2;
    crossbar.castShadow = true;
    goal.add(crossbar);

    const rearX = side * goalNetDepth;
    const addNetVertical = (x: number, z: number) => {
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, goalHeight, 6), netMaterial);
      strand.position.set(x, goalHeight / 2, z);
      goal.add(strand);
    };
    const addNetAcross = (x: number, y: number) => {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, goalHalfWidth * 2, 6),
        netMaterial
      );
      strand.position.set(x, y, 0);
      strand.rotation.x = Math.PI / 2;
      goal.add(strand);
    };
    const addNetDepth = (y: number, z: number) => {
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, goalNetDepth, 6), netMaterial);
      strand.position.set(rearX / 2, y, z);
      strand.rotation.z = Math.PI / 2;
      goal.add(strand);
    };

    for (const z of [-goalHalfWidth, -goalHalfWidth / 2, 0, goalHalfWidth / 2, goalHalfWidth]) {
      addNetVertical(rearX, z);
    }
    for (const y of [0.34, 0.72, 1.1, 1.48]) {
      addNetAcross(rearX, y);
      addNetDepth(y, -goalHalfWidth);
      addNetDepth(y, goalHalfWidth);
    }
    for (const z of [-goalHalfWidth, goalHalfWidth]) {
      const roofStrand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, goalNetDepth, 6), netMaterial);
      roofStrand.position.set(rearX / 2, goalHeight - 0.04, z);
      roofStrand.rotation.z = Math.PI / 2;
      goal.add(roofStrand);
    }
    pitch.add(goal);
  }
  scene.add(pitch);

  const ballGeometry = new THREE.IcosahedronGeometry(0.28, 2).toNonIndexed();
  const colors = new Float32Array(ballGeometry.attributes.position.count * 3);
  const light = new THREE.Color("#eee9dc");
  const dark = new THREE.Color("#34332f");
  for (let vertex = 0; vertex < ballGeometry.attributes.position.count; vertex += 1) {
    const color = Math.floor(vertex / 3) % 7 === 0 ? dark : light;
    color.toArray(colors, vertex * 3);
  }
  ballGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const ball = new THREE.Mesh(
    ballGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })
  );
  ball.position.set(center.x, 0.3, center.z);
  ball.castShadow = true;
  scene.add(ball);

  return {
    object: ball,
    velocity: new THREE.Vector3(),
    lastPlayerPosition: new THREE.Vector3(),
    center,
    halfWidth,
    halfDepth,
    goalHalfWidth,
    goalNetDepth,
    radius: 0.28,
    goalCooldown: 0
  };
}

function addLoopMonument(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.52, 0.52, 8),
    new THREE.MeshStandardMaterial({ color: "#d8c9a9", roughness: 0.66 })
  );
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.92, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: "#b9a682", roughness: 0.55, metalness: 0.08 })
  );
  plinth.position.y = 0.7;
  plinth.castShadow = true;
  group.add(plinth);

  const gold = new THREE.MeshStandardMaterial({ color: "#d9a932", metalness: 0.48, roughness: 0.28 });
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.64, 0.63, 20, 1, true),
    gold
  );
  cup.position.y = 1.52;
  cup.castShadow = true;
  group.add(cup);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 8, 20), gold);
  cupRim.position.y = 1.84;
  cupRim.rotation.x = Math.PI / 2;
  cupRim.castShadow = true;
  group.add(cupRim);

  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 8, 16, Math.PI), gold);
    handle.position.set(side * 0.52, 1.55, 0);
    handle.rotation.z = side * Math.PI / 2;
    handle.castShadow = true;
    group.add(handle);
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.38, 12), gold);
  stem.position.y = 0.98;
  stem.castShadow = true;
  group.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.13, 16), gold);
  foot.position.y = 0.82;
  foot.castShadow = true;
  group.add(foot);

  const medallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.055, 16),
    new THREE.MeshStandardMaterial({ color: "#fff0a5", metalness: 0.35, roughness: 0.22 })
  );
  medallion.position.set(0, 1.48, 0.64);
  medallion.rotation.x = Math.PI / 2;
  group.add(medallion);

  group.position.set(x, 0, z);
  addSoftShadow(group, 0.28, 0.3, 2.9, 2.15, -0.2, 0.2);
  scene.add(group);
}

function addFountain(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#cdbf9b", roughness: 0.82 });
  const water = new THREE.MeshStandardMaterial({
    color: "#9fd2ce",
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82
  });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.72, 0.35, 32), stone);
  basin.position.y = 0.18;
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.42, 0.08, 32), water);
  pool.position.y = 0.42;
  group.add(pool);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.95, 18), stone);
  stem.position.y = 0.85;
  stem.castShadow = true;
  group.add(stem);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.2, 28), stone);
  topBowl.position.y = 1.38;
  topBowl.castShadow = true;
  group.add(topBowl);

  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.9, 12), water);
  stream.position.y = 1.75;
  group.add(stream);

  addSoftShadow(group, 0.4, 0.35, 3.25, 2, -0.12, 0.2);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addDistrictProps(scene: THREE.Scene): void {
  addBench(scene, -5.1, -2.5, rotationTowardPlaza(-5.1, -2.5));
  addBench(scene, 4.9, -2.7, rotationTowardPlaza(4.9, -2.7));
  addBench(scene, 2.3, 6.4, rotationTowardPlaza(2.3, 6.4));
  addFlowerBed(scene, -12.2, 8.1, "#f2b35f");
  addFlowerBed(scene, 6.7, -2.4, "#ef765f");
  addFlowerBed(scene, 9.2, 2.65, "#f7d35d");
  addShrub(scene, -5.8, -4.4, 0.82);
  addShrub(scene, 5.5, -4.1, 0.72);
  addShrub(scene, -6.5, 7, 0.74);
  addShrub(scene, 5.9, 7.2, 0.78);
  addShrub(scene, -1.55, 7.1, 0.68);
  addShrub(scene, 2, -6.3, 0.7);
  addFence(scene, 9.4, 7.2, 4.8, 0);
  addFence(scene, -9.5, 9.2, 4.4, 0);
  addRock(scene, -12.4, -5.4, 0.7);
  addRock(scene, 11.4, -8.2, 0.6);
  addRock(scene, 12.4, 5.8, 0.75);
  addTinyFlag(scene, -7.8, -4.5, "#2e6f72");
  addTinyFlag(scene, 7.6, -3.9, "#a94d42");
  addTinyFlag(scene, 0.9, 8.3, "#9c7032");
  addGardenPlot(scene, -13.4, 2.5, -0.12);
  addGardenPlot(scene, 6.5, 11.7, 0.18);
  addPicnicLawn(scene, -12.2, 4.9, -0.12);
  addPicnicTable(scene, -12.2, 4.9, -0.12);
  addPicnicLawn(scene, 3.8, 10.8, 0.14);
  addPicnicTable(scene, 3.8, 10.8, 0.14);

  for (const [x, z, size] of [
    [-15.2, -1.6, 0.8],
    [-14.4, 5.1, 0.62],
    [-10.8, 12.4, 0.7],
    [1.4, 15.2, 0.68],
    [13.6, 11.1, 0.78],
    [15.1, 4.2, 0.62],
    [14.6, -3.8, 0.76],
    [10.1, -13.2, 0.66],
    [-10.6, -12.7, 0.74],
    [-15.6, -7.1, 0.6]
  ] as const) {
    addGrassClump(scene, x, z, size);
  }
}

function addTrees(scene: THREE.Scene): void {
  const positions = [
    [-13, -8],
    [-12, 8],
    [13, -9],
    [13, 8],
    [5, 12],
    [-6, 12],
    [-15.2, -4.1],
    [-5, -12],
    [5.5, -12],
    [13.5, 0.5],
    [-1.2, 13],
    [10.8, 10.5],
    [-20, -14],
    [-20, 1],
    [-20, 14],
    [20, -15],
    [20, 0],
    [20, 14],
    [-8, 19],
    [9, 19]
  ];
  for (const [index, [x, z]] of positions.entries()) {
    const treeScale = 0.88 + (index % 4) * 0.08;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#7b5636", roughness: 0.85 })
    );
    trunk.position.set(x, 0.6 * treeScale, z);
    trunk.scale.setScalar(treeScale);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 0),
      new THREE.MeshStandardMaterial({ color: "#68965d", roughness: 0.9 })
    );
    leaves.position.set(x, 1.55 * treeScale, z);
    leaves.scale.setScalar(treeScale);
    leaves.castShadow = true;
    scene.add(leaves);

    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#527f50", roughness: 0.88 });
    const leafClusterA = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), leafMaterial);
    leafClusterA.position.set(x - 0.38 * treeScale, 1.42 * treeScale, z + 0.14 * treeScale);
    leafClusterA.scale.setScalar(treeScale);
    leafClusterA.castShadow = true;
    scene.add(leafClusterA);

    const leafClusterB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 0), leafMaterial);
    leafClusterB.position.set(x + 0.42 * treeScale, 1.5 * treeScale, z - 0.18 * treeScale);
    leafClusterB.scale.setScalar(treeScale);
    leafClusterB.castShadow = true;
    scene.add(leafClusterB);

    addSoftShadow(scene, x + 0.88 * treeScale, z + 0.48 * treeScale, 2.35 * treeScale, 0.72 * treeScale, -0.22, 0.22);
    addSoftShadow(scene, x + 0.05 * treeScale, z + 0.04 * treeScale, 0.76 * treeScale, 0.5 * treeScale, 0, 0.12);
  }
}

function addWaterTower(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const tank = new THREE.MeshStandardMaterial({ color: "#91a9a2", roughness: 0.66, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: "#d9e0d2", roughness: 0.58, metalness: 0.12 });
  const support = new THREE.MeshStandardMaterial({ color: "#5d7067", roughness: 0.78, metalness: 0.15 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: "#45564f", roughness: 0.74, metalness: 0.18 });

  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3, rotation?: THREE.Euler) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const legPositions = [
    [-0.9, -0.84],
    [0.9, -0.84],
    [-0.9, 0.84],
    [0.9, 0.84]
  ] as const;
  for (const [offsetX, offsetZ] of legPositions) {
    const leg = addMesh(
      new THREE.CylinderGeometry(0.105, 0.16, 4.4, 6),
      support,
      new THREE.Vector3(offsetX, 2.2, offsetZ)
    );
    leg.rotation.z = -offsetX * 0.055;
    leg.rotation.x = offsetZ * 0.055;
  }

  for (const y of [1.6, 3.2]) {
    for (const direction of [-1, 1]) {
      addMesh(
        new THREE.BoxGeometry(1.82, 0.1, 0.1),
        darkMetal,
        new THREE.Vector3(0, y, direction * 0.84),
        new THREE.Euler(0, 0, direction * 0.48)
      );
      addMesh(
        new THREE.BoxGeometry(0.1, 0.1, 1.7),
        darkMetal,
        new THREE.Vector3(direction * 0.9, y, 0),
        new THREE.Euler(direction * 0.48, 0, 0)
      );
    }
  }

  const hopper = addMesh(
    new THREE.ConeGeometry(1.22, 0.68, 12),
    tank,
    new THREE.Vector3(0, 4.42, 0),
    new THREE.Euler(Math.PI, 0, 0)
  );
  hopper.scale.y = 0.92;

  addMesh(new THREE.CylinderGeometry(1.32, 1.22, 1.48, 12), tank, new THREE.Vector3(0, 5.35, 0));
  addMesh(new THREE.TorusGeometry(1.27, 0.055, 6, 16), trim, new THREE.Vector3(0, 4.75, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  addMesh(new THREE.TorusGeometry(1.34, 0.06, 6, 16), trim, new THREE.Vector3(0, 5.92, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  addMesh(new THREE.ConeGeometry(1.38, 0.46, 12), support, new THREE.Vector3(0, 6.32, 0));
  addMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.28, 8), darkMetal, new THREE.Vector3(0, 6.69, 0));

  const catwalk = addMesh(
    new THREE.CylinderGeometry(WATER_TOWER_PLATFORM_RADIUS, WATER_TOWER_PLATFORM_RADIUS, 0.14, 20),
    darkMetal,
    new THREE.Vector3(0, 4.8, 0)
  );
  catwalk.scale.y = 0.65;
  addMesh(
    new THREE.TorusGeometry(WATER_TOWER_PLATFORM_RADIUS - 0.07, 0.065, 6, 20),
    trim,
    new THREE.Vector3(0, 4.88, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );
  for (let index = 0; index < 12; index += 1) {
    if (index === 9) continue;
    const angle = (index / 12) * Math.PI * 2;
    const railX = Math.cos(angle) * (WATER_TOWER_PLATFORM_RADIUS - 0.16);
    const railZ = Math.sin(angle) * (WATER_TOWER_PLATFORM_RADIUS - 0.16);
    addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), trim, new THREE.Vector3(railX, 5.1, railZ));
  }

  addMesh(
    new THREE.TorusGeometry(WATER_TOWER_PLATFORM_RADIUS - 0.16, 0.035, 5, 24),
    trim,
    new THREE.Vector3(0, 5.38, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );

  const ladderZ = WATER_TOWER_LADDER_Z_OFFSET;
  for (const offsetX of [-0.22, 0.22]) {
    addMesh(new THREE.BoxGeometry(0.055, 3.7, 0.055), trim, new THREE.Vector3(offsetX, 2.62, ladderZ));
  }
  for (let y = 0.95; y <= 4.35; y += 0.36) {
    addMesh(new THREE.BoxGeometry(0.5, 0.05, 0.055), trim, new THREE.Vector3(0, y, ladderZ));
  }

  addSoftShadow(group, 0.28, 0.24, 3.6, 2.7, -0.08, 0.26);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addGardenPlot(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: "#a9784f", roughness: 0.86 });
  const soil = new THREE.MeshStandardMaterial({ color: "#765b3e", roughness: 0.96 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#5e934f", roughness: 0.88 });
  const bloom = new THREE.MeshStandardMaterial({ color: "#f0b65c", roughness: 0.72 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.18), timber);
  base.position.y = 0.1;
  base.castShadow = true;
  group.add(base);
  const soilBed = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.92), soil);
  soilBed.position.y = 0.23;
  soilBed.castShadow = true;
  group.add(soilBed);

  for (const offsetX of [-0.55, 0, 0.55]) {
    for (const offsetZ of [-0.25, 0.25]) {
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), leaf);
      plant.position.set(offsetX, 0.38, offsetZ);
      plant.scale.y = 0.7;
      plant.castShadow = true;
      group.add(plant);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), bloom);
      flower.position.set(offsetX + 0.03, 0.49, offsetZ);
      group.add(flower);
    }
  }

  addSoftShadow(group, 0.18, 0.12, 2.3, 1.25, -0.16, 0.24);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

function addPicnicTable(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#a77545", roughness: 0.82 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.84 });
  const tabletop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.72), wood);
  tabletop.position.y = 0.82;
  tabletop.castShadow = true;
  group.add(tabletop);
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.3), wood);
    seat.position.set(0, 0.48, side * 0.58);
    seat.castShadow = true;
    group.add(seat);
  }
  for (const offsetX of [-0.54, 0.54]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12), legMaterial);
    support.position.set(offsetX, 0.39, 0);
    support.castShadow = true;
    group.add(support);
  }
  addSoftShadow(group, 0.2, 0.12, 2.1, 1.42, -0.14, 0.24);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

function addPicnicLawn(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.55),
    new THREE.MeshStandardMaterial({ color: "#91aa73", roughness: 0.96 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.rotation.z = rotation;
  lawn.position.set(x, 0.014, z);
  lawn.receiveShadow = true;
  scene.add(lawn);

  for (const [offsetX, offsetZ, size] of [
    [-1.14, -0.72, 0.62],
    [1.08, 0.66, 0.54],
    [-0.86, 0.77, 0.46]
  ] as const) {
    addGrassClump(scene, x + offsetX, z + offsetZ, size);
  }
}

function addGrassClump(scene: THREE.Scene, x: number, z: number, size: number): void {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#739b57", roughness: 0.94 });
  for (const [offsetX, offsetZ, rotation] of [
    [-0.1, 0.02, -0.26],
    [0.08, -0.08, 0.2],
    [0.16, 0.13, 0.45]
  ] as const) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055 * size, 0.34 * size, 4), material);
    blade.position.set(offsetX * size, 0.17 * size, offsetZ * size);
    blade.rotation.z = rotation;
    group.add(blade);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function addShrub(scene: THREE.Scene, x: number, z: number, size: number): void {
  const group = new THREE.Group();
  const leafLight = new THREE.MeshStandardMaterial({ color: "#67925d", roughness: 0.9 });
  const leafDark = new THREE.MeshStandardMaterial({ color: "#4c7448", roughness: 0.9 });
  const clusters = [
    [-0.22, 0.18, 0.34, leafDark],
    [0.18, 0.22, 0.4, leafLight],
    [0.02, -0.12, 0.32, leafDark]
  ] as const;

  for (const [offsetX, offsetZ, radius, material] of clusters) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * size, 0), material);
    leaf.position.set(offsetX * size, 0.22 + radius * size * 0.45, offsetZ * size);
    leaf.scale.y = 0.72;
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);
  }

  addSoftShadow(group, 0.18 * size, 0.14 * size, 1.24 * size, 0.66 * size, -0.15, 0.18);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBench(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#a9763f", roughness: 0.8 });
  const woodEdge = new THREE.MeshStandardMaterial({ color: "#875528", roughness: 0.86 });
  const woodHighlight = new THREE.MeshStandardMaterial({ color: "#c28b4d", roughness: 0.76 });
  const support = new THREE.MeshStandardMaterial({ color: "#363a35", roughness: 0.72 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 0.58), wood);
  seat.position.set(0, 0.5, -0.05);
  seat.rotation.x = -0.035;
  seat.castShadow = true;
  group.add(seat);

  const seatInset = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.025, 0.43), woodHighlight);
  seatInset.position.set(0, 0.572, -0.04);
  seatInset.rotation.x = -0.035;
  seatInset.castShadow = true;
  group.add(seatInset);

  const seatFront = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.07), woodEdge);
  seatFront.position.set(0, 0.45, -0.34);
  seatFront.rotation.x = -0.035;
  seatFront.castShadow = true;
  group.add(seatFront);

  const underSeatBrace = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 0.1), support);
  underSeatBrace.position.set(0, 0.37, 0.04);
  underSeatBrace.castShadow = true;
  group.add(underSeatBrace);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 0.12), wood);
  backrest.position.set(0, 0.9, 0.29);
  backrest.rotation.x = 0.15;
  backrest.castShadow = true;
  group.add(backrest);

  const backCap = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.075, 0.16), woodHighlight);
  backCap.position.set(0, 1.2, 0.33);
  backCap.rotation.x = 0.15;
  backCap.castShadow = true;
  group.add(backCap);

  for (const edgeX of [-0.91, 0.91]) {
    const backEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.15), woodEdge);
    backEdge.position.set(edgeX, 0.9, 0.29);
    backEdge.rotation.x = 0.15;
    backEdge.castShadow = true;
    group.add(backEdge);
  }

  const fastenerMaterial = new THREE.MeshStandardMaterial({ color: "#c7a66b", roughness: 0.62 });
  for (const fastenerX of [-0.72, 0.72]) {
    const fastener = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fastenerMaterial);
    fastener.position.set(fastenerX, 0.87, 0.36);
    fastener.castShadow = true;
    group.add(fastener);
  }

  const supportShape = new THREE.Shape();
  supportShape.moveTo(-0.14, 0);
  supportShape.lineTo(0.14, 0);
  supportShape.lineTo(0.14, 0.34);
  supportShape.lineTo(0.1, 0.42);
  supportShape.lineTo(-0.1, 0.42);
  supportShape.lineTo(-0.14, 0.34);
  supportShape.closePath();
  const supportGeometry = new THREE.ExtrudeGeometry(supportShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012
  });

  for (const supportX of [-0.66, 0.66]) {
    const pier = new THREE.Mesh(supportGeometry, support);
    pier.position.set(supportX, 0, -0.15);
    pier.castShadow = true;
    group.add(pier);

    const backBracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.12), support);
    backBracket.position.set(supportX, 0.66, 0.25);
    backBracket.rotation.x = 0.15;
    backBracket.castShadow = true;
    group.add(backBracket);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addSoftShadow(group, 0.22, 0.14, 2.08, 0.78, -0.08, 0.22);
  scene.add(group);
}

function rotationTowardPlaza(x: number, z: number): number {
  return Math.atan2(x, z);
}

function addFlowerBed(scene: THREE.Scene, x: number, z: number, flowerColor: string): void {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.05, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: "#6f5b3e", roughness: 0.9 })
  );
  base.position.set(x, 0.09, z);
  base.castShadow = true;
  scene.add(base);
  addSoftShadow(scene, x + 0.24, z + 0.16, 1.45, 0.92, -0.12, 0.2);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#4f8a48", roughness: 0.9 });
  const flowerMaterial = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.65 });
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const radius = 0.18 + (i % 3) * 0.18;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), leafMaterial);
    leaf.position.set(x + Math.cos(angle) * radius, 0.28, z + Math.sin(angle) * radius);
    leaf.castShadow = true;
    scene.add(leaf);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flowerMaterial);
    bloom.position.set(leaf.position.x, 0.43, leaf.position.z);
    bloom.castShadow = true;
    scene.add(bloom);
  }
}

function addFence(scene: THREE.Scene, x: number, z: number, length: number, rotation: number): void {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#b58b56", roughness: 0.8 });
  const rails = [0.42, 0.78];
  for (const y of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.08), material);
    rail.position.y = y;
    rail.castShadow = true;
    group.add(rail);
  }
  for (let i = -length / 2; i <= length / 2; i += 0.8) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), material);
    post.position.set(i, 0.5, 0);
    post.castShadow = true;
    group.add(post);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

function addRock(scene: THREE.Scene, x: number, z: number, size: number): void {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ color: "#9b9b8f", roughness: 0.95 })
  );
  rock.position.set(x, size * 0.42, z);
  rock.scale.y = 0.62;
  rock.rotation.set(size, x, z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  addSoftShadow(scene, x + size * 0.35, z + size * 0.24, size * 1.9, size * 0.92, -0.2, 0.2);
}

function addTinyFlag(scene: THREE.Scene, x: number, z: number, color: string): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: "#4a4036", roughness: 0.7 })
  );
  pole.position.y = 0.68;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.34, 0.035),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  flag.position.set(0.28, 1.08, 0);
  group.add(flag);
  group.position.set(x, 0, z);
  addSoftShadow(group, 0.32, 0.2, 1.25, 0.34, -0.2, 0.18);
  scene.add(group);
}

function addLamp(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: "#263238", roughness: 0.6 })
  );
  pole.position.y = 1.1;
  group.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f1be54", emissiveIntensity: 1.1 })
  );
  bulb.position.y = 2.25;
  group.add(bulb);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: "#3c3a34", roughness: 0.62 })
  );
  shade.position.y = 2.48;
  shade.rotation.x = Math.PI;
  shade.castShadow = true;
  group.add(shade);

  addSoftShadow(group, 0.82, 0.36, 2.05, 0.24, -0.2, 0.24);
  addSoftShadow(group, 0.04, 0.02, 0.46, 0.34, 0, 0.12);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addLampToGroup(group: THREE.Group, x: number, z: number): void {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.55, 8),
    new THREE.MeshStandardMaterial({ color: "#2c332f", roughness: 0.58 })
  );
  pole.position.y = 0.78;
  lamp.add(pole);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.23, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: "#4a4840", roughness: 0.6 })
  );
  shade.position.y = 1.62;
  shade.rotation.x = Math.PI;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f3bd58", emissiveIntensity: 0.85 })
  );
  bulb.position.y = 1.48;
  lamp.add(bulb);

  addSoftShadow(lamp, 0.58, 0.28, 1.45, 0.2, -0.2, 0.2);
  addSoftShadow(lamp, 0.02, 0.01, 0.34, 0.24, 0, 0.1);
  lamp.position.set(x, 0, z);
  group.add(lamp);
}

function createPlayer(): THREE.Group {
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: "#8a604a", roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#ef765f", roughness: 0.62 });
  const shirtDark = new THREE.MeshStandardMaterial({ color: "#c95749", roughness: 0.68 });
  const pants = new THREE.MeshStandardMaterial({ color: "#254b5f", roughness: 0.72 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#f2f0e9", roughness: 0.55 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: "#241f1a", roughness: 0.84 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.38, 12, 24), shirt);
  torso.position.y = 0.98;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.08, 24), shirtDark);
  hem.position.y = 0.61;
  hem.scale.z = 0.7;
  hem.castShadow = true;
  group.add(hem);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 20), shirtDark);
  collar.position.set(0, 1.38, -0.02);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.55;
  collar.castShadow = true;
  group.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 18), skin);
  neck.position.y = 1.48;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 22), skin);
  head.position.y = 1.72;
  head.scale.set(0.96, 1.02, 0.92);
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.375, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMaterial
  );
  hair.position.y = 1.84;
  hair.scale.set(1.02, 0.78, 0.95);
  hair.castShadow = true;
  group.add(hair);

  for (const [x, scale] of [
    [-0.18, 0.95],
    [0, 1.1],
    [0.18, 0.82]
  ] as const) {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 12, 8), hairMaterial);
    fringe.position.set(x, 1.82, -0.28);
    fringe.scale.y = 0.55;
    fringe.castShadow = true;
    group.add(fringe);
  }

  for (const x of [-0.32, 0.32]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
    ear.position.set(x, 1.7, -0.03);
    ear.castShadow = true;
    group.add(ear);
  }

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#14100d", roughness: 0.45 });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMaterial);
    eye.position.set(x, 1.72, -0.33);
    group.add(eye);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 4, 8), hairMaterial);
    brow.position.set(x, 1.81, -0.34);
    brow.rotation.x = Math.PI / 2;
    brow.rotation.z = x > 0 ? -0.12 : 0.12;
    group.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 10), skin);
  nose.position.set(0, 1.66, -0.36);
  nose.rotation.x = -Math.PI / 2;
  group.add(nose);

  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 4, 8), new THREE.MeshStandardMaterial({ color: "#a33c37", roughness: 0.6 }));
  mouth.position.set(0, 1.58, -0.345);
  mouth.rotation.x = Math.PI / 2;
  mouth.rotation.z = Math.PI / 2;
  group.add(mouth);

  const armRigs: THREE.Group[] = [];
  for (const x of [-0.52, 0.52]) {
    const armRig = new THREE.Group();
    armRig.position.set(x, 1.18, -0.01);
    armRig.rotation.z = x > 0 ? -0.08 : 0.08;
    group.add(armRig);
    armRigs.push(armRig);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.14, 8, 14), shirt);
    sleeve.position.y = -0.05;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    armRig.add(sleeve);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 8, 14), skin);
    arm.position.y = -0.35;
    arm.castShadow = true;
    arm.receiveShadow = true;
    armRig.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
    hand.position.y = -0.58;
    hand.castShadow = true;
    armRig.add(hand);
  }

  const legRigs: THREE.Group[] = [];
  for (const x of [-0.18, 0.18]) {
    const legRig = new THREE.Group();
    legRig.position.set(x, 0.62, 0);
    group.add(legRig);
    legRigs.push(legRig);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 8, 14), pants);
    leg.position.y = -0.22;
    leg.castShadow = true;
    leg.receiveShadow = true;
    legRig.add(leg);

    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 8, 14), shoes);
    shoe.position.set(0, -0.52, -0.06);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.x = 0.85;
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    legRig.add(shoe);
  }

  const shadow = createSoftShadow(0.86, 0.56, 0.22);
  shadow.position.y = 0.012;
  group.add(shadow);

  const personaAuraMaterial = new THREE.MeshBasicMaterial({
    color: "#c95749",
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  });
  const personaAura = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 8, 56), personaAuraMaterial);
  personaAura.rotation.x = -Math.PI / 2;
  personaAura.position.y = 0.055;
  personaAura.renderOrder = 3;
  personaAura.userData.softShadow = true;
  group.add(personaAura);

  const trailDots = [
    { x: -0.22, z: 0.34, phase: 0 },
    { x: 0.22, z: 0.34, phase: 0.7 },
    { x: 0, z: 0.52, phase: 1.4 }
  ].map((dot) => {
    const material = new THREE.MeshBasicMaterial({
      color: "#ef765f",
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(dot.x, 0.056, dot.z);
    mesh.renderOrder = 4;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return { mesh, material, phase: dot.phase };
  });

  group.userData.rig = {
    leftArm: armRigs[0],
    rightArm: armRigs[1],
    leftLeg: legRigs[0],
    rightLeg: legRigs[1],
    torso,
    shadow,
    personaAura,
    personaAuraMaterial,
    trailDots,
    shirtMaterial: shirt,
    trimMaterial: shirtDark,
    pantsMaterial: pants,
    shoeMaterial: shoes,
    hairMaterial
  } satisfies PlayerRig;

  group.scale.setScalar(0.78);
  return group;
}

function applyPlayerPersona(player: THREE.Group, persona: PersonaOption): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig?.shirtMaterial || !rig.trimMaterial || !rig.pantsMaterial || !rig.shoeMaterial || !rig.hairMaterial) return;

  rig.shirtMaterial.color.set(persona.colors.shirt);
  rig.trimMaterial.color.set(persona.colors.trim);
  rig.personaAuraMaterial?.color.set(persona.colors.trim);
  rig.trailDots?.forEach((dot) => dot.material.color.set(persona.colors.shirt));
  rig.pantsMaterial.color.set(persona.colors.pants);
  rig.shoeMaterial.color.set(persona.colors.shoes);
  rig.hairMaterial.color.set(persona.colors.hair);
  player.userData.personaId = persona.id;
  player.userData.personaName = persona.name;
  player.userData.personaTrait = persona.trait;
  player.userData.walkMultiplier = persona.movement.walk;
  player.userData.sprintMultiplier = persona.movement.sprint;
  player.userData.jumpMultiplier = persona.movement.jump;
}

function createCitizens(scene: THREE.Scene): Citizen[] {
  const specs = [
    { x: -4.2, z: -1.4, color: "#f0b35d", radius: 1.25, speed: 0.62, phase: 0.2, speech: "ship signal" },
    { x: 4.2, z: 2.4, color: "#6fa6a0", radius: 1.45, speed: 0.48, phase: 1.7, speech: "package loop" },
    { x: 6.6, z: -4.1, color: "#7f8eaa", radius: 1.05, speed: 0.7, phase: 3.1, speech: "price wedge" },
    { x: -6.3, z: 4.5, color: "#d78c75", radius: 1.18, speed: 0.54, phase: 4.6, speech: "write lesson" }
  ];

  return specs.map((spec) => {
    const citizen = createCitizen(spec.color, spec.speech);
    const x = spec.x * TOWN_SPREAD;
    const z = spec.z * TOWN_SPREAD;
    citizen.object.position.set(x + spec.radius, 0, z);
    scene.add(citizen.object);
    return {
      object: citizen.object,
      origin: new THREE.Vector3(x, 0, z),
      radius: spec.radius,
      speed: spec.speed,
      phase: spec.phase,
      speechMaterial: citizen.speechMaterial
    };
  });
}

function createCitizen(shirtColor: string, speechText: string): { object: THREE.Group; speechMaterial: THREE.SpriteMaterial } {
  const group = createPlayer();
  const rig = group.userData.rig as PlayerRig;
  rig.shirtMaterial?.color.set(shirtColor);
  rig.trimMaterial?.color.copy(new THREE.Color(shirtColor).lerp(new THREE.Color("#493b30"), 0.22));
  rig.pantsMaterial?.color.set("#334856");
  rig.shoeMaterial?.color.set("#eee5d5");
  rig.hairMaterial?.color.set("#29231f");
  if (rig.personaAura) rig.personaAura.visible = false;
  rig.trailDots?.forEach((dot) => {
    dot.mesh.visible = false;
  });
  group.scale.setScalar(0.7);

  const speechMaterial = new THREE.SpriteMaterial({
    map: createCitizenSpeechTexture(speechText, shirtColor),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: 0
  });
  const speech = new THREE.Sprite(speechMaterial);
  speech.position.set(0, 2.42, 0);
  speech.scale.set(1.55, 0.46, 1);
  speech.renderOrder = 6;
  group.add(speech);

  return { object: group, speechMaterial };
}

function createDiscoveryMarkers(scene: THREE.Scene): DiscoveryMarker[] {
  const starTexture = createStarTexture();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#ffd868",
    transparent: true,
    opacity: 0.44,
    depthWrite: false
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: "#fff1a8",
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });

  return DISCOVERIES.map((entry) => {
    const accent = getDiscoveryAccent(entry);
    const markerX = entry.position.x * TOWN_SPREAD;
    const markerZ = entry.position.z * TOWN_SPREAD;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTexture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.position.set(markerX, 1.55, markerZ);
    sprite.scale.set(0.76, 0.76, 0.76);
    scene.add(sprite);

    const plinthMaterial = new THREE.MeshStandardMaterial({ color: "#fff4cf", roughness: 0.55 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.14, 12), plinthMaterial);
    plinth.position.set(markerX, 0.07, markerZ);
    plinth.castShadow = true;
    scene.add(plinth);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.02, 8, 48), ringMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(markerX, 0.045, markerZ);
    ring.renderOrder = 2;
    scene.add(ring);

    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.68, 40), haloMaterial.clone());
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(markerX, 0.034, markerZ);
    halo.renderOrder = 1;
    scene.add(halo);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.28, 2.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ffd868",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    beacon.position.set(markerX, 1.12, markerZ);
    beacon.renderOrder = 1;
    beacon.visible = false;
    beacon.userData.softShadow = true;
    scene.add(beacon);

    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createNumberBadgeTexture(entry),
        transparent: true,
        depthWrite: false
      })
    );
    badge.position.set(markerX, 2.08, markerZ);
    badge.scale.set(0.78, 0.3, 1);
    badge.visible = false;
    scene.add(badge);

    const savedSeal = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSavedSealTexture(accent),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0
      })
    );
    savedSeal.position.set(markerX, 1.08, markerZ);
    savedSeal.scale.set(0.78, 0.3, 1);
    savedSeal.renderOrder = 4;
    savedSeal.visible = false;
    scene.add(savedSeal);

    const calloutNextTexture = createWaypointCalloutTexture(entry, accent, false);
    const calloutTrackedTexture = createWaypointCalloutTexture(entry, accent, true);
    const calloutMaterial = new THREE.SpriteMaterial({
      map: calloutNextTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0
    });
    const callout = new THREE.Sprite(calloutMaterial);
    callout.position.set(markerX, 2.88, markerZ);
    callout.scale.set(3.35, 1.05, 1);
    callout.renderOrder = 5;
    callout.visible = false;
    scene.add(callout);

    return {
      entry,
      object: sprite,
      plinth,
      plinthMaterial,
      ring,
      halo,
      badge,
      savedSeal,
      beacon,
      callout,
      calloutMaterial,
      calloutNextTexture,
      calloutTrackedTexture
    };
  });
}

function createRouteBreadcrumbs(scene: THREE.Scene): RouteBreadcrumb[] {
  return Array.from({ length: 7 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: "#ffc83d",
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.21, 24), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.058;
    mesh.renderOrder = 3;
    mesh.visible = false;
    mesh.userData.softShadow = true;
    const railMaterial = new THREE.MeshBasicMaterial({
      color: "#ffc83d",
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 1), railMaterial);
    rail.position.y = 0.052;
    rail.renderOrder = 2;
    rail.visible = false;
    rail.userData.softShadow = true;
    scene.add(mesh);
    scene.add(rail);
    return { mesh, material, rail, railMaterial, phase: index * 0.55 };
  });
}

function createUnlockBurst(scene: THREE.Scene, marker: DiscoveryMarker, startedAt: number): UnlockBurst {
  const accent = getDiscoveryAccent(marker.entry);
  const group = new THREE.Group();
  group.position.set(marker.object.position.x, 0, marker.object.position.z);
  group.renderOrder = 4;
  scene.add(group);

  const rings = [0.42, 0.68].map((radius, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: index === 0 ? 0.62 : 0.38,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 56), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.08 + index * 0.025;
    mesh.renderOrder = 4;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return { mesh, material };
  });

  const sparks = Array.from({ length: 12 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index % 3 === 0 ? "#fff4cf" : accent,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? 0.055 : 0.04, 10, 8), material);
    mesh.renderOrder = 5;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return {
      mesh,
      material,
      angle: index * ((Math.PI * 2) / 12),
      radius: 0.65 + (index % 4) * 0.12,
      height: 0.55 + (index % 5) * 0.1
    };
  });

  return { group, startedAt, rings, sparks };
}

function updateUnlockBursts(scene: THREE.Scene, bursts: UnlockBurst[], time: number): void {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    const progress = THREE.MathUtils.clamp((time - burst.startedAt) / UNLOCK_BURST_DURATION, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const fade = 1 - progress;

    burst.rings.forEach((ring, ringIndex) => {
      ring.mesh.scale.setScalar(1 + eased * (1.5 + ringIndex * 0.7));
      ring.material.opacity = fade * (ringIndex === 0 ? 0.62 : 0.38);
    });

    burst.sparks.forEach((spark, sparkIndex) => {
      const drift = spark.radius * eased;
      spark.mesh.position.set(
        Math.cos(spark.angle) * drift,
        0.35 + Math.sin(progress * Math.PI) * spark.height + progress * 0.35,
        Math.sin(spark.angle) * drift
      );
      spark.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.9 + (sparkIndex % 2) * 0.12);
      spark.material.opacity = fade * 0.92;
    });

    if (progress >= 1) {
      disposeUnlockBurst(scene, burst);
      bursts.splice(index, 1);
    }
  }
}

function disposeUnlockBurst(scene: THREE.Scene, burst: UnlockBurst): void {
  scene.remove(burst.group);
  burst.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material.dispose();
    }
  });
}

function getDiscoveryAccent(entry: DiscoveryEntry): string {
  const colors: Record<DiscoveryEntry["theme"], string> = {
    "ai-agents": "#6fa6a0",
    saas: "#d78c75",
    sustainability: "#85ad6f",
    crypto: "#7f8eaa",
    devtools: "#f0c86b",
    founder: "#d2ad6a",
    story: "#ee765f"
  };
  return colors[entry.theme];
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

function toggleWaterTowerClimb(
  player: THREE.Group,
  motion: PlayerMotion,
  state: WaterTowerClimbState
): boolean {
  const towerX = WATER_TOWER_LOCATION.x * TOWN_SPREAD;
  const towerZ = WATER_TOWER_LOCATION.z * TOWN_SPREAD;
  const ladderZ = towerZ + WATER_TOWER_LADDER_Z_OFFSET;
  const distanceToLadder = Math.hypot(player.position.x - towerX, player.position.z - ladderZ);

  if (state.mode === "ground") {
    if (distanceToLadder > 1.3 || player.position.y > 0.35) return false;
    state.mode = "ascending";
    motion.verticalVelocity = 0;
    motion.grounded = false;
    return true;
  }

  if (state.mode === "platform") {
    const distanceToTower = Math.hypot(player.position.x - towerX, player.position.z - towerZ);
    if (distanceToTower > WATER_TOWER_PLATFORM_RADIUS + 0.35) return false;
    state.mode = "descending";
    motion.verticalVelocity = 0;
    motion.grounded = false;
    return true;
  }

  return true;
}

function updateWaterTowerClimb(
  player: THREE.Group,
  motion: PlayerMotion,
  state: WaterTowerClimbState,
  delta: number
): boolean {
  if (state.mode === "platform") {
    if (player.position.y < 0.5) state.mode = "ground";
    return false;
  }
  if (state.mode === "ground") return false;

  const towerX = WATER_TOWER_LOCATION.x * TOWN_SPREAD;
  const towerZ = WATER_TOWER_LOCATION.z * TOWN_SPREAD;
  const ladderZ = towerZ + WATER_TOWER_LADDER_Z_OFFSET;
  const climbSpeed = 2.55;
  const anchorBlend = 1 - Math.exp(-20 * delta);
  player.position.x = THREE.MathUtils.lerp(player.position.x, towerX, anchorBlend);
  player.position.z = THREE.MathUtils.lerp(player.position.z, ladderZ, anchorBlend);
  player.rotation.y = Math.PI;
  motion.facingAngle = Math.PI;
  motion.walkTime += delta * 6;

  if (state.mode === "ascending") {
    player.position.y = Math.min(WATER_TOWER_PLATFORM_HEIGHT, player.position.y + climbSpeed * delta);
    if (player.position.y >= WATER_TOWER_PLATFORM_HEIGHT) {
      state.mode = "platform";
      motion.grounded = true;
    }
  } else {
    player.position.y = Math.max(0, player.position.y - climbSpeed * delta);
    if (player.position.y <= 0) {
      player.position.set(towerX, 0, towerZ - WATER_TOWER_PLATFORM_RADIUS - PLAYER_RADIUS - 0.08);
      state.mode = "ground";
      motion.grounded = true;
    }
  }

  motion.verticalVelocity = 0;
  updatePlayerRig(player, motion.walkTime, true, false);
  return true;
}

function updatePlayer(
  player: THREE.Group,
  motion: PlayerMotion,
  input: ReturnType<typeof createInput>,
  delta: number,
  colliders: CollisionShape[],
  camera: THREE.PerspectiveCamera
): void {
  const forwardInput = THREE.MathUtils.clamp(Number(input.forward) - Number(input.backward) + input.moveY, -1, 1);
  const rightInput = THREE.MathUtils.clamp(Number(input.right) - Number(input.left) + input.moveX, -1, 1);
  const viewForward = new THREE.Vector3(
    player.position.x - camera.position.x,
    0,
    player.position.z - camera.position.z
  );
  if (viewForward.lengthSq() < 0.0001) viewForward.set(0, 0, -1);
  viewForward.normalize();
  const viewRight = new THREE.Vector3(-viewForward.z, 0, viewForward.x);
  const direction = viewForward.multiplyScalar(forwardInput).addScaledVector(viewRight, rightInput);

  if (input.jumpRequested) {
    input.jumpRequested = false;
    if (motion.grounded) {
      const jumpMultiplier = typeof player.userData.jumpMultiplier === "number" ? player.userData.jumpMultiplier : 1;
      motion.verticalVelocity = JUMP_VELOCITY * jumpMultiplier;
      motion.grounded = false;
    }
  }

  const movementStrength = Math.min(direction.length(), 1);
  if (movementStrength > 0) {
    direction.normalize();
    const walkMultiplier = typeof player.userData.walkMultiplier === "number" ? player.userData.walkMultiplier : 1;
    const sprintMultiplier = typeof player.userData.sprintMultiplier === "number" ? player.userData.sprintMultiplier : 1;
    const speed = input.sprint ? 7 * sprintMultiplier : 4.2 * walkMultiplier;
    const nextPosition = player.position.clone().addScaledVector(direction, speed * movementStrength * delta);
    const stepSurface = getWalkableSurfaceHeight(nextPosition, colliders, player.position.y + PLAYER_STEP_HEIGHT);
    if (motion.grounded && stepSurface > player.position.y + SURFACE_CLEARANCE) {
      nextPosition.y = stepSurface;
    }
    resolvePlayerCollisions(nextPosition, colliders);
    player.position.copy(nextPosition);
    const angle = Math.atan2(-direction.x, -direction.z);
    motion.facingAngle = turnToward(motion.facingAngle, angle, 32 * delta);
    player.rotation.y = motion.facingAngle;
    motion.walkTime += delta * (input.sprint ? 12 : 8.5);
    updatePlayerRig(player, motion.walkTime, true, input.sprint);
  } else {
    updatePlayerRig(player, motion.walkTime, false, false);
  }

  motion.verticalVelocity -= GRAVITY * delta;
  player.position.y += motion.verticalVelocity * delta;
  const floorHeight = getWalkableSurfaceHeight(player.position, colliders, Infinity);
  if (motion.verticalVelocity <= 0 && player.position.y <= floorHeight) {
    player.position.y = floorHeight;
    motion.verticalVelocity = 0;
    motion.grounded = true;
  } else {
    motion.grounded = false;
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
}

function resolvePlayerCollisions(position: THREE.Vector3, colliders: CollisionShape[]): void {
  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);

  for (const collider of colliders) {
    if (collider.top !== undefined && position.y >= collider.top - SURFACE_CLEARANCE) continue;
    if (collider.kind === "circle") {
      resolveCircleCollision(position, collider);
    } else {
      resolveBoxCollision(position, collider);
    }
  }

  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
}

function getWalkableSurfaceHeight(position: THREE.Vector3, colliders: CollisionShape[], maxHeight: number): number {
  let surfaceHeight = 0;
  for (const collider of colliders) {
    if (collider.top === undefined || collider.top > maxHeight) continue;
    if (isOnColliderSurface(position, collider)) {
      surfaceHeight = Math.max(surfaceHeight, collider.top);
    }
  }
  return surfaceHeight;
}

function isOnColliderSurface(position: THREE.Vector3, collider: CollisionShape): boolean {
  if (collider.kind === "circle") {
    const dx = position.x - collider.x;
    const dz = position.z - collider.z;
    const usableRadius = Math.max(0, collider.radius - PLAYER_RADIUS * 0.35);
    return dx * dx + dz * dz <= usableRadius * usableRadius;
  }

  return (
    Math.abs(position.x - collider.x) <= collider.width / 2 - PLAYER_RADIUS * 0.2 &&
    Math.abs(position.z - collider.z) <= collider.depth / 2 - PLAYER_RADIUS * 0.2
  );
}

function resolveCircleCollision(
  position: THREE.Vector3,
  collider: Extract<CollisionShape, { kind: "circle" }>
): void {
  const minimumDistance = PLAYER_RADIUS + collider.radius;
  const dx = position.x - collider.x;
  const dz = position.z - collider.z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= minimumDistance * minimumDistance) return;

  if (distanceSq < 0.0001) {
    position.x = collider.x + minimumDistance;
    return;
  }

  const distance = Math.sqrt(distanceSq);
  const push = minimumDistance - distance;
  position.x += (dx / distance) * push;
  position.z += (dz / distance) * push;
}

function resolveBoxCollision(
  position: THREE.Vector3,
  collider: Extract<CollisionShape, { kind: "box" }>
): void {
  const minX = collider.x - collider.width / 2 - PLAYER_RADIUS;
  const maxX = collider.x + collider.width / 2 + PLAYER_RADIUS;
  const minZ = collider.z - collider.depth / 2 - PLAYER_RADIUS;
  const maxZ = collider.z + collider.depth / 2 + PLAYER_RADIUS;

  if (position.x < minX || position.x > maxX || position.z < minZ || position.z > maxZ) return;

  const pushLeft = Math.abs(position.x - minX);
  const pushRight = Math.abs(maxX - position.x);
  const pushBack = Math.abs(position.z - minZ);
  const pushFront = Math.abs(maxZ - position.z);
  const smallestPush = Math.min(pushLeft, pushRight, pushBack, pushFront);

  if (smallestPush === pushLeft) {
    position.x = minX;
  } else if (smallestPush === pushRight) {
    position.x = maxX;
  } else if (smallestPush === pushBack) {
    position.z = minZ;
  } else {
    position.z = maxZ;
  }
}

function turnToward(current: number, target: number, maxStep: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

function updatePlayerRig(player: THREE.Group, walkTime: number, moving: boolean, sprinting = false): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig) return;

  const swing = moving ? Math.sin(walkTime) * 0.34 : 0;
  const settle = moving ? 0.26 : 0.16;
  rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, swing, settle);
  rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -swing, settle);
  rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, -swing * 0.78, settle);
  rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, swing * 0.78, settle);
  rig.torso.position.y = 0.98 + (moving ? Math.abs(Math.sin(walkTime)) * 0.025 : 0);

  rig.shadow.position.y = 0.012 - player.position.y;
  const shadowMaterial = rig.shadow instanceof THREE.Mesh ? rig.shadow.material : null;
  if (shadowMaterial instanceof THREE.MeshBasicMaterial) {
    shadowMaterial.opacity = THREE.MathUtils.clamp(0.25 - player.position.y * 0.11, 0.06, 0.25);
  }

  if (rig.personaAura && rig.personaAuraMaterial && rig.trailDots) {
    const auraPulse = 1 + Math.sin(walkTime * (moving ? 0.8 : 0.45)) * (moving ? 0.055 : 0.025);
    rig.personaAura.scale.setScalar((sprinting ? 1.16 : moving ? 1.04 : 0.94) * auraPulse);
    rig.personaAuraMaterial.opacity = moving ? (sprinting ? 0.38 : 0.26) : 0.13;

    rig.trailDots.forEach((dot, index) => {
      const pulse = Math.max(0, Math.sin(walkTime * 1.15 - dot.phase));
      const sprintBoost = sprinting ? 1.4 : 1;
      dot.mesh.scale.setScalar(0.72 + pulse * 0.8 * sprintBoost + index * 0.04);
      dot.material.opacity = moving ? (0.16 + pulse * (sprinting ? 0.58 : 0.36)) : 0.035;
    });
  }
}

function findNearestDiscovery(playerPosition: THREE.Vector3, markers: DiscoveryMarker[]): DiscoveryEntry | null {
  let nearest: DiscoveryEntry | null = null;
  let nearestDistance = INSPECT_RADIUS;

  for (const marker of markers) {
    const dx = playerPosition.x - marker.object.position.x;
    const dz = playerPosition.z - marker.object.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = marker.entry;
    }
  }

  return nearest;
}

function findNearestUndiscovered(
  playerPosition: THREE.Vector3,
  markers: DiscoveryMarker[],
  discovered: Set<string>
): { marker: DiscoveryMarker; distance: number; heading: string } | null {
  let nearest: DiscoveryMarker | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const marker of markers) {
    if (discovered.has(marker.entry.id)) continue;
    const dx = marker.object.position.x - playerPosition.x;
    const dz = marker.object.position.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearestDistance) {
      nearest = marker;
      nearestDistance = distance;
    }
  }

  if (!nearest) return null;
  return {
    marker: nearest,
    distance: nearestDistance,
    heading: getHeadingLabel(nearest.object.position.x - playerPosition.x, nearest.object.position.z - playerPosition.z)
  };
}

function findWaypointSelection(
  playerPosition: THREE.Vector3,
  markers: DiscoveryMarker[],
  discovered: Set<string>,
  selectedWaypointId: string | null
): { marker: DiscoveryMarker; distance: number; heading: string; tracked: boolean } | null {
  if (selectedWaypointId && !discovered.has(selectedWaypointId)) {
    const trackedMarker = markers.find((marker) => marker.entry.id === selectedWaypointId);
    if (trackedMarker) {
      const dx = trackedMarker.object.position.x - playerPosition.x;
      const dz = trackedMarker.object.position.z - playerPosition.z;
      return {
        marker: trackedMarker,
        distance: Math.hypot(dx, dz),
        heading: getHeadingLabel(dx, dz),
        tracked: true
      };
    }
  }

  const nearest = findNearestUndiscovered(playerPosition, markers, discovered);
  return nearest ? { ...nearest, tracked: false } : null;
}

function getHeadingLabel(dx: number, dz: number): string {
  const northSouth = dz < -0.75 ? "N" : dz > 0.75 ? "S" : "";
  const eastWest = dx > 0.75 ? "E" : dx < -0.75 ? "W" : "";
  return `${northSouth}${eastWest}` || "here";
}

function updateRouteBreadcrumbs(
  breadcrumbs: RouteBreadcrumb[],
  playerPosition: THREE.Vector3,
  waypoint: DiscoveryMarker | null,
  time: number,
  tracked: boolean
): void {
  if (!waypoint) {
    for (const breadcrumb of breadcrumbs) {
      breadcrumb.mesh.visible = false;
      breadcrumb.material.opacity = 0;
      breadcrumb.rail.visible = false;
      breadcrumb.railMaterial.opacity = 0;
    }
    return;
  }

  const direction = new THREE.Vector3(
    waypoint.object.position.x - playerPosition.x,
    0,
    waypoint.object.position.z - playerPosition.z
  );
  const distance = direction.length();
  if (distance < 1.35) {
    for (const breadcrumb of breadcrumbs) {
      breadcrumb.mesh.visible = false;
      breadcrumb.material.opacity = 0;
      breadcrumb.rail.visible = false;
      breadcrumb.railMaterial.opacity = 0;
    }
    return;
  }

  direction.normalize();
  const visibleDistance = Math.min(distance - 0.7, 7.2);
  const step = visibleDistance / (breadcrumbs.length + 0.5);
  const routeColor = tracked ? "#d2ad6a" : "#ffc83d";
  const routeGlow = tracked ? "#fff4cf" : "#ffd868";
  const angle = Math.atan2(direction.x, direction.z);

  breadcrumbs.forEach((breadcrumb, index) => {
    const travel = 0.72 + step * (index + 0.35);
    const fadeNearTarget = THREE.MathUtils.clamp((distance - travel) / 1.8, 0, 1);
    const pulse = 0.92 + Math.sin(time * 4.2 - breadcrumb.phase) * 0.12;
    const railLength = Math.max(0.34, step * 0.78);
    const railTravel = Math.max(0.55, travel - railLength * 0.48);
    const railPulse = 0.88 + Math.sin(time * 3.1 - breadcrumb.phase) * 0.08;
    const opacity = (0.52 - index * 0.035) * fadeNearTarget;
    breadcrumb.mesh.visible = true;
    breadcrumb.mesh.position.set(
      playerPosition.x + direction.x * travel,
      0.058 + index * 0.001,
      playerPosition.z + direction.z * travel
    );
    breadcrumb.mesh.scale.setScalar(pulse * (1 - index * 0.035));
    breadcrumb.material.color.set(index % 2 === 0 ? routeGlow : routeColor);
    breadcrumb.material.opacity = opacity;

    breadcrumb.rail.visible = true;
    breadcrumb.rail.position.set(
      playerPosition.x + direction.x * railTravel,
      0.052 + index * 0.001,
      playerPosition.z + direction.z * railTravel
    );
    breadcrumb.rail.rotation.y = angle;
    breadcrumb.rail.scale.set(1 + (tracked ? 0.34 : 0.18) * railPulse, 1, railLength);
    breadcrumb.railMaterial.color.set(routeColor);
    breadcrumb.railMaterial.opacity = opacity * (tracked ? 0.92 : 0.72);
  });
}

function updateMarkers(
  markers: DiscoveryMarker[],
  discovered: Set<string>,
  time: number,
  waypointId: string | null,
  waypointTracked: boolean,
  playerPosition: THREE.Vector3
): void {
  for (const marker of markers) {
    const unlocked = discovered.has(marker.entry.id);
    const isWaypoint = marker.entry.id === waypointId;
    const dx = marker.object.position.x - playerPosition.x;
    const dz = marker.object.position.z - playerPosition.z;
    const isNearby = dx * dx + dz * dz < 18;
    const scale = unlocked
      ? 0.48
      : isWaypoint
        ? 0.78 + Math.sin(time * 4 + marker.entry.number) * 0.06
        : 0.52 + Math.sin(time * 3 + marker.entry.number) * 0.035;
    marker.object.scale.setScalar(scale);
    marker.object.position.y =
      (unlocked ? 1.32 : 1.55) + Math.sin(time * (isWaypoint ? 3.1 : 2.4) + marker.entry.number) * (isWaypoint ? 0.18 : 0.12);
    marker.badge.position.y = marker.object.position.y + 0.5;
    marker.savedSeal.position.y = 1.08 + Math.sin(time * 1.8 + marker.entry.number) * 0.03;
    const badgeScale = unlocked ? 0.68 : isWaypoint ? 0.98 : 0.82;
    marker.badge.scale.set(0.78 * badgeScale, 0.3 * badgeScale, 1);
    marker.plinth.scale.set(unlocked ? 1.18 : 1, unlocked ? 0.82 : 1, unlocked ? 1.18 : 1);
    marker.plinthMaterial.color.set(unlocked ? "#dfe9d1" : "#fff4cf");
    marker.plinthMaterial.roughness = unlocked ? 0.72 : 0.55;

    const pulse = 1 + Math.sin(time * 2.5 + marker.entry.number) * 0.08;
    marker.ring.scale.setScalar(unlocked ? 0.88 : isWaypoint ? 1.34 + Math.sin(time * 3.4) * 0.1 : pulse);
    marker.halo.scale.setScalar(
      unlocked ? 0.72 : isWaypoint ? 1.55 + Math.sin(time * 2.7) * 0.16 : 1.05 + Math.sin(time * 2 + marker.entry.number) * 0.1
    );
    const ringMaterial = marker.ring.material;
    const haloMaterial = marker.halo.material;
    if (ringMaterial instanceof THREE.MeshBasicMaterial) {
      ringMaterial.opacity = unlocked ? 0.1 : isWaypoint ? 0.58 : isNearby ? 0.28 : 0.08;
    }
    if (haloMaterial instanceof THREE.MeshBasicMaterial) {
      haloMaterial.opacity = unlocked ? 0.04 : isWaypoint ? 0.2 : isNearby ? 0.1 : 0.025;
    }
    const badgeMaterial = marker.badge.material;
    marker.badge.visible = isNearby || isWaypoint;
    if (badgeMaterial instanceof THREE.SpriteMaterial) {
      badgeMaterial.opacity = unlocked ? 0.38 : isWaypoint ? 0.9 : 0.72;
    }
    const spriteMaterial = marker.object instanceof THREE.Sprite ? marker.object.material : null;
    if (spriteMaterial instanceof THREE.SpriteMaterial) {
      spriteMaterial.opacity = unlocked ? 0.25 : isWaypoint ? 0.92 : isNearby ? 0.62 : 0.28;
    }
    marker.savedSeal.visible = unlocked && isNearby;
    const savedSealMaterial = marker.savedSeal.material;
    if (savedSealMaterial instanceof THREE.SpriteMaterial) {
      savedSealMaterial.opacity = unlocked ? 0.94 : 0;
    }
    marker.savedSeal.scale.set(0.78 + Math.sin(time * 2 + marker.entry.number) * 0.016, 0.3, 1);
    marker.beacon.visible = false;
    marker.beacon.rotation.y = time * 0.45;
    marker.beacon.scale.setScalar(isWaypoint ? 1 + Math.sin(time * 2.1) * 0.06 : 1);
    const beaconMaterial = marker.beacon.material;
    if (beaconMaterial instanceof THREE.MeshBasicMaterial) {
      beaconMaterial.opacity = 0;
    }
    marker.callout.visible = false;
    const calloutOffsetX = marker.object.position.x < -1 ? 5.2 : marker.object.position.x > 1 ? -2.6 : 2.2;
    const calloutOffsetZ = marker.object.position.z > 0 ? -0.9 : 0.72;
    marker.callout.position.set(
      marker.object.position.x + calloutOffsetX,
      marker.object.position.y + 1.22 + Math.sin(time * 1.9 + marker.entry.number) * 0.04,
      marker.object.position.z + calloutOffsetZ
    );
    marker.callout.scale.setScalar(isWaypoint ? 1 + Math.sin(time * 2.2 + marker.entry.number) * 0.025 : 1);
    marker.callout.scale.x *= 3.35;
    marker.callout.scale.y *= 1.05;
    const calloutMap = waypointTracked && isWaypoint ? marker.calloutTrackedTexture : marker.calloutNextTexture;
    if (marker.calloutMaterial.map !== calloutMap) {
      marker.calloutMaterial.map = calloutMap;
      marker.calloutMaterial.needsUpdate = true;
    }
    marker.calloutMaterial.opacity = 0;
  }
}

function updateCitizens(citizens: Citizen[], time: number, playerPosition: THREE.Vector3): void {
  for (const citizen of citizens) {
    const angle = time * citizen.speed + citizen.phase;
    const nextX = citizen.origin.x + Math.cos(angle) * citizen.radius;
    const nextZ = citizen.origin.z + Math.sin(angle) * citizen.radius * 0.58;
    const tangentX = -Math.sin(angle);
    const tangentZ = Math.cos(angle) * 0.58;
    citizen.object.position.set(nextX, 0, nextZ);
    citizen.object.rotation.y = Math.atan2(-tangentX, -tangentZ);
    updatePlayerRig(citizen.object, time * 8 + citizen.phase, true);
    const speechWave = Math.sin(time * 0.9 + citizen.phase * 1.7);
    const speechOpacity = THREE.MathUtils.smoothstep(speechWave, 0.15, 0.92) * 0.62;
    const distance = citizen.object.position.distanceTo(playerPosition);
    citizen.speechMaterial.opacity = distance < 3.4 ? 0.12 + speechOpacity : 0;
  }
}

function updateAtmosphere(atmosphere: AtmosphereObject[], delta: number): void {
  for (const item of atmosphere) {
    item.object.position.x += item.speed * delta;
    if (item.object.position.x > 38) {
      item.object.position.x = -38;
    }
  }
}

function updateTownAnimals(animals: TownAnimal[], time: number, delta: number): void {
  for (const animal of animals) {
    const toTarget = new THREE.Vector3().subVectors(animal.target, animal.object.position);
    toTarget.y = 0;
    if (toTarget.lengthSq() < 0.35 || time >= animal.nextDecision) {
      const choices = animal.waypoints.filter((point) => point.distanceToSquared(animal.target) > 1);
      animal.target.copy(choices[Math.floor(Math.random() * choices.length)] ?? animal.waypoints[0]);
      animal.nextDecision = time + 5 + Math.random() * 7;
      toTarget.subVectors(animal.target, animal.object.position).setY(0);
    }

    const desiredVelocity = toTarget.lengthSq() > 0.001
      ? toTarget.normalize().multiplyScalar(animal.speed)
      : new THREE.Vector3();
    animal.velocity.lerp(desiredVelocity, 1 - Math.exp(-3.2 * delta));
    animal.object.position.addScaledVector(animal.velocity, delta);
    animal.object.position.y = Math.sin(time * 8.5 + animal.phase) * animal.bob;

    if (animal.velocity.lengthSq() > 0.01) {
      const angle = Math.atan2(-animal.velocity.x, -animal.velocity.z);
      animal.object.rotation.y = turnToward(animal.object.rotation.y, angle, 5.5 * delta);
    }

    const gait = Math.sin(time * animal.speed * 11 + animal.phase);
    const legs = animal.object.userData.legs as THREE.Group[] | undefined;
    legs?.forEach((leg, index) => {
      leg.rotation.x = gait * (index % 2 === 0 ? 0.42 : -0.42);
    });
    const tail = animal.object.userData.tail as THREE.Object3D | undefined;
    if (tail) tail.rotation.z = Math.sin(time * 8 + animal.phase) * 0.32;
  }
}

function updateFootball(ball: TownBall, player: THREE.Group, delta: number): boolean {
  ball.goalCooldown = Math.max(0, ball.goalCooldown - delta);
  if (ball.lastPlayerPosition.lengthSq() === 0) {
    ball.lastPlayerPosition.copy(player.position);
  }
  const playerMovement = new THREE.Vector3().subVectors(player.position, ball.lastPlayerPosition).setY(0);
  const fromPlayer = new THREE.Vector3().subVectors(ball.object.position, player.position).setY(0);
  const contactDistance = PLAYER_RADIUS + ball.radius + 0.16;
  if (fromPlayer.lengthSq() < contactDistance * contactDistance && playerMovement.lengthSq() > 0.00002) {
    const kickDirection = fromPlayer.lengthSq() > 0.001 ? fromPlayer.normalize() : playerMovement.clone().normalize();
    const playerSpeed = playerMovement.length() / Math.max(delta, 0.001);
    ball.velocity.addScaledVector(kickDirection, 2.6 + Math.min(playerSpeed * 0.62, 4.2));
  }
  ball.lastPlayerPosition.copy(player.position);

  ball.velocity.multiplyScalar(Math.exp(-1.28 * delta));
  const previousPosition = ball.object.position.clone();
  const movement = ball.velocity.clone().multiplyScalar(delta);
  ball.object.position.add(movement);
  ball.object.rotation.z -= movement.x / ball.radius;
  ball.object.rotation.x += movement.z / ball.radius;

  const minX = ball.center.x - ball.halfWidth + ball.radius;
  const maxX = ball.center.x + ball.halfWidth - ball.radius;
  const minZ = ball.center.z - ball.halfDepth + ball.radius;
  const maxZ = ball.center.z + ball.halfDepth - ball.radius;
  const goalHalfMouth = ball.goalHalfWidth - ball.radius;
  const inGoalMouth = Math.abs(ball.object.position.z - ball.center.z) <= goalHalfMouth;
  const leftGoalLine = ball.center.x - ball.halfWidth;
  const rightGoalLine = ball.center.x + ball.halfWidth;
  const leftNetLimit = leftGoalLine - ball.goalNetDepth;
  const rightNetLimit = rightGoalLine + ball.goalNetDepth;
  const scoredLeft =
    ball.goalCooldown === 0 &&
    inGoalMouth &&
    ball.velocity.x < 0 &&
    previousPosition.x >= leftGoalLine &&
    ball.object.position.x < leftGoalLine;
  const scoredRight =
    ball.goalCooldown === 0 &&
    inGoalMouth &&
    ball.velocity.x > 0 &&
    previousPosition.x <= rightGoalLine &&
    ball.object.position.x > rightGoalLine;

  if (scoredLeft || scoredRight) {
    ball.goalCooldown = 1.2;
  }

  const canTravelThroughGoal =
    inGoalMouth && ball.object.position.x >= leftNetLimit && ball.object.position.x <= rightNetLimit;
  if (!canTravelThroughGoal && (ball.object.position.x < minX || ball.object.position.x > maxX)) {
    ball.object.position.x = THREE.MathUtils.clamp(ball.object.position.x, minX, maxX);
    ball.velocity.x *= -0.72;
  }
  if (ball.object.position.x < leftNetLimit || ball.object.position.x > rightNetLimit) {
    ball.object.position.x = THREE.MathUtils.clamp(ball.object.position.x, leftNetLimit, rightNetLimit);
    ball.velocity.x *= -0.52;
  }
  if (ball.object.position.z < minZ || ball.object.position.z > maxZ) {
    ball.object.position.z = THREE.MathUtils.clamp(ball.object.position.z, minZ, maxZ);
    ball.velocity.z *= -0.72;
  }
  ball.object.position.y = ball.radius + 0.025;
  return scoredLeft || scoredRight;
}

function updateSakuraPetals(petals: SakuraPetal[], time: number): void {
  for (const petal of petals) {
    const fallSpan = 7.5;
    const wrappedHeight = ((petal.origin.y - time * petal.fallSpeed + petal.phase) % fallSpan + fallSpan) % fallSpan;
    petal.mesh.position.set(
      petal.origin.x + Math.sin(time * 0.7 + petal.phase) * petal.drift,
      0.35 + wrappedHeight,
      petal.origin.z + Math.cos(time * 0.52 + petal.phase * 1.4) * petal.drift
    );
    petal.mesh.rotation.x = time * 1.1 + petal.phase;
    petal.mesh.rotation.y = time * 0.7 + petal.phase * 0.6;
    petal.mesh.rotation.z = Math.sin(time * 1.7 + petal.phase) * 0.85;
  }
}

function updateFireflies(fireflies: Firefly[], time: number): void {
  for (const firefly of fireflies) {
    const phase = time * firefly.speed + firefly.phase;
    firefly.sprite.position.set(
      firefly.origin.x + Math.cos(phase) * firefly.radius,
      firefly.origin.y + Math.sin(phase * 1.7) * 0.28,
      firefly.origin.z + Math.sin(phase * 0.78) * firefly.radius
    );
    const pulse = 0.72 + Math.sin(phase * 2.6) * 0.28;
    firefly.sprite.material.opacity = 0.48 + pulse * 0.44;
    firefly.sprite.scale.setScalar(0.18 + pulse * 0.2);
  }
}

function getGameplayCameraPosition(target: THREE.Vector3, look: CameraLookState): THREE.Vector3 {
  look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, 0.12);
  look.distance = THREE.MathUtils.lerp(look.distance, look.targetDistance, 0.12);
  const offset = CAMERA_OFFSET.clone().setLength(look.distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
  return new THREE.Vector3(target.x + offset.x, target.y + offset.y, target.z + offset.z);
}

function updateCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, look: CameraLookState): void {
  const desired = getGameplayCameraPosition(target, look);
  camera.position.lerp(desired, 0.075);
  camera.lookAt(target.x, 0.82, target.z);
}

function updateWaterTowerCamera(camera: THREE.PerspectiveCamera, look: CameraLookState): void {
  look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, 0.09);
  look.distance = THREE.MathUtils.lerp(look.distance, look.targetDistance, 0.09);

  const tower = new THREE.Vector3(
    WATER_TOWER_LOCATION.x * TOWN_SPREAD,
    WATER_TOWER_PLATFORM_HEIGHT,
    WATER_TOWER_LOCATION.z * TOWN_SPREAD
  );
  const townFocus = new THREE.Vector3(-0.8, 1.15, 0.8);
  const townFacingAngle = Math.atan2(townFocus.z - tower.z, townFocus.x - tower.x) + look.yaw * 0.42;
  const zoomProgress = THREE.MathUtils.inverseLerp(CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, look.distance);
  const overlookDistance = THREE.MathUtils.lerp(8.6, 13.2, zoomProgress);
  const desired = tower
    .clone()
    .add(new THREE.Vector3(Math.cos(townFacingAngle), 0, Math.sin(townFacingAngle)).multiplyScalar(overlookDistance));
  desired.y += THREE.MathUtils.lerp(3.6, 5.3, zoomProgress);

  camera.position.lerp(desired, 0.065);
  camera.lookAt(townFocus);
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

function createLabelSign(text: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create sign canvas");

  context.fillStyle = "#f7ecd8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#9e7750";
  context.lineWidth = 12;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = "#3e352a";
  context.font = "700 34px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  sign.rotation.x = -0.15;
  return sign;
}

function createTownWelcomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1120;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create town welcome sign texture");

  context.fillStyle = "#fff3dc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#744d31";
  context.lineWidth = 20;
  context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  context.strokeStyle = "#c69a5c";
  context.lineWidth = 8;
  context.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);
  context.fillStyle = "#4b3829";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 48px Georgia, serif";
  context.fillText("THE 100TH", canvas.width / 2, 102);
  context.font = "700 70px Georgia, serif";
  context.fillText("HACKATHONER VILLE", canvas.width / 2, 186);
  context.fillStyle = "#a35b43";
  context.font = "700 31px Arial, sans-serif";
  context.fillText("19 OF 100 SHIPPED", canvas.width / 2, 265);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create star canvas");

  context.clearRect(0, 0, 128, 128);
  context.shadowColor = "#ffd45e";
  context.shadowBlur = 20;
  context.fillStyle = "#ffc83d";
  context.beginPath();

  const centerX = 64;
  const centerY = 64;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 48 : 20;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNumberBadgeTexture(entry: DiscoveryEntry): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create marker badge canvas");

  const label = entry.number === 0 ? "START" : `#${entry.number.toString().padStart(2, "0")}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.28)";
  context.shadowBlur = 14;
  roundRect(context, 18, 14, 220, 64, 18);
  context.fillStyle = "#fffaf0";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = "#ffc83d";
  context.stroke();
  context.fillStyle = "#3e352a";
  context.font = entry.number === 0 ? "800 28px Inter, sans-serif" : "900 34px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaypointCalloutTexture(entry: DiscoveryEntry, accent: string, tracked: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 168;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create waypoint callout canvas");

  const label = tracked ? "TRACKED STORY" : "NEXT STORY";
  const number = entry.number === 0 ? "START" : `#${entry.number.toString().padStart(3, "0")}`;
  const titleLines = splitCanvasLines(context, entry.title, 330, "900 34px Georgia, serif", 2);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.3)";
  context.shadowBlur = 18;
  roundRect(context, 20, 18, 472, 128, 18);
  context.fillStyle = tracked ? "rgba(255, 250, 240, 0.96)" : "rgba(255, 250, 240, 0.93)";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = tracked ? "#d2ad6a" : accent;
  context.stroke();

  context.fillStyle = tracked ? "#8d6428" : accent;
  context.font = "900 20px Inter, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, 44, 48);

  context.fillStyle = "#6f675a";
  context.font = "900 18px Inter, sans-serif";
  context.textAlign = "right";
  context.fillText(number, 468, 48);

  context.fillStyle = "#2f2922";
  context.font = "900 34px Georgia, serif";
  context.textAlign = "left";
  titleLines.forEach((line, index) => {
    context.fillText(line, 44, 87 + index * 35);
  });

  context.fillStyle = "#71685b";
  context.font = "800 18px Inter, sans-serif";
  context.fillText(entry.district, 44, titleLines.length > 1 ? 148 : 126);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCitizenSpeechTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create citizen speech canvas");

  const line = splitCanvasLines(context, text.toUpperCase(), 340, "900 32px Inter, sans-serif", 1)[0];

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.26)";
  context.shadowBlur = 16;
  roundRect(context, 42, 22, 428, 88, 20);
  context.fillStyle = "rgba(255, 250, 240, 0.95)";
  context.fill();
  context.beginPath();
  context.moveTo(224, 108);
  context.lineTo(256, 136);
  context.lineTo(276, 108);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  roundRect(context, 42, 22, 428, 88, 20);
  context.lineWidth = 5;
  context.strokeStyle = accent;
  context.stroke();

  context.fillStyle = accent;
  context.font = "900 16px Inter, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("TOWN SIGNAL", 64, 48);

  context.fillStyle = "#2f2922";
  context.font = "900 32px Inter, sans-serif";
  context.fillText(line, 64, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSavedSealTexture(accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create saved seal canvas");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.22)";
  context.shadowBlur = 12;
  roundRect(context, 28, 20, 200, 56, 18);
  context.fillStyle = "#fffaf0";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = accent;
  context.stroke();

  context.fillStyle = accent;
  context.beginPath();
  context.arc(64, 48, 15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fffaf0";
  context.font = "900 18px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("OK", 64, 49);

  context.fillStyle = "#3e352a";
  context.font = "900 24px Inter, sans-serif";
  context.textAlign = "left";
  context.fillText("SAVED", 88, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function splitCanvasLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  maxLines: number
): string[] {
  context.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push(text);

  const lastIndex = lines.length - 1;
  while (context.measureText(lines[lastIndex]).width > maxWidth && lines[lastIndex].length > 4) {
    lines[lastIndex] = `${lines[lastIndex].slice(0, -4).trim()}...`;
  }

  return lines;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
