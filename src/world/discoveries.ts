import * as THREE from "three";
import { DISCOVERIES, type DiscoveryEntry } from "../data/discoveries";
import { roundRect, splitCanvasLines } from "./rendering/canvas";
import { TOWN_SPREAD } from "./worldConstants";

const INSPECT_RADIUS = 2.35;
const UNLOCK_BURST_DURATION = 1.45;

export type DiscoveryMarker = {
  entry: DiscoveryEntry;
  object: THREE.Object3D;
  plinth: THREE.Mesh;
  plinthMaterial: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  halo: THREE.Mesh;
  badge: THREE.Sprite;
  savedSeal: THREE.Sprite;
  beacon: THREE.Mesh;
  callout: THREE.Sprite;
  calloutMaterial: THREE.SpriteMaterial;
  calloutNextTexture: THREE.CanvasTexture;
  calloutTrackedTexture: THREE.CanvasTexture;
};

export type RouteBreadcrumb = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  rail: THREE.Mesh;
  railMaterial: THREE.MeshBasicMaterial;
  phase: number;
};

export type UnlockBurst = {
  group: THREE.Group;
  startedAt: number;
  rings: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }>;
  sparks: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    angle: number;
    radius: number;
    height: number;
  }>;
};

export function createDiscoveryMarkers(scene: THREE.Scene): DiscoveryMarker[] {
  const starTexture = createStarTexture();
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffd868", transparent: true, opacity: 0.44, depthWrite: false });
  const haloMaterial = new THREE.MeshBasicMaterial({ color: "#fff1a8", transparent: true, opacity: 0.18, depthWrite: false });

  return DISCOVERIES.map((entry) => {
    const accent = getDiscoveryAccent(entry);
    const markerX = entry.position.x * TOWN_SPREAD;
    const markerZ = entry.position.z * TOWN_SPREAD;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture, transparent: true, depthWrite: false }));
    sprite.position.set(markerX, 1.55, markerZ);
    sprite.scale.set(0.76, 0.76, 0.76);
    scene.add(sprite);

    const plinthMaterial = new THREE.MeshStandardMaterial({ color: "#fff4cf", roughness: 0.55 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.14, 12), plinthMaterial);
    plinth.position.set(markerX, 0.07, markerZ);
    plinth.castShadow = true;
    scene.add(plinth);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.02, 8, 48), ringMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(markerX, 0.045, markerZ);
    ring.renderOrder = 2;
    scene.add(ring);

    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.68, 40), haloMaterial.clone());
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(markerX, 0.034, markerZ);
    halo.renderOrder = 1;
    scene.add(halo);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.28, 2.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: "#ffd868", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    beacon.position.set(markerX, 1.12, markerZ);
    beacon.renderOrder = 1;
    beacon.visible = false;
    beacon.userData.softShadow = true;
    scene.add(beacon);

    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: createNumberBadgeTexture(entry), transparent: true, depthWrite: false }));
    badge.position.set(markerX, 2.08, markerZ);
    badge.scale.set(0.78, 0.3, 1);
    badge.visible = false;
    scene.add(badge);

    const savedSeal = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: createSavedSealTexture(accent), transparent: true, depthWrite: false, depthTest: false, opacity: 0 })
    );
    savedSeal.position.set(markerX, 1.08, markerZ);
    savedSeal.scale.set(0.78, 0.3, 1);
    savedSeal.renderOrder = 4;
    savedSeal.visible = false;
    scene.add(savedSeal);

    const calloutNextTexture = createWaypointCalloutTexture(entry, accent, false);
    const calloutTrackedTexture = createWaypointCalloutTexture(entry, accent, true);
    const calloutMaterial = new THREE.SpriteMaterial({ map: calloutNextTexture, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const callout = new THREE.Sprite(calloutMaterial);
    callout.position.set(markerX, 2.88, markerZ);
    callout.scale.set(3.35, 1.05, 1);
    callout.renderOrder = 5;
    callout.visible = false;
    scene.add(callout);

    return { entry, object: sprite, plinth, plinthMaterial, ring, halo, badge, savedSeal, beacon, callout, calloutMaterial, calloutNextTexture, calloutTrackedTexture };
  });
}

