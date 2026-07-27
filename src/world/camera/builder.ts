import * as THREE from "three";
import type { TownBuilderApi } from "../../ui/builder";
import { TOWN_SPREAD, WORLD_LIMIT } from "../worldConstants";

const BUILDER_CAMERA_DEFAULT_HEIGHT = 54;
const BUILDER_CAMERA_MIN_HEIGHT = 22;
const BUILDER_CAMERA_MAX_HEIGHT = 88;

export type BuilderCameraState = {
  focus: THREE.Vector3;
  targetFocus: THREE.Vector3;
  height: number;
  targetHeight: number;
};

export function createBuilderCameraState(): BuilderCameraState {
  return {
    focus: new THREE.Vector3(0, 0, 0),
    targetFocus: new THREE.Vector3(0, 0, 0),
    height: BUILDER_CAMERA_DEFAULT_HEIGHT,
    targetHeight: BUILDER_CAMERA_DEFAULT_HEIGHT
  };
}

export function zoomBuilderCamera(state: BuilderCameraState, amount: number): void {
  state.targetHeight = THREE.MathUtils.clamp(state.targetHeight + amount, BUILDER_CAMERA_MIN_HEIGHT, BUILDER_CAMERA_MAX_HEIGHT);
}

export function resetBuilderCamera(state: BuilderCameraState): void {
  state.targetFocus.set(0, 0, 0);
  state.targetHeight = BUILDER_CAMERA_DEFAULT_HEIGHT;
}

export function bindBuilderCanvasInteractions(
  element: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  assetLayer: THREE.Group,
  isActive: () => boolean,
  builder: TownBuilderApi,
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
    cameraState.targetFocus.x = THREE.MathUtils.clamp(cameraState.targetFocus.x - (event.clientX - interaction.x) * worldPerPixel, -worldLimit, worldLimit);
    cameraState.targetFocus.z = THREE.MathUtils.clamp(cameraState.targetFocus.z - (event.clientY - interaction.y) * worldPerPixel, -worldLimit, worldLimit);
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
      const nextHeight = THREE.MathUtils.clamp(previousHeight * Math.exp(event.deltaY * 0.0012), BUILDER_CAMERA_MIN_HEIGHT, BUILDER_CAMERA_MAX_HEIGHT);

      if (cursorPoint && nextHeight < previousHeight) {
        cameraState.targetFocus.lerp(cursorPoint, (1 - nextHeight / previousHeight) * 0.72);
      }

      cameraState.targetHeight = nextHeight;
    },
    { passive: false }
  );
  element.addEventListener("dblclick", () => {
    if (isActive()) resetBuilderCamera(cameraState);
  });
}

export function updateBuilderCamera(camera: THREE.PerspectiveCamera, state: BuilderCameraState, delta: number): void {
  const stableDelta = Math.min(delta, 0.05);
  state.focus.x = THREE.MathUtils.damp(state.focus.x, state.targetFocus.x, 8.5, stableDelta);
  state.focus.z = THREE.MathUtils.damp(state.focus.z, state.targetFocus.z, 8.5, stableDelta);
  state.height = THREE.MathUtils.damp(state.height, state.targetHeight, 9.5, stableDelta);
  camera.up.set(0, 0, -1);
  camera.position.set(state.focus.x, state.height, state.focus.z);
  camera.lookAt(state.focus.x, 0, state.focus.z);
}
