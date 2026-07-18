import * as THREE from "three";
import type { WaterTowerAnchor } from "../interactions/waterTower";

const CAMERA_OFFSET = new THREE.Vector3(-5.8, 5.05, 8.75);
const CAMERA_DEFAULT_DISTANCE = CAMERA_OFFSET.length();
const CAMERA_MIN_DISTANCE = 9.5;
const CAMERA_MAX_DISTANCE = 20;
const CINEMATIC_IDLE_MS = 60_000;
const CINEMATIC_TRANSITION_MS = 4_000;
const CINEMATIC_EXIT_MS = 900;
const CINEMATIC_RADIUS = 31;

export type CameraLookState = {
  yaw: number;
  targetYaw: number;
  distance: number;
  targetDistance: number;
  zoomBy: (amount: number) => void;
};

export type CinematicState = {
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

export function initializeGameplayCamera(camera: THREE.PerspectiveCamera, playerPosition: THREE.Vector3): void {
  camera.position.copy(playerPosition).add(CAMERA_OFFSET);
  camera.lookAt(playerPosition.x, 0.82, playerPosition.z);
}

export function bindLookControls(element: HTMLCanvasElement): CameraLookState {
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
    if (pointers.size >= 2) pinchDistance = getPinchDistance();
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
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("dblclick", () => {
    look.targetYaw = 0;
    look.targetDistance = CAMERA_DEFAULT_DISTANCE;
  });

  return look;
}

export function createCinematicState(camera: THREE.PerspectiveCamera, playerPosition: THREE.Vector3): CinematicState {
  return {
    active: false,
    exiting: false,
    lastInteraction: performance.now(),
    startedAt: 0,
    exitStartedAt: 0,
    startAngle: 0,
    startPosition: camera.position.clone(),
    startTarget: playerPosition.clone(),
    exitPosition: camera.position.clone(),
    exitTarget: playerPosition.clone()
  };
}

export function registerCinematicActivity(
  root: HTMLElement,
  element: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  state: CinematicState
): void {
  const registerActivity = () => {
    state.lastInteraction = performance.now();
    if (!state.active) return;
    state.active = false;
    state.exiting = true;
    state.exitStartedAt = performance.now();
    state.exitPosition.copy(camera.position);
    camera.getWorldDirection(state.exitTarget);
    state.exitTarget.multiplyScalar(12).add(camera.position);
    root.classList.remove("cinematic-mode");
  };

  window.addEventListener("keydown", registerActivity, { passive: true });
  element.addEventListener("pointerdown", registerActivity, { passive: true });
  element.addEventListener("pointermove", registerActivity, { passive: true });
  element.addEventListener("wheel", registerActivity, { passive: true });
}

export function startIdleCinematic(
  camera: THREE.PerspectiveCamera,
  playerPosition: THREE.Vector3,
  state: CinematicState,
  now: number,
  root: HTMLElement
): boolean {
  if (state.active || state.exiting || now - state.lastInteraction < CINEMATIC_IDLE_MS) return false;
  state.active = true;
  state.startedAt = now;
  state.startPosition.copy(camera.position);
  state.startTarget.set(playerPosition.x, 0.82, playerPosition.z);
  state.startAngle = Math.atan2(camera.position.z, camera.position.x);
  root.classList.add("cinematic-mode");
  return true;
}

function getGameplayCameraPosition(target: THREE.Vector3, look: CameraLookState): THREE.Vector3 {
  look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, 0.12);
  look.distance = THREE.MathUtils.lerp(look.distance, look.targetDistance, 0.12);
  const offset = CAMERA_OFFSET.clone().setLength(look.distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
  return new THREE.Vector3(target.x + offset.x, target.y + offset.y, target.z + offset.z);
}

export function updateGameplayCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, look: CameraLookState): void {
  camera.up.set(0, 1, 0);
  camera.position.lerp(getGameplayCameraPosition(target, look), 0.075);
  camera.lookAt(target.x, 0.82, target.z);
}

export function updateWaterTowerCamera(camera: THREE.PerspectiveCamera, towerAnchor: WaterTowerAnchor): void {
  const tower = new THREE.Vector3(towerAnchor.x, towerAnchor.platformHeight, towerAnchor.z);
  const townFocus = new THREE.Vector3(-0.8, 1.15, 0.8);
  const towardTown = townFocus.clone().sub(tower).setY(0);
  if (towardTown.lengthSq() < 0.001) towardTown.set(0, 0, -1);
  towardTown.normalize();

  const outward = towardTown.clone().multiplyScalar(-1);
  const side = new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(1.65);
  const desired = tower.clone().addScaledVector(outward, 6.5).add(side);
  desired.y += 4.25;
  const target = tower.clone().addScaledVector(towardTown, 18);
  target.y = 1.2;

  camera.position.lerp(desired, 0.065);
  camera.lookAt(target);
}

export function updateCinematicExit(
  camera: THREE.PerspectiveCamera,
  state: CinematicState,
  playerPosition: THREE.Vector3,
  look: CameraLookState,
  now: number
): void {
  const progress = THREE.MathUtils.smoothstep(Math.min((now - state.exitStartedAt) / CINEMATIC_EXIT_MS, 1), 0, 1);
  const gameplayPosition = getGameplayCameraPosition(playerPosition, look);
  const gameplayTarget = new THREE.Vector3(playerPosition.x, 0.82, playerPosition.z);
  camera.position.lerpVectors(state.exitPosition, gameplayPosition, progress);
  camera.lookAt(new THREE.Vector3().lerpVectors(state.exitTarget, gameplayTarget, progress));
  if (progress >= 1) state.exiting = false;
}

export function updateCinematicCamera(camera: THREE.PerspectiveCamera, state: CinematicState, now: number): void {
  camera.up.set(0, 1, 0);
  const elapsedSeconds = (now - state.startedAt) / 1000;
  const transition = THREE.MathUtils.smoothstep(Math.min((now - state.startedAt) / CINEMATIC_TRANSITION_MS, 1), 0, 1);
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
