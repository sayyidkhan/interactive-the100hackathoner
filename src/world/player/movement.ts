import * as THREE from "three";
import { type InputState } from "../../systems/input";
import {
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_RADIUS,
  PLAYER_STEP_HEIGHT,
  SURFACE_CLEARANCE,
  WORLD_LIMIT
} from "../worldConstants";

export type PlayerMotion = {
  verticalVelocity: number;
  grounded: boolean;
  facingAngle: number;
  walkTime: number;
};

export type CollisionShape =
  | { kind: "box"; x: number; z: number; width: number; depth: number; top?: number }
  | { kind: "circle"; x: number; z: number; radius: number; top?: number };

export type PlayerRigAnimator = (player: THREE.Group, walkTime: number, moving: boolean, sprinting: boolean) => void;

type PlayerInput = Pick<InputState, "forward" | "backward" | "left" | "right" | "moveX" | "moveY" | "sprint" | "jumpRequested">;

export function updatePlayerMovement(
  player: THREE.Group,
  motion: PlayerMotion,
  input: PlayerInput,
  delta: number,
  colliders: CollisionShape[],
  camera: THREE.PerspectiveCamera,
  animateRig: PlayerRigAnimator
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
    if (motion.grounded && stepSurface > player.position.y + SURFACE_CLEARANCE) nextPosition.y = stepSurface;
    resolvePlayerCollisions(nextPosition, colliders);
    player.position.copy(nextPosition);
    const angle = Math.atan2(-direction.x, -direction.z);
    motion.facingAngle = turnToward(motion.facingAngle, angle, 32 * delta);
    player.rotation.y = motion.facingAngle;
    motion.walkTime += delta * (input.sprint ? 12 : 8.5);
    animateRig(player, motion.walkTime, true, input.sprint);
  } else {
    animateRig(player, motion.walkTime, false, false);
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
    if (collider.kind === "circle") resolveCircleCollision(position, collider);
    else resolveBoxCollision(position, collider);
  }

  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
}

function getWalkableSurfaceHeight(position: THREE.Vector3, colliders: CollisionShape[], maxHeight: number): number {
  let surfaceHeight = 0;
  for (const collider of colliders) {
    if (collider.top === undefined || collider.top > maxHeight) continue;
    if (isOnColliderSurface(position, collider)) surfaceHeight = Math.max(surfaceHeight, collider.top);
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

  if (smallestPush === pushLeft) position.x = minX;
  else if (smallestPush === pushRight) position.x = maxX;
  else if (smallestPush === pushBack) position.z = minZ;
  else position.z = maxZ;
}

function turnToward(current: number, target: number, maxStep: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}
