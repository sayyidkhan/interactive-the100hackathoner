import * as THREE from "three";
import { type InputState } from "../../systems/input";
import {
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_RADIUS,
  PLAYER_STEP_HEIGHT,
  SURFACE_CLEARANCE,
  WALKABLE_WORLD_LIMIT
} from "../worldConstants";

export type PlayerMotion = {
  verticalVelocity: number;
  grounded: boolean;
  facingAngle: number;
  walkTime: number;
  velocity: THREE.Vector3;
  speed: number;
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
  const viewForward = new THREE.Vector3();
  camera.getWorldDirection(viewForward);
  viewForward.y = 0;
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
  const walkMultiplier = typeof player.userData.walkMultiplier === "number" ? player.userData.walkMultiplier : 1;
  const sprintMultiplier = typeof player.userData.sprintMultiplier === "number" ? player.userData.sprintMultiplier : 1;
  const targetSpeed = movementStrength > 0
    ? (input.sprint ? 7 * sprintMultiplier : 4.2 * walkMultiplier) * movementStrength
    : 0;

  if (movementStrength > 0) {
    direction.normalize();
    const responsiveness = input.sprint ? 11 : 9;
    motion.velocity.x = THREE.MathUtils.damp(motion.velocity.x, direction.x * targetSpeed, responsiveness, delta);
    motion.velocity.z = THREE.MathUtils.damp(motion.velocity.z, direction.z * targetSpeed, responsiveness, delta);
  } else {
    motion.velocity.x = THREE.MathUtils.damp(motion.velocity.x, 0, 13, delta);
    motion.velocity.z = THREE.MathUtils.damp(motion.velocity.z, 0, 13, delta);
  }

  motion.speed = Math.hypot(motion.velocity.x, motion.velocity.z);
  if (motion.speed > 0.025) {
    const nextPosition = player.position.clone().addScaledVector(motion.velocity, delta);
    const stepSurface = getWalkableSurfaceHeight(nextPosition, colliders, player.position.y + PLAYER_STEP_HEIGHT);
    if (motion.grounded && stepSurface > player.position.y + SURFACE_CLEARANCE) nextPosition.y = stepSurface;
    resolvePlayerCollisions(nextPosition, colliders);
    player.position.copy(nextPosition);
    const angle = Math.atan2(-motion.velocity.x, -motion.velocity.z);
    motion.facingAngle = turnToward(motion.facingAngle, angle, 12 * delta);
    player.rotation.y = motion.facingAngle;
    motion.walkTime += delta * motion.speed * 2.05;
    animateRig(player, motion.walkTime, true, motion.speed > 5);
  } else {
    motion.velocity.set(0, 0, 0);
    motion.speed = 0;
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

  clampToWalkableWorld(player.position);
}

function resolvePlayerCollisions(position: THREE.Vector3, colliders: CollisionShape[]): void {
  clampToWalkableWorld(position);

  for (const collider of colliders) {
    if (collider.top !== undefined && position.y >= collider.top - SURFACE_CLEARANCE) continue;
    if (collider.kind === "circle") resolveCircleCollision(position, collider);
    else resolveBoxCollision(position, collider);
  }

  clampToWalkableWorld(position);
}

function clampToWalkableWorld(position: THREE.Vector3): void {
  const playerCenterLimit = WALKABLE_WORLD_LIMIT - PLAYER_RADIUS;
  position.x = THREE.MathUtils.clamp(position.x, -playerCenterLimit, playerCenterLimit);
  position.z = THREE.MathUtils.clamp(position.z, -playerCenterLimit, playerCenterLimit);
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
