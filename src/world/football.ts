import * as THREE from "three";
import { PLAYER_RADIUS } from "./worldConstants";

export type TownBall = {
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

export function createFootballPitch(scene: THREE.Scene): TownBall {
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

export function updateFootball(ball: TownBall, player: THREE.Group, delta: number): boolean {
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

  if (scoredLeft || scoredRight) ball.goalCooldown = 1.2;

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
