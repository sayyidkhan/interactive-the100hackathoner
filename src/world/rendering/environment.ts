import * as THREE from "three";
import {
  PERIMETER_WALL_CENTER,
  PERIMETER_WALL_THICKNESS,
  TOWN_SPREAD
} from "../worldConstants";
import { addRock } from "./props";

export function addWaterfront(scene: THREE.Scene): void {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 18),
    new THREE.MeshStandardMaterial({
      color: "#52aac0",
      roughness: 0.35,
      metalness: 0.05
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-8, -0.02, 31);
  water.userData.environmentRole = "water";
  scene.add(water);

  for (let i = 0; i < 26; i += 1) {
    addRock(scene, -31 + i * 2.45, 22.2 + Math.sin(i) * 0.85, 0.45 + (i % 3) * 0.12);
  }
}

export function addPerimeterWalls(scene: THREE.Scene): void {
  const boundary = PERIMETER_WALL_CENTER;
  const wallHeight = 3.25;
  const wallThickness = PERIMETER_WALL_THICKNESS;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#456d43",
    emissive: "#29472d",
    emissiveIntensity: 0.18,
    roughness: 0.96
  });
  const capMaterial = new THREE.MeshStandardMaterial({ color: "#5d8954", roughness: 0.94 });
  const wallSpecs = [
    { x: 0, z: -boundary, width: 72, depth: wallThickness },
    { x: 0, z: boundary, width: 72, depth: wallThickness },
    { x: -boundary, z: 0, width: wallThickness, depth: 72 },
    { x: boundary, z: 0, width: wallThickness, depth: 72 }
  ];

  for (const spec of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(spec.width, wallHeight, spec.depth), wallMaterial);
    wall.position.set(spec.x, wallHeight / 2, spec.z);
    wall.castShadow = false;
    wall.receiveShadow = true;
    wall.userData.environmentRole = "foliage";
    scene.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.18, 0.48, spec.depth + 0.18), capMaterial);
    cap.position.set(spec.x, wallHeight + 0.12, spec.z);
    cap.castShadow = false;
    cap.receiveShadow = true;
    cap.userData.environmentRole = "foliage";
    scene.add(cap);
  }
}

export function addLandscapeDetails(scene: THREE.Scene): void {
  const lawnMaterials = [
    new THREE.MeshStandardMaterial({ color: "#a3c393", roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: "#9abb87", roughness: 0.96 })
  ];
  const patches = [
    [-23, -19, 6.8, 0.82, 0.15, 0],
    [21, -18, 7.4, 0.76, -0.18, 1],
    [-23, 11, 7.1, 0.84, 0.34, 1],
    [22, 11, 7.7, 0.78, -0.28, 0],
    [0, 20, 8.6, 0.7, 0.08, 0]
  ] as const;

  for (const [x, z, radius, stretch, rotation, materialIndex] of patches) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), lawnMaterials[materialIndex]);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rotation;
    patch.scale.set(1, stretch, 1);
    patch.position.set(x, 0.008, z);
    patch.receiveShadow = true;
    patch.userData.environmentRole = "lawn";
    scene.add(patch);
  }
}

export function addPath(scene: THREE.Scene, x: number, z: number, width: number, depth: number, rotation: number): void {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: "#d9c6a8", roughness: 0.84 })
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.012, z);
  path.receiveShadow = true;
  path.userData.environmentRole = "path";
  scene.add(path);
}

export function addPathStones(scene: THREE.Scene): void {
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#d8c5a8", roughness: 0.95 });
  const positions = [
    [-5.8, -0.7],
    [-3.9, 0.6],
    [-1.9, -0.5],
    [2.2, 0.7],
    [4.6, -0.6],
    [0.6, 3.3],
    [-0.7, -4.2],
    [6.4, 4.8],
    [-6.2, 4.8]
  ];
  for (const [x, z] of positions) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.045, 7), stoneMaterial);
    stone.position.set(x * TOWN_SPREAD, 0.04, z * TOWN_SPREAD);
    stone.rotation.y = x + z;
    stone.receiveShadow = true;
    scene.add(stone);
  }
}