export function createRouteBreadcrumbs(scene: THREE.Scene): RouteBreadcrumb[] {
  return Array.from({ length: 7 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: "#ffc83d", transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.21, 24), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.058;
    mesh.renderOrder = 3;
    mesh.visible = false;
    mesh.userData.softShadow = true;
    const railMaterial = new THREE.MeshBasicMaterial({ color: "#ffc83d", transparent: true, opacity: 0, depthWrite: false });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 1), railMaterial);
    rail.position.y = 0.052;
    rail.renderOrder = 2;
    rail.visible = false;
    rail.userData.softShadow = true;
    scene.add(mesh);
    scene.add(rail);
    return { mesh, material, rail, railMaterial, phase: index * 0.55 };
  });
}

export function createUnlockBurst(scene: THREE.Scene, marker: DiscoveryMarker, startedAt: number): UnlockBurst {
  const accent = getDiscoveryAccent(marker.entry);
  const group = new THREE.Group();
  group.position.set(marker.object.position.x, 0, marker.object.position.z);
  group.renderOrder = 4;
  scene.add(group);

  const rings = [0.42, 0.68].map((radius, index) => {
    const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: index === 0 ? 0.62 : 0.38, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 56), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.08 + index * 0.025;
    mesh.renderOrder = 4;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return { mesh, material };
  });

  const sparks = Array.from({ length: 12 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? "#fff4cf" : accent, transparent: true, opacity: 0.92, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(index % 3 === 0 ? 0.055 : 0.04, 10, 8), material);
    mesh.renderOrder = 5;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return { mesh, material, angle: index * ((Math.PI * 2) / 12), radius: 0.65 + (index % 4) * 0.12, height: 0.55 + (index % 5) * 0.1 };
  });
  return { group, startedAt, rings, sparks };
}

export function updateUnlockBursts(scene: THREE.Scene, bursts: UnlockBurst[], time: number): void {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    const progress = THREE.MathUtils.clamp((time - burst.startedAt) / UNLOCK_BURST_DURATION, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const fade = 1 - progress;
    burst.rings.forEach((ring, ringIndex) => {
      ring.mesh.scale.setScalar(1 + eased * (1.5 + ringIndex * 0.7));
      ring.material.opacity = fade * (ringIndex === 0 ? 0.62 : 0.38);
    });
    burst.sparks.forEach((spark, sparkIndex) => {
      const drift = spark.radius * eased;
      spark.mesh.position.set(Math.cos(spark.angle) * drift, 0.35 + Math.sin(progress * Math.PI) * spark.height + progress * 0.35, Math.sin(spark.angle) * drift);
      spark.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.9 + (sparkIndex % 2) * 0.12);
      spark.material.opacity = fade * 0.92;
    });
    if (progress >= 1) {
      disposeUnlockBurst(scene, burst);
      bursts.splice(index, 1);
    }
  }
}

export function findNearestDiscovery(playerPosition: THREE.Vector3, markers: DiscoveryMarker[]): DiscoveryEntry | null {
  let nearest: DiscoveryEntry | null = null;
  let nearestDistance = INSPECT_RADIUS;
  for (const marker of markers) {
    const dx = playerPosition.x - marker.object.position.x;
    const dz = playerPosition.z - marker.object.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = marker.entry;
    }
  }
  return nearest;
}

export function findWaypointSelection(
  playerPosition: THREE.Vector3,
  markers: DiscoveryMarker[],
  discovered: Set<string>,
  selectedWaypointId: string | null
): { marker: DiscoveryMarker; distance: number; heading: string; tracked: boolean } | null {
  if (selectedWaypointId && !discovered.has(selectedWaypointId)) {
    const trackedMarker = markers.find((marker) => marker.entry.id === selectedWaypointId);
    if (trackedMarker) {
      const dx = trackedMarker.object.position.x - playerPosition.x;
      const dz = trackedMarker.object.position.z - playerPosition.z;
      return { marker: trackedMarker, distance: Math.hypot(dx, dz), heading: getHeadingLabel(dx, dz), tracked: true };
    }
  }
  const nearest = findNearestUndiscovered(playerPosition, markers, discovered);
  return nearest ? { ...nearest, tracked: false } : null;
}

