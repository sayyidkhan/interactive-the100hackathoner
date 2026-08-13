import * as THREE from "three";
import type { WorldDefinition } from "../../engine/world";
import { discoverKingdomLandmark, loadKingdomProgress, saveKingdomProgress } from "../../engine/progress";
import { createWorldRuntime } from "../../engine/runtime";
import { bindInput } from "../../systems/input";
import { applyCharacterAppearance, createPlayer, updatePlayerRig } from "../../world/characters";
import { bindLookControls, initializeGameplayCamera, updateGameplayCamera } from "../../world/camera/gameplay";
import { updatePlayerMovement, type PlayerMotion } from "../../world/player/movement";
import { applySceneShadows } from "../../world/rendering/shadows";
import { COASTAL_LANDMARKS, type CoastalLandmark } from "./content";
import { coastalShoreX, createCoastalScene } from "./scene";
import { createCoastalHud } from "./ui";
import {
  DEFAULT_COASTAL_ENVIRONMENT,
  formatSingaporeTime,
  resolveCoastalPalette,
  type CoastalEnvironmentState
} from "./environment";
import { loadTownSchemaDraft, saveTownSchemaDraft, type EnvironmentSettings } from "../../data/townSchema";

export const KAIRUI_WORLD: WorldDefinition = {
  id: "kairui",
  name: "Kairui Kingdom",
  description: "A cinematic coastal hackathon archipelago and operator journal.",
  routes: [
    { path: "/worlds/kairui", mode: "explore" },
    { path: "/coast", mode: "explore" }
  ],
  mount(root) {
    mountKairuiKingdom(root);
  }
};

