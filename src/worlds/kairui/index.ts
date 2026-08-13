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
import { createCoastalScene } from "./scene";
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
    fog: { color: "#e8d5b6", near: 118, far: 520 },
    camera: { fov: 48, far: 1400 },
    exposure: 0.84,
    environmentIntensity: 0.12
  });
  const { scene, camera, renderer } = runtime;

  const hemisphere = new THREE.HemisphereLight("#fff1d7", "#517a6a", 1.15);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight("#ffe0ad", 2.15);
  sun.position.set(-80, 120, 72);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.camera.left = -92;
  sun.shadow.camera.right = 92;
  sun.shadow.camera.top = 92;
  sun.shadow.camera.bottom = -92;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun);

  const coast = createCoastalScene(scene);
  const townSchema = loadTownSchemaDraft();
  const player = createPlayer();
  applyCharacterAppearance(player, townSchema.player.appearance, townSchema.player.movement);
  player.position.set(24, coast.getGroundHeight(24, -124), -124);
  player.rotation.y = Math.PI;
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

  const saved = loadKingdomProgress();
  saved.lastWorld = "kairui";
  saveKingdomProgress(saved);
  const discovered = new Set(saved.discoveries.filter((id) => id.startsWith("kairui:")));
  let nearby: CoastalLandmark | null = null;
  let tourActive = false;
  let tourIndex = 0;
  let environment: CoastalEnvironmentState = coastalEnvironmentFromTown(townSchema.environment);
  let environmentStamp = "";
  let transitMode: "none" | "boat" | "balloon" = "none";
  let transitStartedAt = 0;
  let establishing = true;
  const establishingStartedAt = performance.now();
  const vistaStart = new THREE.Vector3(96, 46, -144);
  const vistaEnd = camera.position.clone();
  const vistaTarget = new THREE.Vector3(27, 3.4, -38);
  camera.position.copy(vistaStart);
  camera.lookAt(vistaTarget);
  const dismissEstablishing = () => {
    establishing = false;
    initializeGameplayCamera(camera, player.position);
  };
  window.addEventListener("keydown", dismissEstablishing, { once: true, passive: true });
  renderer.domElement.addEventListener("pointerdown", dismissEstablishing, { once: true, passive: true });

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

  const inspectNearby = () => {
    const target = nearby ?? (tourActive ? COASTAL_LANDMARKS[tourIndex] : null);
    if (!target) return;
    const key = `kairui:${target.id}`;
    const isNew = !discovered.has(key);
    discovered.add(key);
    discoverKingdomLandmark(key, "kairui");
    hud.setProgress(discovered, COASTAL_LANDMARKS.length);
    hud.openLandmark(target, isNew);
  };
  const setTour = (active: boolean) => {
    tourActive = active;
    if (active) {
      const firstUndiscovered = COASTAL_LANDMARKS.findIndex((item) => !discovered.has(`kairui:${item.id}`));
      tourIndex = firstUndiscovered >= 0 ? firstUndiscovered : 0;
    }
    hud.setTour(tourActive, tourActive ? COASTAL_LANDMARKS[tourIndex] : null);
  };
  const advanceTour = () => {
    if (!tourActive) return;
    tourIndex = (tourIndex + 1) % COASTAL_LANDMARKS.length;
    hud.setTour(true, COASTAL_LANDMARKS[tourIndex]);
  };
  const hud = createCoastalHud(root, {
    onInspect: inspectNearby,
    onTourToggle: () => setTour(!tourActive),
    onTourNext: advanceTour,
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
  applyEnvironment();

  runtime.start(({ delta, elapsed }) => {
    if (!hud.isModalOpen() && transitMode === "none" && !establishing) {
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
    if (tourActive && !hud.isModalOpen()) {
      const target = coast.landmarks[tourIndex].object.position;
      look.targetYaw = Math.atan2(target.x - player.position.x, target.z - player.position.z) + 0.55;
      coast.setTourRoute(player.position, target);
    } else {
      coast.setTourRoute(player.position, null);
    }
    const establishingProgress = THREE.MathUtils.clamp((performance.now() - establishingStartedAt) / 4800, 0, 1);
    if (establishing && establishingProgress < 1) {
      const eased = THREE.MathUtils.smoothstep(establishingProgress, 0, 1);
      camera.position.lerpVectors(vistaStart, vistaEnd, eased);
      camera.lookAt(vistaTarget.clone().lerp(player.position, eased * 0.58));
    } else if (establishing) {
      establishing = false;
      initializeGameplayCamera(camera, player.position);
    } else if (transitMode === "boat") {
      const phase = (elapsed - transitStartedAt) * 0.24;
      const target = new THREE.Vector3(-18 + Math.cos(phase) * 32, 0.55, -24 + Math.sin(phase) * 76);
      camera.position.lerp(new THREE.Vector3(target.x - 12, 8.5, target.z + 16), 1 - Math.exp(-3 * delta));
      camera.lookAt(26, 3.4, -18);
      player.visible = false;
    } else if (transitMode === "balloon") {
      const phase = (elapsed - transitStartedAt) * 0.13;
      camera.position.lerp(new THREE.Vector3(18 + Math.cos(phase) * 72, 52, -30 + Math.sin(phase) * 112), 1 - Math.exp(-2.5 * delta));
      camera.lookAt(28, 2.8, -24);
      player.visible = false;
    } else {
      player.visible = true;
      updateGameplayCamera(camera, player.position, look, delta);
    }
  });

  root.addEventListener("kingdom:dispose", () => {
    hud.dispose();
    inputBinding.dispose();
    window.removeEventListener("keydown", dismissEstablishing);
    renderer.domElement.removeEventListener("pointerdown", dismissEstablishing);
    runtime.dispose();
  }, { once: true });
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
