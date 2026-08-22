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
import { createCoastalHoverboard, updateCoastalHoverboard } from "./hoverboard";
import { coastalShoreX, createCoastalScene } from "./scene";
import { createCoastalHud } from "./ui";
import {
  DEFAULT_COASTAL_ENVIRONMENT,
  formatSingaporeTime,
  resolveCoastalPalette,
  type CoastalEnvironmentState
} from "./environment";
import { loadTownSchemaDraft, saveTownSchemaDraft, type EnvironmentSettings } from "../../data/townSchema";

type BalloonRide = {
  phase: "enter" | "fly" | "rejoin" | "exit";
  mode: "autopilot" | "free";
  elapsed: number;
  duration: number;
  routeProgress: number;
  lateralOffset: number;
  freeHeading: number;
  freeSpeed: number;
  freeTargetSpeed: number;
  freeTargetAltitude: number;
  rejoinElapsed: number;
  rejoinFrom: THREE.Vector3;
  rejoinHeadingFrom: number;
  balloonFrom: THREE.Vector3;
  balloonQuaternionFrom: THREE.Quaternion;
  cameraFrom: THREE.Vector3;
  cameraQuaternionFrom: THREE.Quaternion;
  cameraTo: THREE.Vector3;
  cameraQuaternionTo: THREE.Quaternion;
  smoothedLook: THREE.Vector3;
};

type TourRoute = {
  curve: THREE.CatmullRomCurve3;
  length: number;
  stopProgress: number[];
};

type BalloonReturn = {
  from: THREE.Vector3;
  duration: number;
  elapsed: number;
};

