import * as THREE from "three";
import type { WorldDefinition } from "../../engine/world";
import { discoverKingdomLandmark, loadKingdomProgress, saveKingdomProgress } from "../../engine/progress";
import { createWorldRuntime } from "../../engine/runtime";
import { bindInput } from "../../systems/input";
import { createPlayer, updatePlayerRig } from "../../world/characters";
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
    fog: { color: "#e8d5b6", near: 54, far: 124 },
    camera: { fov: 42, far: 190 },
    exposure: 0.9,
    environmentIntensity: 0.18
  });
  const { scene, camera, renderer } = runtime;

  const hemisphere = new THREE.HemisphereLight("#fff1d7", "#517a6a", 1.15);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight("#ffe0ad", 2.15);
  sun.position.set(-28, 38, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun);

  const coast = createCoastalScene(scene);
  coast.colliders.unshift({ kind: "boundary-circle", x: 0, z: 0, radius: 18.2 });
  const player = createPlayer();
  player.position.set(0, 0.76, 12.4);
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
  let environment: CoastalEnvironmentState = { ...DEFAULT_COASTAL_ENVIRONMENT };
  let environmentStamp = "";
  let transitMode: "none" | "boat" | "balloon" = "none";
  let transitStartedAt = 0;

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
    if (!hud.isModalOpen() && transitMode === "none") {
      updatePlayerMovement(player, motion, input, delta, coast.colliders, camera, updatePlayerRig);
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
    if (transitMode === "boat") {
      const phase = (elapsed - transitStartedAt) * 0.24;
      const target = new THREE.Vector3(Math.cos(phase) * 24, 0.55, Math.sin(phase) * 19);
      camera.position.lerp(new THREE.Vector3(target.x - 8, 5.5, target.z + 9), 1 - Math.exp(-3 * delta));
      camera.lookAt(0, 1.4, 0);
      player.visible = false;
    } else if (transitMode === "balloon") {
      const phase = (elapsed - transitStartedAt) * 0.13;
      camera.position.lerp(new THREE.Vector3(Math.cos(phase) * 31, 24, Math.sin(phase) * 27), 1 - Math.exp(-2.5 * delta));
      camera.lookAt(0, 0.8, 0);
      player.visible = false;
    } else {
      player.visible = true;
      updateGameplayCamera(camera, player.position, look, delta);
    }
  });

  root.addEventListener("kingdom:dispose", () => {
    hud.dispose();
    inputBinding.dispose();
    runtime.dispose();
  }, { once: true });
}