export function mountKairuiKingdom(root: HTMLElement): void {
  root.className = "game-root coastal-root";
  root.dataset.world = "kairui";
  root.dataset.worldMode = "explore";

  const runtime = createWorldRuntime(root, {
    background: "#f3deb7",
    fog: { color: "#e8d5b6", near: 95, far: 540 },
    camera: { fov: 48, far: 1600 },
    exposure: 0.88,
    environmentIntensity: 0.28
  });
  const { scene, camera, renderer } = runtime;

  const hemisphere = new THREE.HemisphereLight("#fff1d7", "#517a6a", 0.78);
  scene.add(hemisphere);
  const sunDirection = new THREE.Vector3(-0.55, 0.6, 0.38).normalize();
  const sun = new THREE.DirectionalLight("#ffe0ad", 1.16);
  sun.position.copy(sunDirection).multiplyScalar(190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -108;
  sun.shadow.camera.right = 108;
  sun.shadow.camera.top = 108;
  sun.shadow.camera.bottom = -108;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(sun.target);
  const coolFill = new THREE.DirectionalLight("#cfe0e8", 0.22);
  coolFill.position.set(140, 60, -80);
  scene.add(coolFill);

  const coast = createCoastalScene(scene);
  coast.setSunDirection(sunDirection);
  const townSchema = loadTownSchemaDraft();
  const player = createPlayer();
  applyCharacterAppearance(player, townSchema.player.appearance, townSchema.player.movement);
  // Begin on the upper headland so the coast, landmarks and ocean read as one
  // authored vista instead of dropping the visitor behind the first building.
  player.position.set(68, coast.getGroundHeight(68, -18), -18);
  player.rotation.y = -Math.PI / 2;
  scene.add(player);
  applySceneShadows(player);

  const inputBinding = bindInput();
  const input = inputBinding.state;
  const motion: PlayerMotion = {
    verticalVelocity: 0,
    grounded: true,
    facingAngle: Math.PI,
    walkTime: 0,
    velocity: new THREE.Vector3(),
    speed: 0
  };
  initializeGameplayCamera(camera, player.position);
  const look = bindLookControls(renderer.domElement);
  look.yaw = Math.PI;
  look.targetYaw = Math.PI;
  look.pitch = 0.34;
  look.targetPitch = 0.34;
  look.distance = 18;
  look.targetDistance = 18;

  const saved = loadKingdomProgress();
  saved.lastWorld = "kairui";
  saveKingdomProgress(saved);
  const validDiscoveryKeys = new Set(COASTAL_LANDMARKS.map((landmark) => `kairui:${landmark.id}`));
  const discovered = new Set(saved.discoveries.filter((id) => validDiscoveryKeys.has(id)));
  let nearby: CoastalLandmark | null = null;
  let tourActive = false;
  let tourIndex = 0;
  let tourTravelling = false;
  const tourCameraFrom = new THREE.Vector3();
  const tourCameraTo = new THREE.Vector3();
  const tourLookFrom = new THREE.Vector3();
  const tourLookTo = new THREE.Vector3();
  const tourLookCurrent = new THREE.Vector3();
  let tourTransitionStartedAt = 0;
  const tourTransitionDuration = 1850;
  let tourEnvironmentBefore: CoastalEnvironmentState | null = null;
  let environment: CoastalEnvironmentState = coastalEnvironmentFromTown(townSchema.environment);
  let environmentStamp = "";
  let transitMode: "none" | "boat" | "balloon" = "none";
  let transitStartedAt = 0;
  let establishing = true;
  const establishingStartedAt = performance.now();
  const vistaStart = new THREE.Vector3(-62, 24, 92);
  const vistaEnd = new THREE.Vector3(-34, 13, 60);
  const vistaTarget = new THREE.Vector3(27, 5, 6);
  camera.position.copy(vistaStart);
  camera.lookAt(vistaTarget);
  let hud: ReturnType<typeof createCoastalHud>;
  const dismissEstablishing = () => {
    establishing = false;
    root.classList.add("coastal-established");
    camera.position.copy(vistaEnd);
    camera.lookAt(player.position.x, player.position.y + 0.82, player.position.z);
    hud.setEstablishing(false);
  };

  const applyEnvironment = () => {
    const palette = resolveCoastalPalette(environment);
    coast.applyEnvironment(environment, palette);
    hemisphere.color.set(palette.hemisphereSky);
    hemisphere.groundColor.set(palette.hemisphereGround);
    hemisphere.intensity = palette.hemisphereIntensity;
    sun.color.set(palette.sunlight);
    sun.intensity = palette.sunIntensity;
    renderer.toneMappingExposure = palette.exposure;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.set(palette.fog);
    scene.background = new THREE.Color(palette.skyHorizon);
    hud.setEnvironment(environment, formatSingaporeTime(), palette.isNight);
  };

  const inspectNearby = (forcedTarget?: CoastalLandmark) => {
    const target = forcedTarget ?? nearby ?? (tourActive ? COASTAL_LANDMARKS[tourIndex] : null);
    if (!target) return;
    const key = `kairui:${target.id}`;
    const isNew = !discovered.has(key);
    discovered.add(key);
    discoverKingdomLandmark(key, "kairui");
    hud.setProgress(discovered, COASTAL_LANDMARKS.length);
    hud.openLandmark(target, isNew);
  };
  const beginTourLeg = (index: number) => {
    tourIndex = (index + COASTAL_LANDMARKS.length) % COASTAL_LANDMARKS.length;
    const anchor = coast.landmarks[tourIndex];
    const landmark = anchor.landmark;
    tourCameraFrom.copy(camera.position);
    if (tourLookCurrent.lengthSq() > 0) tourLookFrom.copy(tourLookCurrent);
    else tourLookFrom.copy(player.position).add(new THREE.Vector3(0, 1.2, 0));
    tourCameraTo.copy(safeCameraPosition(
      anchor.object.position.clone().add(new THREE.Vector3(...landmark.shotOffset)),
      coast.getGroundHeight,
      4.8
    ));
    tourLookTo.copy(anchor.object.position).add(new THREE.Vector3(...landmark.lookOffset));
    tourTransitionStartedAt = performance.now();
    tourTravelling = true;
    hud.closeLandmark();
    hud.setTour(true, anchor.landmark);
    environment = { ...environment, time: landmark.tourTime };
    applyEnvironment();
  };
  const setTour = (active: boolean) => {
    tourActive = active;
    if (active) {
      establishing = false;
      root.classList.add("coastal-established", "coastal-autopilot");
      transitMode = "none";
      hud.setTransit("none");
      tourEnvironmentBefore = { ...environment };
      player.visible = false;
      const firstUndiscovered = COASTAL_LANDMARKS.findIndex((item) => !discovered.has(`kairui:${item.id}`));
      beginTourLeg(firstUndiscovered >= 0 ? firstUndiscovered : 0);
    } else {
      tourTravelling = false;
      root.classList.remove("coastal-autopilot");
      player.visible = true;
      updatePlayerRig(player, motion.walkTime, false);
      hud.setTour(false, null);
      if (tourEnvironmentBefore) {
        environment = tourEnvironmentBefore;
        tourEnvironmentBefore = null;
        applyEnvironment();
      }
    }
  };
  const moveTour = (step: number) => {
    if (!tourActive) return;
    beginTourLeg(tourIndex + step);
  };
  hud = createCoastalHud(root, {
    onEnterWorld: dismissEstablishing,
    onInspect: inspectNearby,
    onTourToggle: () => setTour(!tourActive),
    onTourPrevious: () => moveTour(-1),
    onTourNext: () => moveTour(1),
    onTourSelect: (index) => {
      if (!tourActive) {
        setTour(true);
        if (tourIndex !== index) beginTourLeg(index);
      } else {
        beginTourLeg(index);
      }
    },
    onEnvironmentChange: (next) => {
      environment = next;
      const latestTown = loadTownSchemaDraft();
      latestTown.environment = townEnvironmentFromCoast(next, latestTown.environment);
      saveTownSchemaDraft(latestTown);
      applyEnvironment();
    },
    onTransit: (mode) => {
      transitMode = transitMode === mode ? "none" : mode;
      transitStartedAt = runtime.clock.elapsedTime;
      hud.setTransit(transitMode);
    }
  });
  hud.setProgress(discovered, COASTAL_LANDMARKS.length);
  hud.setTour(false, null);
  hud.setTransit("none");
  hud.setEstablishing(true);
  applyEnvironment();

  runtime.start(({ delta, elapsed }) => {
    if (!hud.isModalOpen() && transitMode === "none" && !establishing && !tourActive) {
      updatePlayerMovement(
        player,
        motion,
        input,
        delta,
        coast.colliders,
        camera,
        updatePlayerRig,
        coast.getGroundHeight,
        145,
        coast.isWalkable
      );
    } else {
      input.jumpRequested = false;
      input.inspectRequested = false;
    }

    let closest: CoastalLandmark | null = null;
    let closestDistance = 3.1;
    for (const anchor of coast.landmarks) {
      const distance = player.position.distanceTo(anchor.object.position);
      if (distance < closestDistance) {
        closest = anchor.landmark;
        closestDistance = distance;
      }
    }
    if (closest !== nearby) {
      nearby = closest;
      hud.setNearby(nearby);
      root.dataset.nearbyLandmark = nearby?.id ?? "";
    }
    if (input.inspectRequested) {
      input.inspectRequested = false;
      inspectNearby();
    }

    coast.update(elapsed, delta);
    const minuteStamp = new Date().toISOString().slice(0, 16);
    if (environment.time === "live" && minuteStamp !== environmentStamp) {
      environmentStamp = minuteStamp;
      applyEnvironment();
    }
    if (tourActive && tourTravelling && !hud.isModalOpen()) {
      const targetAnchor = coast.landmarks[tourIndex];
      const transition = THREE.MathUtils.clamp((performance.now() - tourTransitionStartedAt) / tourTransitionDuration, 0, 1);
      const eased = transition < 0.5
        ? 4 * transition * transition * transition
        : 1 - Math.pow(-2 * transition + 2, 3) / 2;
      camera.position.lerpVectors(tourCameraFrom, tourCameraTo, eased);
      keepCameraClear(camera.position, coast.getGroundHeight, 4.8);
      tourLookCurrent.lerpVectors(tourLookFrom, tourLookTo, THREE.MathUtils.smoothstep(transition, 0, 1));
      camera.lookAt(tourLookCurrent);
      if (transition >= 1) {
        tourTravelling = false;
        inspectNearby(targetAnchor.landmark);
      }
      coast.setTourRoute(targetAnchor.object.position, null);
    } else {
      coast.setTourRoute(player.position, null);
    }
    const establishingProgress = THREE.MathUtils.clamp((performance.now() - establishingStartedAt) / 4800, 0, 1);
    if (establishing && establishingProgress < 1) {
      const eased = THREE.MathUtils.smoothstep(establishingProgress, 0, 1);
      camera.position.lerpVectors(vistaStart, vistaEnd, eased);
      keepCameraClear(camera.position, coast.getGroundHeight, 6);
      camera.lookAt(vistaTarget.clone().lerp(player.position, eased * 0.58));
    } else if (establishing) {
      camera.position.lerp(vistaEnd, 1 - Math.exp(-2.4 * delta));
      keepCameraClear(camera.position, coast.getGroundHeight, 6);
      camera.lookAt(vistaTarget);
    } else if (tourActive) {
      const targetAnchor = coast.landmarks[tourIndex];
      const drift = Math.sin(elapsed * 0.22 + tourIndex) * 0.22;
      camera.position.lerp(
        tourCameraTo.clone().add(new THREE.Vector3(drift, Math.cos(elapsed * 0.18) * 0.09, -drift * 0.32)),
        1 - Math.exp(-2.5 * delta)
      );
      keepCameraClear(camera.position, coast.getGroundHeight, 4.8);
      tourLookCurrent.lerp(tourLookTo, 1 - Math.exp(-2.5 * delta));
      camera.lookAt(tourLookCurrent);
      player.visible = false;
    } else if (transitMode === "boat") {
      const phase = (elapsed - transitStartedAt) * 0.24;
      const target = new THREE.Vector3(-18 + Math.cos(phase) * 32, 0.55, -24 + Math.sin(phase) * 76);
      camera.position.lerp(new THREE.Vector3(target.x - 12, 11, target.z + 16), 1 - Math.exp(-3 * delta));
      camera.lookAt(26, 3.8, -30 + Math.sin(phase) * 55);
      player.visible = false;
    } else if (transitMode === "balloon") {
      const phase = (elapsed - transitStartedAt) * 0.13;
      camera.position.lerp(new THREE.Vector3(18 + Math.cos(phase) * 128, 66, -30 + Math.sin(phase) * 128), 1 - Math.exp(-2.5 * delta));
      keepCameraClear(camera.position, coast.getGroundHeight, 12);
      camera.lookAt(28, 0, -18);
      player.visible = false;
    } else {
      player.visible = true;
      updateGameplayCamera(camera, player.position, look, delta);
      keepCameraClear(camera.position, coast.getGroundHeight, 1.8);
    }
    sun.target.position.lerp(tourActive ? tourLookCurrent : player.position, 1 - Math.exp(-3 * delta));
    sun.target.updateMatrixWorld();
  });

  root.addEventListener("kingdom:dispose", () => {
    hud.dispose();
    inputBinding.dispose();
    runtime.dispose();
  }, { once: true });
}

function safeCameraPosition(
  desired: THREE.Vector3,
  getGroundHeight: (x: number, z: number) => number,
  clearance: number
): THREE.Vector3 {
  const ground = getGroundHeight(desired.x, desired.z);
  desired.y = Math.max(desired.y, ground + clearance);
  return desired;
}

function keepCameraClear(
  position: THREE.Vector3,
  getGroundHeight: (x: number, z: number) => number,
  clearance: number
): void {
  const shoreDistance = position.x - coastalShoreX(position.z);
  if (shoreDistance < -6) return;
  position.y = Math.max(position.y, getGroundHeight(position.x, position.z) + clearance);
}

function coastalEnvironmentFromTown(environment: EnvironmentSettings): CoastalEnvironmentState {
  const season = environment.season === "spring" || environment.season === "summer" || environment.season === "autumn" || environment.season === "winter"
    ? environment.season
    : DEFAULT_COASTAL_ENVIRONMENT.season;
  const weather = environment.weather === "storm"
    ? "storm"
    : environment.weather === "rain" || environment.weather === "snow"
      ? "rain"
      : "clear";
  let time: CoastalEnvironmentState["time"] = "live";
  if (environment.dayNightMode === "manual") {
    time = environment.manualHour < 6.3 || environment.manualHour >= 19.2
      ? "night"
      : environment.manualHour < 7.5 || environment.manualHour >= 17.2
        ? "sunset"
        : "day";
  }
  return { season, weather, time };
}

function townEnvironmentFromCoast(
  environment: CoastalEnvironmentState,
  current: EnvironmentSettings
): EnvironmentSettings {
  return {
    ...current,
    weatherMode: environment.weather === "clear" && current.weatherMode === "live" ? "live" : "manual",
    weather: environment.weather,
    dayNightMode: environment.time === "live" ? "timezone" : "manual",
    manualHour: environment.time === "night" ? 22 : environment.time === "sunset" ? 18.3 : 13,
    seasonCycle: "four",
    season: environment.season,
    foliage: environment.season === "spring" ? "sakura" : environment.season === "autumn" ? "leaves" : "off"
  };
}