export function updateRouteBreadcrumbs(
  breadcrumbs: RouteBreadcrumb[],
  playerPosition: THREE.Vector3,
  waypoint: DiscoveryMarker | null,
  time: number,
  tracked: boolean
): void {
  if (!waypoint) return hideRouteBreadcrumbs(breadcrumbs);
  const direction = new THREE.Vector3(waypoint.object.position.x - playerPosition.x, 0, waypoint.object.position.z - playerPosition.z);
  const distance = direction.length();
  if (distance < 1.35) return hideRouteBreadcrumbs(breadcrumbs);
  direction.normalize();
  const visibleDistance = Math.min(distance - 0.7, 7.2);
  const step = visibleDistance / (breadcrumbs.length + 0.5);
  const routeColor = tracked ? "#d2ad6a" : "#ffc83d";
  const routeGlow = tracked ? "#fff4cf" : "#ffd868";
  const angle = Math.atan2(direction.x, direction.z);
  breadcrumbs.forEach((breadcrumb, index) => {
    const travel = 0.72 + step * (index + 0.35);
    const fadeNearTarget = THREE.MathUtils.clamp((distance - travel) / 1.8, 0, 1);
    const pulse = 0.92 + Math.sin(time * 4.2 - breadcrumb.phase) * 0.12;
    const railLength = Math.max(0.34, step * 0.78);
    const railTravel = Math.max(0.55, travel - railLength * 0.48);
    const railPulse = 0.88 + Math.sin(time * 3.1 - breadcrumb.phase) * 0.08;
    const opacity = (0.52 - index * 0.035) * fadeNearTarget;
    breadcrumb.mesh.visible = true;
    breadcrumb.mesh.position.set(playerPosition.x + direction.x * travel, 0.058 + index * 0.001, playerPosition.z + direction.z * travel);
    breadcrumb.mesh.scale.setScalar(pulse * (1 - index * 0.035));
    breadcrumb.material.color.set(index % 2 === 0 ? routeGlow : routeColor);
    breadcrumb.material.opacity = opacity;
    breadcrumb.rail.visible = true;
    breadcrumb.rail.position.set(playerPosition.x + direction.x * railTravel, 0.052 + index * 0.001, playerPosition.z + direction.z * railTravel);
    breadcrumb.rail.rotation.y = angle;
    breadcrumb.rail.scale.set(1 + (tracked ? 0.34 : 0.18) * railPulse, 1, railLength);
    breadcrumb.railMaterial.color.set(routeColor);
    breadcrumb.railMaterial.opacity = opacity * (tracked ? 0.92 : 0.72);
  });
}