export const KAIRUI_WORLD: WorldDefinition = {
  id: "kairui",
  name: "The Beach",
  description: "The cinematic coastal field journal of the operator island.",
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
    fog: { color: "#e8d5b6", near: 120, far: 640 },
    camera: { fov: 48, far: 1600 },
    exposure: 0.88,
    environmentIntensity: 0.2
  });
  const { scene, camera, renderer } = runtime;

  const hemisphere = new THREE.HemisphereLight("#fff1d7", "#517a6a", 0.78);
  scene.add(hemisphere);
  const sunDirection = new THREE.Vector3(-0.62, 0.42, 0.44).normalize();
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
  const coolFill = new THREE.DirectionalLight("#cfe0e8", 0.1);
  coolFill.position.set(140, 60, -80);
  scene.add(coolFill);

  const coast = createCoastalScene(scene);
  coast.setSunDirection(sunDirection);
  const townSchema = loadTownSchemaDraft();
  const player = createPlayer();
  applyCharacterAppearance(player, townSchema.player.appearance, townSchema.player.movement);
  const baseWalkMultiplier = typeof player.userData.walkMultiplier === "number" ? player.userData.walkMultiplier : 1;
  const baseSprintMultiplier = typeof player.userData.sprintMultiplier === "number" ? player.userData.sprintMultiplier : 1;
  const hoverboard = createCoastalHoverboard();
  player.add(hoverboard.object);
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
  let tourTravelUsesRoute = false;
  let tourHasRoutePosition = false;
  let tourRouteProgress = 0;
  let tourRouteStartProgress = 0;
  let tourRouteTravelDistance = 0;
  let tourRouteDirection = 1;
  const tourCameraFrom = new THREE.Vector3();
  const tourCameraTo = new THREE.Vector3();
  const tourLookFrom = new THREE.Vector3();
  const tourLookTo = new THREE.Vector3();
  const tourLookCurrent = new THREE.Vector3();
  const tourDwellPosition = new THREE.Vector3();
  const establishingLook = new THREE.Vector3();
  const boatPosition = new THREE.Vector3();
  const boatCameraPosition = new THREE.Vector3();
  const boatForward = new THREE.Vector3();
  const boatLookTarget = new THREE.Vector3();
  let tourTransitionStartedAt = 0;
  let tourTransitionDuration = 1850;
  let tourEnvironmentBefore: CoastalEnvironmentState | null = null;
  let environment: CoastalEnvironmentState = coastalEnvironmentFromTown(townSchema.environment);
  let environmentStamp = "";
  let transitMode: "none" | "boat" | "balloon" = "none";
  let transitStartedAt = 0;
  const boat = coast.transit.boat;
  const balloon = coast.transit.balloon;
  const balloonRoute = createBalloonRideRoute(coast.getGroundHeight);
  const balloonRouteLength = balloonRoute.getLength();
  const balloonPosePosition = new THREE.Vector3();
  const balloonPoseLook = new THREE.Vector3();
  const balloonCameraPosition = new THREE.Vector3();
  const balloonTangent = new THREE.Vector3();
  const balloonRight = new THREE.Vector3();
  const balloonForward = new THREE.Vector3();
  const balloonLookMatrix = new THREE.Matrix4();
  const balloonLookQuaternion = new THREE.Quaternion();
  const balloonTargetQuaternion = new THREE.Quaternion();
  const balloonTargetEuler = new THREE.Euler();
  const balloonReturnTarget = new THREE.Vector3();
  const balloonUp = new THREE.Vector3(0, 1, 0);
  const balloonEyeOffset = new THREE.Vector3(0, 2.35, 0);
  const balloonRouteSample = new THREE.Vector3();
  const balloonFreeLook = new THREE.Vector3();
  let freeFlightAscend = false;
  let balloonRide: BalloonRide | null = null;
  let balloonReturn: BalloonReturn | null = null;
  let hoverboardActive = false;
  let establishing = true;
  const establishingStartedAt = performance.now();
  // Frame the coast like a place, not a map. The previous offshore position
  // made the terrain and buildings read as miniatures while the pier consumed
  // the foreground. This lower, tighter diagonal gives the cliff settlement,
  // forest ridge and clock tower distinct depth bands in the opening frame.
  const vistaStart = new THREE.Vector3(-58, 25, 32);
  const vistaEnd = new THREE.Vector3(-46, 21, 23);
  const vistaTarget = new THREE.Vector3(38, 10, -45);
  camera.fov = 41.5;
  camera.updateProjectionMatrix();
  camera.position.copy(vistaStart);
  camera.lookAt(vistaTarget);
  player.visible = false;
  let hud: ReturnType<typeof createCoastalHud>;
  const setHoverboard = (active: boolean) => {
    if (active && (establishing || tourActive || transitMode !== "none" || hud.isModalOpen())) return;
    hoverboardActive = active;
    player.userData.walkMultiplier = baseWalkMultiplier * (active ? 2.2 : 1);
    player.userData.sprintMultiplier = baseSprintMultiplier * (active ? 2.2 : 1);
    if (!active) motion.velocity.multiplyScalar(0.42);
    hoverboard.object.visible = active;
    root.dataset.coastalHoverboardMode = active ? "active" : "inactive";
    hud.setHoverboard(active);
  };
  const toggleHoverboard = () => setHoverboard(!hoverboardActive);
  const tourCameraStops = coast.landmarks.map(({ object, landmark }) => safeCameraPosition(
    new THREE.Vector3(...landmark.shotOffset).add(object.position),
    coast.getGroundHeight,
    4.8
  ));
  const tourRoute = createTourRoute(tourCameraStops, coast.getGroundHeight);
  const dismissEstablishing = () => {
    establishing = false;
    root.classList.add("coastal-established");
    player.visible = true;
    camera.fov = 48;
    camera.updateProjectionMatrix();
    camera.position.copy(vistaEnd);
    camera.lookAt(player.position.x, player.position.y + 0.82, player.position.z);
    hud.setEstablishing(false);
    applyEnvironment();
  };

  const applyEnvironment = () => {
    // Open on an authored golden-hour cover, then hand control back to the
    // visitor's live timezone/weather as soon as they enter free roam.
    const presentedEnvironment: CoastalEnvironmentState = establishing
      ? { ...environment, weather: "clear", time: "sunset" }
      : environment;
    const palette = resolveCoastalPalette(presentedEnvironment);
    coast.applyEnvironment(presentedEnvironment, palette);
    hemisphere.color.set(palette.hemisphereSky);
    hemisphere.groundColor.set(palette.hemisphereGround);
    hemisphere.intensity = palette.hemisphereIntensity;
    sun.color.set(palette.sunlight);
    sun.intensity = palette.sunIntensity;
    renderer.toneMappingExposure = palette.exposure;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.set(palette.fog);
    scene.background = new THREE.Color(palette.skyHorizon);
    hud.setEnvironment(presentedEnvironment, formatSingaporeTime(), palette.isNight);
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
    const previousIndex = tourHasRoutePosition ? tourIndex : -1;
    tourIndex = (index + COASTAL_LANDMARKS.length) % COASTAL_LANDMARKS.length;
    const anchor = coast.landmarks[tourIndex];
    const landmark = anchor.landmark;
    tourCameraFrom.copy(camera.position);
    if (tourLookCurrent.lengthSq() > 0) tourLookFrom.copy(tourLookCurrent);
    else tourLookFrom.copy(player.position).add(new THREE.Vector3(0, 1.2, 0));
    tourCameraTo.copy(tourCameraStops[tourIndex]);
    tourLookTo.copy(anchor.object.position).add(new THREE.Vector3(...landmark.lookOffset));
    tourTravelUsesRoute = previousIndex >= 0;
    if (tourTravelUsesRoute) {
      tourRouteStartProgress = tourRouteProgress;
      const forwardDistance = forwardRouteDistance(
        tourRouteStartProgress,
        tourRoute.stopProgress[tourIndex],
        tourRoute.length
      );
      const backwardDistance = tourRoute.length - forwardDistance;
      tourRouteDirection = forwardDistance <= backwardDistance ? 1 : -1;
      tourRouteTravelDistance = Math.min(forwardDistance, backwardDistance);
      const forwardChapters = (tourIndex - previousIndex + COASTAL_LANDMARKS.length) % COASTAL_LANDMARKS.length;
      const backwardChapters = (previousIndex - tourIndex + COASTAL_LANDMARKS.length) % COASTAL_LANDMARKS.length;
      const chapterCount = Math.max(1, Math.min(forwardChapters, backwardChapters));
      tourTransitionDuration = THREE.MathUtils.clamp(
        tourRouteTravelDistance / (10 * chapterCount),
        4,
        8
      ) * chapterCount * 1000;
    } else {
      tourTransitionDuration = THREE.MathUtils.clamp(camera.position.distanceTo(tourCameraTo) / 24, 4, 8) * 1000;
    }
    tourTransitionStartedAt = performance.now();
    tourTravelling = true;
    hud.closeLandmark();
    hud.setTour(true, anchor.landmark);
    environment = { ...environment, time: landmark.tourTime };
    applyEnvironment();
  };
  const setTour = (active: boolean) => {
    if (active && hoverboardActive) setHoverboard(false);
    tourActive = active;
    if (active) {
      establishing = false;
      camera.fov = 48;
      camera.updateProjectionMatrix();
      root.classList.add("coastal-established", "coastal-autopilot");
      transitMode = "none";
      hud.setTransit("none");
      tourEnvironmentBefore = { ...environment };
      player.visible = false;
      const firstUndiscovered = COASTAL_LANDMARKS.findIndex((item) => !discovered.has(`kairui:${item.id}`));
      beginTourLeg(firstUndiscovered >= 0 ? firstUndiscovered : 0);
    } else {
      tourTravelling = false;
      tourTravelUsesRoute = false;
      tourHasRoutePosition = false;
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
  const poseBalloonRide = (progress: number, lateralOffset: number) => {
    const loopProgress = THREE.MathUtils.euclideanModulo(progress, 1);
    balloonRoute.getPointAt(loopProgress, balloonPosePosition);
    balloonRoute.getTangentAt(loopProgress, balloonTangent).setY(0).normalize();
    balloonRight.set(balloonTangent.z, 0, -balloonTangent.x);
    balloonForward.copy(balloonTangent);
    balloonPosePosition.addScaledVector(balloonRight, lateralOffset);
    balloonRoute.getPointAt((loopProgress + 14 / balloonRouteLength) % 1, balloonPoseLook);
    balloonPoseLook.addScaledVector(balloonRight, lateralOffset * 0.7);
    // The route is anchored at the basket. Keep the eye just inside its front
    // wall so the suspension frame remains part of the view, rather than
    // treating the balloon envelope's centre as the rider's position.
    balloonCameraPosition.copy(balloonPosePosition)
      .addScaledVector(balloonForward, 0.18)
      .add(balloonEyeOffset);
    // Preserve the forward point from the curve and only apply a gentle,
    // fixed downtilt (~10 degrees at 14 units ahead). This keeps the horizon
    // in the upper third of the frame so the ride reads as a coastal vista.
    balloonPoseLook.y = balloonCameraPosition.y - 2.5;
    const heading = Math.atan2(balloonTangent.x, balloonTangent.z);
    return heading;
  };
  const poseFreeBalloonRide = (position: THREE.Vector3, heading: number) => {
    balloonForward.set(Math.sin(heading), 0, Math.cos(heading));
    balloonCameraPosition.copy(position).addScaledVector(balloonForward, 0.18).add(balloonEyeOffset);
    balloonFreeLook.copy(balloonCameraPosition).addScaledVector(balloonForward, 14);
    balloonFreeLook.y = balloonCameraPosition.y - 2.5;
  };
  const setCameraQuaternion = (position: THREE.Vector3, target: THREE.Vector3, out: THREE.Quaternion) => {
    balloonLookMatrix.lookAt(position, target, balloonUp);
    out.setFromRotationMatrix(balloonLookMatrix);
  };
  const gameplayExitPose = (position: THREE.Vector3, target: THREE.Vector3, quaternion: THREE.Quaternion) => {
    const horizontal = look.distance * Math.cos(look.pitch);
    position.set(-7.6, 0, 11.8).normalize().multiplyScalar(horizontal).applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
    position.y = look.distance * Math.sin(look.pitch);
    position.add(player.position);
    target.set(player.position.x, player.position.y + 0.82, player.position.z);
    setCameraQuaternion(position, target, quaternion);
  };
  const beginBalloonRide = () => {
    if (balloonRide || transitMode === "boat" || establishing || tourActive || hud.isModalOpen()) return;
    if (hoverboardActive) setHoverboard(false);
    const heading = poseBalloonRide(0, 0);
    setCameraQuaternion(balloonCameraPosition, balloonPoseLook, balloonLookQuaternion);
    balloonRide = {
      phase: "enter",
      mode: "autopilot",
      elapsed: 0,
      duration: THREE.MathUtils.clamp(camera.position.distanceTo(balloonCameraPosition) / 55, 1.7, 3.4),
      routeProgress: 0,
      lateralOffset: 0,
      freeHeading: heading,
      freeSpeed: 0,
      freeTargetSpeed: 0,
      freeTargetAltitude: balloonPosePosition.y,
      rejoinElapsed: 0,
      rejoinFrom: new THREE.Vector3(),
      rejoinHeadingFrom: heading,
      balloonFrom: balloon.position.clone(),
      balloonQuaternionFrom: balloon.quaternion.clone(),
      cameraFrom: camera.position.clone(),
      cameraQuaternionFrom: camera.quaternion.clone(),
      cameraTo: balloonCameraPosition.clone(),
      cameraQuaternionTo: balloonLookQuaternion.clone(),
      smoothedLook: balloonPoseLook.clone()
    };
    balloonReturn = null;
    balloon.userData.riding = true;
    balloon.rotation.y = heading;
    transitMode = "balloon";
    transitStartedAt = runtime.clock.elapsedTime;
    player.visible = false;
    hud.setTransit("balloon");
    hud.setBalloonMode("autopilot");
  };
  const setBalloonMode = (mode: "autopilot" | "free") => {
    const ride = balloonRide;
    if (!ride || ride.phase === "exit" || ride.mode === mode) return;
    ride.mode = mode;
    if (mode === "free") {
      if (ride.phase === "rejoin") ride.phase = "fly";
      ride.freeHeading = balloon.rotation.y;
      ride.freeSpeed = 0;
      ride.freeTargetSpeed = 0;
      ride.freeTargetAltitude = balloon.position.y;
    } else if (ride.phase === "fly") {
      let closestProgress = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (let sample = 0; sample <= 200; sample += 1) {
        const progress = sample / 200;
        balloonRoute.getPointAt(progress, balloonRouteSample);
        const distance = balloonRouteSample.distanceToSquared(balloon.position);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestProgress = progress;
        }
      }
      ride.routeProgress = closestProgress;
      ride.rejoinFrom.copy(balloon.position);
      ride.rejoinHeadingFrom = ride.freeHeading;
      ride.rejoinElapsed = 0;
      ride.phase = "rejoin";
    }
    if (mode === "autopilot") freeFlightAscend = false;
    hud.setBalloonMode(mode);
  };
  const beginBalloonExit = () => {
    if (!balloonRide || balloonRide.phase === "exit") return;
    freeFlightAscend = false;
    const exitTarget = new THREE.Vector3();
    const exitLook = new THREE.Vector3();
    const exitQuaternion = new THREE.Quaternion();
    gameplayExitPose(exitTarget, exitLook, exitQuaternion);
    balloonRide.phase = "exit";
    balloonRide.elapsed = 0;
    balloonRide.duration = THREE.MathUtils.clamp(camera.position.distanceTo(exitTarget) / 60, 1.5, 3.2);
    balloonRide.cameraFrom.copy(camera.position);
    balloonRide.cameraQuaternionFrom.copy(camera.quaternion);
    balloonRide.cameraTo.copy(exitTarget);
    balloonRide.cameraQuaternionTo.copy(exitQuaternion);
  };
  const updateBalloonReturn = (delta: number, elapsed: number) => {
    if (!balloonReturn) return;
    balloonReturn.elapsed += delta;
    const idle = balloon.userData.idleStation as THREE.Vector3;
    balloonReturnTarget.set(
      idle.x + Math.sin(elapsed * 0.045) * 1.15,
      idle.y + Math.sin(elapsed * 0.4) * 0.38,
      idle.z + Math.cos(elapsed * 0.038) * 0.8
    );
    const progress = THREE.MathUtils.smoothstep(Math.min(balloonReturn.elapsed / balloonReturn.duration, 1), 0, 1);
    balloon.position.lerpVectors(balloonReturn.from, balloonReturnTarget, progress);
    balloon.rotation.y = THREE.MathUtils.damp(balloon.rotation.y, 0, 2.2, delta);
    if (progress >= 1) {
      balloonReturn = null;
      balloon.userData.riding = false;
    }
  };
  hud = createCoastalHud(root, {
    onEnterWorld: dismissEstablishing,
    onInspect: inspectNearby,
    onBalloonBoard: beginBalloonRide,
    onHoverboardToggle: toggleHoverboard,
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
      if (balloonRide) {
        beginBalloonExit();
        return;
      }
      if (mode === "balloon") {
        beginBalloonRide();
        return;
      }
      if (mode !== "none" && hoverboardActive) setHoverboard(false);
      transitMode = mode;
      if (mode !== "none") transitStartedAt = runtime.clock.elapsedTime;
      else player.visible = true;
      hud.setTransit(transitMode);
    },
    onBalloonModeChange: setBalloonMode
  });
  hud.setProgress(discovered, COASTAL_LANDMARKS.length);
  hud.setTour(false, null);
  hud.setTransit("none");
  hud.setBalloonMode("autopilot");
  hud.setHoverboard(false);
  hud.setEstablishing(true);
  applyEnvironment();

  const handleBalloonEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !balloonRide) return;
    event.preventDefault();
    beginBalloonExit();
  };
  window.addEventListener("keydown", handleBalloonEscape);
  const handleBalloonAltitudeKey = (event: KeyboardEvent) => {
    if (!balloonRide || balloonRide.mode !== "free" || event.code !== "Space") return;
    freeFlightAscend = event.type === "keydown";
    event.preventDefault();
  };
  window.addEventListener("keydown", handleBalloonAltitudeKey);
  window.addEventListener("keyup", handleBalloonAltitudeKey);
  const handleHoverboardKey = (event: KeyboardEvent) => {
    if (event.code !== "KeyQ" || event.repeat || isEditableElement(event.target)) return;
    event.preventDefault();
    toggleHoverboard();
  };
  window.addEventListener("keydown", handleHoverboardKey);

  runtime.start(({ delta, elapsed }) => {
    updateBalloonReturn(delta, elapsed);
    if (!hud.isModalOpen() && transitMode === "none" && !establishing && !tourActive) {
      updatePlayerMovement(
        player,
        motion,
        input,
        delta,
        coast.colliders,
        camera,
        (target, walkTime, moving, sprinting) => updatePlayerRig(
          target,
          walkTime,
          hoverboardActive ? false : moving,
          hoverboardActive ? false : sprinting
        ),
        coast.getGroundHeight,
        145,
        coast.isWalkable
      );
    } else {
      input.jumpRequested = false;
      input.inspectRequested = false;
    }
    updateCoastalHoverboard(hoverboard, hoverboardActive, elapsed, motion.speed, delta);

    let closest: CoastalLandmark | null = null;
    const interactionsEnabled = transitMode === "none" && !establishing && !tourActive && !hud.isModalOpen();
    if (interactionsEnabled) {
      let closestDistance = 3.1;
      for (const anchor of coast.landmarks) {
        const distance = player.position.distanceTo(anchor.object.position);
        if (distance < closestDistance) {
          closest = anchor.landmark;
          closestDistance = distance;
        }
      }
    }
    if (closest !== nearby) {
      nearby = closest;
      hud.setNearby(nearby);
      root.dataset.nearbyLandmark = nearby?.id ?? "";
    }
    const balloonNearby = interactionsEnabled && player.position.distanceTo(balloon.position) < 7.25;
    hud.setBalloonNearby(balloonNearby);
    if (input.inspectRequested) {
      input.inspectRequested = false;
      if (balloonNearby) beginBalloonRide();
      else if (interactionsEnabled) inspectNearby();
    }

    coast.update(elapsed, delta, hud.isModalOpen());
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
      if (tourTravelUsesRoute) {
        tourRouteProgress = advanceRouteProgress(
          tourRouteStartProgress,
          tourRouteDirection,
          tourRouteTravelDistance * eased,
          tourRoute.length
        );
        tourRoute.curve.getPointAt(tourRouteProgress, camera.position);
        keepCameraClear(camera.position, coast.getGroundHeight, 3.5);
      } else {
        camera.position.lerpVectors(tourCameraFrom, tourCameraTo, eased);
        keepCameraClear(camera.position, coast.getGroundHeight, 4.8);
      }
      tourLookCurrent.lerpVectors(tourLookFrom, tourLookTo, THREE.MathUtils.smoothstep(transition, 0, 1));
      camera.lookAt(tourLookCurrent);
      if (transition >= 1) {
        tourTravelling = false;
        tourTravelUsesRoute = false;
        tourHasRoutePosition = true;
        tourRouteProgress = tourRoute.stopProgress[tourIndex];
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
      establishingLook.lerpVectors(vistaTarget, player.position, eased * 0.58);
      camera.lookAt(establishingLook);
    } else if (establishing) {
      camera.position.lerp(vistaEnd, 1 - Math.exp(-2.4 * delta));
      keepCameraClear(camera.position, coast.getGroundHeight, 6);
      camera.lookAt(vistaTarget);
    } else if (tourActive) {
      const targetAnchor = coast.landmarks[tourIndex];
      const drift = Math.sin(elapsed * 0.22 + tourIndex) * 0.22;
      tourDwellPosition.set(
        tourCameraTo.x + drift,
        tourCameraTo.y + Math.cos(elapsed * 0.18) * 0.09,
        tourCameraTo.z - drift * 0.32
      );
      camera.position.lerp(tourDwellPosition, 1 - Math.exp(-2.5 * delta));
      keepCameraClear(camera.position, coast.getGroundHeight, 4.8);
      tourLookCurrent.lerp(tourLookTo, 1 - Math.exp(-2.5 * delta));
      camera.lookAt(tourLookCurrent);
      player.visible = false;
    } else if (transitMode === "boat") {
      boatPosition.copy(boat.position);
      boatForward.set(1, 0, 0).applyQuaternion(boat.quaternion).normalize();
      boatCameraPosition.copy(boatPosition).addScaledVector(boatForward, -11);
      boatCameraPosition.y += 8;
      boatLookTarget.copy(boatPosition).addScaledVector(boatForward, 12);
      boatLookTarget.y += 1.4;
      camera.position.lerp(boatCameraPosition, 1 - Math.exp(-3 * delta));
      camera.lookAt(boatLookTarget);
      player.visible = false;
    } else if (transitMode === "balloon" && balloonRide) {
      const ride = balloonRide;
      player.visible = false;
      if (ride.phase === "enter") {
        ride.elapsed += delta;
        const progress = THREE.MathUtils.smoothstep(Math.min(ride.elapsed / ride.duration, 1), 0, 1);
        const heading = poseBalloonRide(0, 0);
        balloonTargetEuler.set(0, heading, 0);
        balloonTargetQuaternion.setFromEuler(balloonTargetEuler);
        balloon.position.lerpVectors(ride.balloonFrom, balloonPosePosition, progress);
        balloon.quaternion.slerpQuaternions(ride.balloonQuaternionFrom, balloonTargetQuaternion, progress);
        camera.position.lerpVectors(ride.cameraFrom, balloonCameraPosition, progress);
        setCameraQuaternion(balloonCameraPosition, balloonPoseLook, ride.cameraQuaternionTo);
        camera.quaternion.slerpQuaternions(ride.cameraQuaternionFrom, ride.cameraQuaternionTo, progress);
        if (progress >= 1) {
          ride.phase = "fly";
          ride.elapsed = 0;
          if (ride.mode === "free") {
            ride.freeHeading = heading;
            ride.freeTargetAltitude = balloon.position.y;
          }
          ride.smoothedLook.copy(balloonPoseLook);
        }
      } else if (ride.phase === "fly") {
        let heading: number;
        if (ride.mode === "free") {
          const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
          ride.freeHeading += turn * 1.25 * delta;
          ride.freeTargetSpeed = THREE.MathUtils.clamp(
            ride.freeTargetSpeed + ((input.forward ? 6 : 0) - (input.backward ? 7 : 0)) * delta,
            0,
            9
          );
          ride.freeSpeed = THREE.MathUtils.damp(ride.freeSpeed, ride.freeTargetSpeed, 3.2, delta);
          balloonForward.set(Math.sin(ride.freeHeading), 0, Math.cos(ride.freeHeading));
          balloon.position.addScaledVector(balloonForward, ride.freeSpeed * delta);
          balloon.position.x = THREE.MathUtils.clamp(balloon.position.x, -220, 160);
          balloon.position.z = THREE.MathUtils.clamp(balloon.position.z, -260, 200);
          const minimumAltitude = coast.getGroundHeight(balloon.position.x, balloon.position.z) + 10;
          ride.freeTargetAltitude = THREE.MathUtils.clamp(
            ride.freeTargetAltitude + ((freeFlightAscend ? 15 : 0) - (input.sprint ? 15 : 0)) * delta,
            minimumAltitude,
            95
          );
          balloon.position.y = THREE.MathUtils.clamp(
            THREE.MathUtils.damp(balloon.position.y, ride.freeTargetAltitude, 3.1, delta),
            minimumAltitude,
            95
          );
          heading = ride.freeHeading;
          poseFreeBalloonRide(balloon.position, heading);
          balloonPoseLook.copy(balloonFreeLook);
        } else {
          const requestedOffset = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 10;
          ride.lateralOffset = THREE.MathUtils.damp(ride.lateralOffset, requestedOffset, requestedOffset === 0 ? 0.35 : 0.9, delta);
          ride.routeProgress = (ride.routeProgress + delta / 90) % 1;
          heading = poseBalloonRide(ride.routeProgress, ride.lateralOffset);
          balloon.position.copy(balloonPosePosition);
        }
        balloon.rotation.set(
          Math.sin(elapsed * 0.33 + 1.2) * 0.012,
          heading,
          Math.sin(elapsed * 0.42) * 0.016 - ride.lateralOffset * 0.0016
        );
        camera.position.copy(balloonCameraPosition);
        ride.smoothedLook.lerp(balloonPoseLook, 1 - Math.exp(-4 * delta));
        camera.lookAt(ride.smoothedLook);
        camera.rotateZ(balloon.rotation.z * 0.6);
      } else if (ride.phase === "rejoin") {
        ride.rejoinElapsed += delta;
        const progress = THREE.MathUtils.smoothstep(Math.min(ride.rejoinElapsed / 2.5, 1), 0, 1);
        const targetHeading = poseBalloonRide(ride.routeProgress, 0);
        balloon.position.lerpVectors(ride.rejoinFrom, balloonPosePosition, progress);
        ride.freeHeading = lerpAngle(ride.rejoinHeadingFrom, targetHeading, progress);
        poseFreeBalloonRide(balloon.position, ride.freeHeading);
        balloonPoseLook.copy(balloonFreeLook);
        balloon.rotation.set(
          Math.sin(elapsed * 0.33 + 1.2) * 0.012,
          ride.freeHeading,
          Math.sin(elapsed * 0.42) * 0.016
        );
        camera.position.copy(balloonCameraPosition);
        ride.smoothedLook.lerp(balloonPoseLook, 1 - Math.exp(-4 * delta));
        camera.lookAt(ride.smoothedLook);
        camera.rotateZ(balloon.rotation.z * 0.6);
        if (progress >= 1) {
          ride.phase = "fly";
          ride.lateralOffset = 0;
          ride.smoothedLook.copy(balloonPoseLook);
        }
      } else {
        ride.elapsed += delta;
        const progress = THREE.MathUtils.smoothstep(Math.min(ride.elapsed / ride.duration, 1), 0, 1);
        camera.position.lerpVectors(ride.cameraFrom, ride.cameraTo, progress);
        camera.quaternion.slerpQuaternions(ride.cameraQuaternionFrom, ride.cameraQuaternionTo, progress);
        if (progress >= 1) {
          balloonReturn = {
            from: balloon.position.clone(),
            duration: Math.max(6, balloon.position.distanceTo(balloon.userData.idleStation as THREE.Vector3) / 14),
            elapsed: 0
          };
          balloonRide = null;
          transitMode = "none";
          player.visible = true;
          look.focusInitialized = false;
          hud.setTransit("none");
        }
      }
    } else {
      player.visible = true;
      updateGameplayCamera(camera, player.position, look, delta);
      keepCameraClear(camera.position, coast.getGroundHeight, 1.8);
    }
    sun.target.position.lerp(tourActive ? tourLookCurrent : player.position, 1 - Math.exp(-3 * delta));
    sun.target.updateMatrixWorld();
  });

  root.addEventListener("kingdom:dispose", () => {
    window.removeEventListener("keydown", handleBalloonEscape);
    window.removeEventListener("keydown", handleBalloonAltitudeKey);
    window.removeEventListener("keyup", handleBalloonAltitudeKey);
    window.removeEventListener("keydown", handleHoverboardKey);
    hud.dispose();
    inputBinding.dispose();
    runtime.dispose();
  }, { once: true });
}

