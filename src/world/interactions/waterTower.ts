import * as THREE from "three";
import { type TownSchema } from "../../data/townSchema";
import { type PlayerMotion, type PlayerRigAnimator } from "../player/movement";
import {
  PLAYER_RADIUS,
  TOWN_SPREAD,
  WATER_TOWER_LADDER_Z_OFFSET,
  WATER_TOWER_PLATFORM_HEIGHT,
  WATER_TOWER_PLATFORM_RADIUS
} from "../worldConstants";

export type WaterTowerClimbState = {
  mode: "ground" | "ascending" | "platform" | "descending";
};

export type WaterTowerAnchor = {
  x: number;
  z: number;
  ladderX: number;
  ladderZ: number;
  platformRadius: number;
  platformHeight: number;
};

export function toggleWaterTowerClimb(
  player: THREE.Group,
  motion: PlayerMotion,
  state: WaterTowerClimbState,
  tower: WaterTowerAnchor | null
): boolean {
  if (!tower) return false;
  const distanceToLadder = Math.hypot(player.position.x - tower.ladderX, player.position.z - tower.ladderZ);

  if (state.mode === "ground") {
    if (distanceToLadder > 1.3 || player.position.y > 0.35) return false;
    state.mode = "ascending";
    motion.verticalVelocity = 0;
    motion.grounded = false;
    return true;
  }

  if (state.mode === "platform") {
    const distanceToTower = Math.hypot(player.position.x - tower.x, player.position.z - tower.z);
    if (distanceToTower > tower.platformRadius + 0.35) return false;
    state.mode = "descending";
    motion.verticalVelocity = 0;
    motion.grounded = false;
    return true;
  }

  return true;
}

export function updateWaterTowerClimb(
  player: THREE.Group,
  motion: PlayerMotion,
  state: WaterTowerClimbState,
  delta: number,
  tower: WaterTowerAnchor | null,
  animateRig: PlayerRigAnimator
): boolean {
  if (!tower) {
    state.mode = "ground";
    return false;
  }

  if (state.mode === "platform") {
    if (player.position.y < 0.5) state.mode = "ground";
    return false;
  }
  if (state.mode === "ground") return false;

  const climbSpeed = 2.55;
  const anchorBlend = 1 - Math.exp(-20 * delta);
  player.position.x = THREE.MathUtils.lerp(player.position.x, tower.ladderX, anchorBlend);
  player.position.z = THREE.MathUtils.lerp(player.position.z, tower.ladderZ, anchorBlend);
  player.rotation.y = Math.PI;
  motion.facingAngle = Math.PI;
  motion.walkTime += delta * 6;

  if (state.mode === "ascending") {
    player.position.y = Math.min(tower.platformHeight, player.position.y + climbSpeed * delta);
    if (player.position.y >= tower.platformHeight) {
      state.mode = "platform";
      motion.grounded = true;
    }
  } else {
    player.position.y = Math.max(0, player.position.y - climbSpeed * delta);
    if (player.position.y <= 0) {
      const ladderDirection = new THREE.Vector2(tower.ladderX - tower.x, tower.ladderZ - tower.z).normalize();
      player.position.set(
        tower.x + ladderDirection.x * (tower.platformRadius + PLAYER_RADIUS + 0.08),
        0,
        tower.z + ladderDirection.y * (tower.platformRadius + PLAYER_RADIUS + 0.08)
      );
      state.mode = "ground";
      motion.grounded = true;
    }
  }

  motion.verticalVelocity = 0;
  animateRig(player, motion.walkTime, true, false);
  return true;
}

export function getWaterTowerAnchor(schema: TownSchema): WaterTowerAnchor | null {
  const tower = schema.assets.find((asset) => asset.type === "waterTower");
  if (!tower) return null;

  const scale = tower.scale ?? 1;
  const platformRadius = tower.collision?.kind === "circle"
    ? tower.collision.radius * scale
    : WATER_TOWER_PLATFORM_RADIUS * scale;
  const platformHeight = (tower.collision?.top ?? WATER_TOWER_PLATFORM_HEIGHT) * scale;
  const [x, z] = tower.position;
  const rotation = tower.rotation ?? 0;
  const ladderOffset = new THREE.Vector3(0, 0, WATER_TOWER_LADDER_Z_OFFSET * scale)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
  const worldX = x * TOWN_SPREAD;
  const worldZ = z * TOWN_SPREAD;

  return {
    x: worldX,
    z: worldZ,
    ladderX: worldX + ladderOffset.x,
    ladderZ: worldZ + ladderOffset.z,
    platformRadius,
    platformHeight
  };
}