export function updateMarkers(
  markers: DiscoveryMarker[],
  discovered: Set<string>,
  time: number,
  waypointId: string | null,
  waypointTracked: boolean,
  playerPosition: THREE.Vector3
): void {
  for (const marker of markers) {
    const unlocked = discovered.has(marker.entry.id);
    const isWaypoint = marker.entry.id === waypointId;
    const dx = marker.object.position.x - playerPosition.x;
    const dz = marker.object.position.z - playerPosition.z;
    const isNearby = dx * dx + dz * dz < 18;
    const scale = unlocked ? 0.48 : isWaypoint ? 0.78 + Math.sin(time * 4 + marker.entry.number) * 0.06 : 0.52 + Math.sin(time * 3 + marker.entry.number) * 0.035;
    marker.object.scale.setScalar(scale);
    marker.object.position.y = (unlocked ? 1.32 : 1.55) + Math.sin(time * (isWaypoint ? 3.1 : 2.4) + marker.entry.number) * (isWaypoint ? 0.18 : 0.12);
    marker.badge.position.y = marker.object.position.y + 0.5;
    marker.savedSeal.position.y = 1.08 + Math.sin(time * 1.8 + marker.entry.number) * 0.03;
    const badgeScale = unlocked ? 0.68 : isWaypoint ? 0.98 : 0.82;
    marker.badge.scale.set(0.78 * badgeScale, 0.3 * badgeScale, 1);
    marker.plinth.scale.set(unlocked ? 1.18 : 1, unlocked ? 0.82 : 1, unlocked ? 1.18 : 1);
    marker.plinthMaterial.color.set(unlocked ? "#dfe9d1" : "#fff4cf");
    marker.plinthMaterial.roughness = unlocked ? 0.72 : 0.55;
    const pulse = 1 + Math.sin(time * 2.5 + marker.entry.number) * 0.08;
    marker.ring.scale.setScalar(unlocked ? 0.88 : isWaypoint ? 1.34 + Math.sin(time * 3.4) * 0.1 : pulse);
    marker.halo.scale.setScalar(unlocked ? 0.72 : isWaypoint ? 1.55 + Math.sin(time * 2.7) * 0.16 : 1.05 + Math.sin(time * 2 + marker.entry.number) * 0.1);
    const ringMaterial = marker.ring.material;
    const haloMaterial = marker.halo.material;
    if (ringMaterial instanceof THREE.MeshBasicMaterial) ringMaterial.opacity = unlocked ? 0.1 : isWaypoint ? 0.58 : isNearby ? 0.28 : 0.08;
    if (haloMaterial instanceof THREE.MeshBasicMaterial) haloMaterial.opacity = unlocked ? 0.04 : isWaypoint ? 0.2 : isNearby ? 0.1 : 0.025;
    const badgeMaterial = marker.badge.material;
    marker.badge.visible = isNearby || isWaypoint;
    if (badgeMaterial instanceof THREE.SpriteMaterial) badgeMaterial.opacity = unlocked ? 0.38 : isWaypoint ? 0.9 : 0.72;
    const spriteMaterial = marker.object instanceof THREE.Sprite ? marker.object.material : null;
    if (spriteMaterial instanceof THREE.SpriteMaterial) spriteMaterial.opacity = unlocked ? 0.25 : isWaypoint ? 0.92 : isNearby ? 0.62 : 0.28;
    marker.savedSeal.visible = unlocked && isNearby;
    const savedSealMaterial = marker.savedSeal.material;
    if (savedSealMaterial instanceof THREE.SpriteMaterial) savedSealMaterial.opacity = unlocked ? 0.94 : 0;
    marker.savedSeal.scale.set(0.78 + Math.sin(time * 2 + marker.entry.number) * 0.016, 0.3, 1);
    marker.beacon.visible = false;
    marker.beacon.rotation.y = time * 0.45;
    marker.beacon.scale.setScalar(isWaypoint ? 1 + Math.sin(time * 2.1) * 0.06 : 1);
    const beaconMaterial = marker.beacon.material;
    if (beaconMaterial instanceof THREE.MeshBasicMaterial) beaconMaterial.opacity = 0;
    marker.callout.visible = false;
    const calloutOffsetX = marker.object.position.x < -1 ? 5.2 : marker.object.position.x > 1 ? -2.6 : 2.2;
    const calloutOffsetZ = marker.object.position.z > 0 ? -0.9 : 0.72;
    marker.callout.position.set(marker.object.position.x + calloutOffsetX, marker.object.position.y + 1.22 + Math.sin(time * 1.9 + marker.entry.number) * 0.04, marker.object.position.z + calloutOffsetZ);
    marker.callout.scale.setScalar(isWaypoint ? 1 + Math.sin(time * 2.2 + marker.entry.number) * 0.025 : 1);
    marker.callout.scale.x *= 3.35;
    marker.callout.scale.y *= 1.05;
    const calloutMap = waypointTracked && isWaypoint ? marker.calloutTrackedTexture : marker.calloutNextTexture;
    if (marker.calloutMaterial.map !== calloutMap) {
      marker.calloutMaterial.map = calloutMap;
      marker.calloutMaterial.needsUpdate = true;
    }
    marker.calloutMaterial.opacity = 0;
  }
}

function findNearestUndiscovered(
  playerPosition: THREE.Vector3,
  markers: DiscoveryMarker[],
  discovered: Set<string>
): { marker: DiscoveryMarker; distance: number; heading: string } | null {
  let nearest: DiscoveryMarker | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    if (discovered.has(marker.entry.id)) continue;
    const dx = marker.object.position.x - playerPosition.x;
    const dz = marker.object.position.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance < nearestDistance) {
      nearest = marker;
      nearestDistance = distance;
    }
  }
  if (!nearest) return null;
  return { marker: nearest, distance: nearestDistance, heading: getHeadingLabel(nearest.object.position.x - playerPosition.x, nearest.object.position.z - playerPosition.z) };
}