function createBalloonRideRoute(getGroundHeight: (x: number, z: number) => number): THREE.CatmullRomCurve3 {
  // The route opens on the boardable headland, then passes the camp/workshop,
  // career ridge, lantern walk, lighthouse, harbor/pier and the outer bay.
  const waypoints: Array<[number, number]> = [
    [70, -18], [60, -62], [38, -102], [88, -132], [5, -142],
    [-78, -112], [-110, -42], [-96, 52], [-118, 94], [-58, 132],
    [6, 94], [54, 58], [72, 24]
  ];
  return new THREE.CatmullRomCurve3(
    waypoints.map(([x, z]) => new THREE.Vector3(x, Math.max(getGroundHeight(x, z) + 26, 40), z)),
    true,
    "centripetal",
    0.5
  );
}

function createTourRoute(
  cameraStops: readonly THREE.Vector3[],
  getGroundHeight: (x: number, z: number) => number
): TourRoute {
  const nodes: THREE.Vector3[] = [];
  const stopNodeIndices: number[] = [];
  const interpolated = new THREE.Vector3();
  for (let index = 0; index < cameraStops.length; index += 1) {
    const current = cameraStops[index];
    const next = cameraStops[(index + 1) % cameraStops.length];
    stopNodeIndices.push(nodes.length);
    nodes.push(current.clone());
    const segments = Math.max(2, Math.ceil(current.distanceTo(next) / 16));
    for (let segment = 1; segment < segments; segment += 1) {
      interpolated.lerpVectors(current, next, segment / segments);
      interpolated.y = Math.max(interpolated.y, getGroundHeight(interpolated.x, interpolated.z) + 6);
      nodes.push(interpolated.clone());
    }
  }
  const curve = new THREE.CatmullRomCurve3(nodes, true, "centripetal", 0.5);
  curve.arcLengthDivisions = 2048;
  const stopProgress = stopNodeIndices.map((nodeIndex) => {
    const target = nodes[nodeIndex];
    const sample = new THREE.Vector3();
    let nearestProgress = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= 2048; index += 1) {
      const progress = index / 2048;
      curve.getPointAt(progress, sample);
      const distance = sample.distanceToSquared(target);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestProgress = progress;
      }
    }
    return nearestProgress;
  });
  return { curve, length: curve.getLength(), stopProgress };
}

function forwardRouteDistance(from: number, to: number, length: number): number {
  return (to >= from ? to - from : 1 - from + to) * length;
}

function advanceRouteProgress(from: number, direction: number, distance: number, length: number): number {
  return THREE.MathUtils.euclideanModulo(from + direction * distance / length, 1);
}

function lerpAngle(from: number, to: number, progress: number): number {
  const delta = THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
  return from + delta * progress;
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

function isEditableElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}