function hideRouteBreadcrumbs(breadcrumbs: RouteBreadcrumb[]): void {
  for (const breadcrumb of breadcrumbs) {
    breadcrumb.mesh.visible = false;
    breadcrumb.material.opacity = 0;
    breadcrumb.rail.visible = false;
    breadcrumb.railMaterial.opacity = 0;
  }
}

function getHeadingLabel(dx: number, dz: number): string {
  const northSouth = dz < -0.75 ? "N" : dz > 0.75 ? "S" : "";
  const eastWest = dx > 0.75 ? "E" : dx < -0.75 ? "W" : "";
  return `${northSouth}${eastWest}` || "here";
}

function disposeUnlockBurst(scene: THREE.Scene, burst: UnlockBurst): void {
  scene.remove(burst.group);
  burst.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
  });
}

function getDiscoveryAccent(entry: DiscoveryEntry): string {
  const colors: Record<DiscoveryEntry["theme"], string> = {
    "ai-agents": "#6fa6a0", saas: "#d78c75", sustainability: "#85ad6f", crypto: "#7f8eaa", devtools: "#f0c86b", founder: "#d2ad6a", story: "#ee765f"
  };
  return colors[entry.theme];
}

function createStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create star canvas");
  context.clearRect(0, 0, 128, 128);
  context.shadowColor = "#ffd45e";
  context.shadowBlur = 20;
  context.fillStyle = "#ffc83d";
  context.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 48 : 20;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 64 + Math.cos(angle) * radius;
    const y = 64 + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNumberBadgeTexture(entry: DiscoveryEntry): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create marker badge canvas");
  const label = entry.number === 0 ? "START" : `#${entry.number.toString().padStart(2, "0")}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.28)";
  context.shadowBlur = 14;
  roundRect(context, 18, 14, 220, 64, 18);
  context.fillStyle = "#fffaf0";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = "#ffc83d";
  context.stroke();
  context.fillStyle = "#3e352a";
  context.font = entry.number === 0 ? "800 28px Inter, sans-serif" : "900 34px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaypointCalloutTexture(entry: DiscoveryEntry, accent: string, tracked: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 168;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create waypoint callout canvas");
  const label = tracked ? "TRACKED STORY" : "NEXT STORY";
  const number = entry.number === 0 ? "START" : `#${entry.number.toString().padStart(3, "0")}`;
  const titleLines = splitCanvasLines(context, entry.title, 330, "900 34px Georgia, serif", 2);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.3)";
  context.shadowBlur = 18;
  roundRect(context, 20, 18, 472, 128, 18);
  context.fillStyle = tracked ? "rgba(255, 250, 240, 0.96)" : "rgba(255, 250, 240, 0.93)";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = tracked ? "#d2ad6a" : accent;
  context.stroke();
  context.fillStyle = tracked ? "#8d6428" : accent;
  context.font = "900 20px Inter, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, 44, 48);
  context.fillStyle = "#6f675a";
  context.font = "900 18px Inter, sans-serif";
  context.textAlign = "right";
  context.fillText(number, 468, 48);
  context.fillStyle = "#2f2922";
  context.font = "900 34px Georgia, serif";
  context.textAlign = "left";
  titleLines.forEach((line, index) => context.fillText(line, 44, 87 + index * 35));
  context.fillStyle = "#71685b";
  context.font = "800 18px Inter, sans-serif";
  context.fillText(entry.district, 44, titleLines.length > 1 ? 148 : 126);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSavedSealTexture(accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create saved seal canvas");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.22)";
  context.shadowBlur = 12;
  roundRect(context, 28, 20, 200, 56, 18);
  context.fillStyle = "#fffaf0";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 5;
  context.strokeStyle = accent;
  context.stroke();
  context.fillStyle = accent;
  context.beginPath();
  context.arc(64, 48, 15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fffaf0";
  context.font = "900 18px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("OK", 64, 49);
  context.fillStyle = "#3e352a";
  context.font = "900 24px Inter, sans-serif";
  context.textAlign = "left";
  context.fillText("SAVED", 88, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
