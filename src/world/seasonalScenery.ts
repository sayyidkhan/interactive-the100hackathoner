import * as THREE from "three";
import { type SeasonChoice } from "../data/townSchema";
import { createSoftShadow } from "./rendering/shadows";

type ActiveSeason = Exclude<SeasonChoice, "auto">;

type TreeAnchor = {
  position: THREE.Vector3;
  scale: number;
  canopyY: number;
  canopyRadius: number;
};

type AnimatedFlower = {
  group: THREE.Group;
  baseY: number;
  phase: number;
};

export type SeasonalScenery = {
  root: THREE.Group;
  spring: THREE.Group;
  autumn: THREE.Group;
  winter: THREE.Group;
  flowers: AnimatedFlower[];
  activeSeason: ActiveSeason;
};

const SPRING_COLORS = ["#ed8ea6", "#f4bd63", "#d9a0d5", "#f3d479", "#e77f78"];
const AUTUMN_COLORS = ["#c66a35", "#db9144", "#a94f32", "#d5aa4c", "#8e5c34"];

export function createSeasonalScenery(
  scene: THREE.Scene,
  assetLayer: THREE.Group
): SeasonalScenery {
  const root = new THREE.Group();
  root.name = "seasonal-scenery";
  const spring = new THREE.Group();
  spring.name = "seasonal-spring";
  const autumn = new THREE.Group();
  autumn.name = "seasonal-autumn";
  const winter = new THREE.Group();
  winter.name = "seasonal-winter";
  root.add(spring, autumn, winter);
  scene.add(root);

  const scenery: SeasonalScenery = {
    root,
    spring,
    autumn,
    winter,
    flowers: [],
    activeSeason: "summer"
  };
  refreshSeasonalSceneryLayout(scenery, assetLayer);
  setSeasonalScenerySeason(scenery, "summer");
  return scenery;
}

export function refreshSeasonalSceneryLayout(
  scenery: SeasonalScenery,
  assetLayer: THREE.Group
): void {
  clearGroup(scenery.spring);
  clearGroup(scenery.autumn);
  clearGroup(scenery.winter);
  scenery.flowers.length = 0;

  const anchors = getTreeAnchors(assetLayer);
  buildSpringScenery(scenery, anchors);
  buildAutumnScenery(scenery.autumn, anchors);
  buildWinterScenery(scenery.winter, anchors);
  setSeasonalScenerySeason(scenery, scenery.activeSeason);
}

export function setSeasonalScenerySeason(
  scenery: SeasonalScenery,
  season: ActiveSeason
): void {
  scenery.activeSeason = season;
  scenery.spring.visible = season === "spring" || season === "wet";
  scenery.autumn.visible = season === "autumn" || season === "dry";
  scenery.winter.visible = season === "winter";
}

export function updateSeasonalScenery(scenery: SeasonalScenery, time: number): void {
  if (!scenery.spring.visible) return;
  scenery.flowers.forEach((flower) => {
    flower.group.position.y = flower.baseY + Math.sin(time * 1.15 + flower.phase) * 0.025;
    flower.group.rotation.z = Math.sin(time * 0.78 + flower.phase) * 0.045;
  });
}

function getTreeAnchors(assetLayer: THREE.Group): TreeAnchor[] {
  assetLayer.updateWorldMatrix(true, true);
  const worldPosition = new THREE.Vector3();
  const worldScale = new THREE.Vector3();
  const bounds = new THREE.Box3();
  return assetLayer.children
    .filter((asset) => asset.userData.schemaAssetType === "tree")
    .map((asset) => {
      asset.getWorldPosition(worldPosition);
      asset.getWorldScale(worldScale);
      bounds.setFromObject(asset);
      const width = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
      return {
        position: worldPosition.clone(),
        scale: worldScale.x,
        canopyY: bounds.max.y - 0.14,
        canopyRadius: THREE.MathUtils.clamp(width * 0.28, 0.55, 1.05)
      };
    });
}

function buildSpringScenery(scenery: SeasonalScenery, anchors: TreeAnchor[]): void {
  const stemGeometry = new THREE.CylinderGeometry(0.018, 0.026, 0.24, 5);
  const bloomGeometry = new THREE.SphereGeometry(0.095, 7, 5);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: "#558152", roughness: 0.92 });
  const bloomMaterials = SPRING_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );

  anchors.forEach((anchor, anchorIndex) => {
    const flowersPerTree = anchorIndex % 3 === 0 ? 5 : 3;
    for (let index = 0; index < flowersPerTree; index += 1) {
      const angle = index * 2.31 + anchorIndex * 0.83;
      const radius = 0.62 + (index % 3) * 0.26;
      addFlower(
        scenery,
        anchor.position.x + Math.cos(angle) * radius,
        anchor.position.z + Math.sin(angle) * radius,
        0.82 + ((anchorIndex + index) % 4) * 0.1,
        stemGeometry,
        bloomGeometry,
        stemMaterial,
        bloomMaterials[(anchorIndex + index) % bloomMaterials.length],
        anchorIndex * 0.71 + index
      );
    }
  });

  for (const [index, [x, z]] of [
    [-4.8, 8.5],
    [5.8, 8.1],
    [-8.6, -1.2],
    [9.2, -0.8],
    [-3.4, -10.4],
    [4.6, -10.2]
  ].entries()) {
    for (let flowerIndex = 0; flowerIndex < 5; flowerIndex += 1) {
      const angle = flowerIndex * 1.91 + index;
      addFlower(
        scenery,
        x + Math.cos(angle) * (0.24 + flowerIndex * 0.08),
        z + Math.sin(angle) * (0.24 + flowerIndex * 0.08),
        0.9 + (flowerIndex % 3) * 0.08,
        stemGeometry,
        bloomGeometry,
        stemMaterial,
        bloomMaterials[(index + flowerIndex) % bloomMaterials.length],
        index * 1.3 + flowerIndex
      );
    }
  }
}

function addFlower(
  scenery: SeasonalScenery,
  x: number,
  z: number,
  scale: number,
  stemGeometry: THREE.CylinderGeometry,
  bloomGeometry: THREE.SphereGeometry,
  stemMaterial: THREE.MeshStandardMaterial,
  bloomMaterial: THREE.MeshStandardMaterial,
  phase: number
): void {
  const flower = new THREE.Group();
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = 0.12;
  stem.castShadow = true;
  const bloom = new THREE.Mesh(bloomGeometry, bloomMaterial);
  bloom.position.y = 0.27;
  bloom.scale.set(1.18, 0.7, 1.18);
  bloom.castShadow = true;
  flower.add(stem, bloom);
  flower.position.set(x, 0.025, z);
  flower.scale.setScalar(scale);
  scenery.spring.add(flower);
  scenery.flowers.push({ group: flower, baseY: flower.position.y, phase });
}

function buildAutumnScenery(group: THREE.Group, anchors: TreeAnchor[]): void {
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0.17);
  leafShape.quadraticCurveTo(0.1, 0, 0, -0.17);
  leafShape.quadraticCurveTo(-0.1, 0, 0, 0.17);
  const leafGeometry = new THREE.ShapeGeometry(leafShape);
  const materials = AUTUMN_COLORS.map(
    (color) => new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );

  anchors.forEach((anchor, anchorIndex) => {
    const leafCount = 9 + (anchorIndex % 4);
    for (let index = 0; index < leafCount; index += 1) {
      const angle = index * 2.17 + anchorIndex * 0.61;
      const radius = 0.34 + (index % 5) * 0.22;
      const leaf = new THREE.Mesh(leafGeometry, materials[(anchorIndex + index) % materials.length]);
      leaf.position.set(
        anchor.position.x + Math.cos(angle) * radius,
        0.052 + (index % 3) * 0.002,
        anchor.position.z + Math.sin(angle) * radius
      );
      leaf.rotation.set(-Math.PI / 2, 0, angle + index * 0.41);
      const scale = (0.7 + (index % 4) * 0.12) * anchor.scale;
      leaf.scale.set(scale, scale, scale);
      leaf.receiveShadow = true;
      group.add(leaf);
    }
  });
}

function buildWinterScenery(group: THREE.Group, anchors: TreeAnchor[]): void {
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: "#f4f2e9",
    roughness: 0.94,
    transparent: true,
    opacity: 0.97,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  const patchGeometry = new THREE.CircleGeometry(1, 10);
  const capGeometry = new THREE.SphereGeometry(1, 9, 6);

  anchors.forEach((anchor, index) => {
    addSnowPatch(
      group,
      anchor.position.x + Math.sin(index * 1.7) * 0.22,
      anchor.position.z + Math.cos(index * 1.31) * 0.18,
      1.05 + (index % 4) * 0.13,
      0.72 + (index % 3) * 0.11,
      index * 0.67,
      patchGeometry,
      snowMaterial
    );

    const cap = new THREE.Mesh(capGeometry, snowMaterial);
    cap.position.set(anchor.position.x, anchor.canopyY, anchor.position.z);
    cap.scale.set(anchor.canopyRadius, 0.13, anchor.canopyRadius * 0.82);
    cap.castShadow = false;
    cap.receiveShadow = true;
    group.add(cap);
  });

  for (const [index, [x, z, width, depth]] of [
    [-7.2, 5.9, 1.8, 0.74],
    [7.4, 6.2, 1.55, 0.66],
    [-9.6, -4.8, 1.7, 0.72],
    [10.2, -4.6, 1.9, 0.78],
    [-2.5, -10.5, 1.45, 0.62],
    [3.1, 10.7, 1.6, 0.7]
  ].entries()) {
    addSnowPatch(group, x, z, width, depth, index * 0.81, patchGeometry, snowMaterial);
  }

  group.add(createSnowman(-7.8, 7.4, 0.34));
  group.add(createSnowman(9.8, -2.8, -0.7, 0.82));
}

function addSnowPatch(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  geometry: THREE.CircleGeometry,
  material: THREE.MeshStandardMaterial
): void {
  const patch = new THREE.Mesh(geometry, material);
  patch.position.set(x, 0.042, z);
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = rotation;
  patch.scale.set(width, depth, 1);
  patch.receiveShadow = true;
  group.add(patch);
}

function createSnowman(
  x: number,
  z: number,
  rotation: number,
  scale = 1
): THREE.Group {
  const group = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: "#f5f2e8", roughness: 0.88 });
  const coal = new THREE.MeshStandardMaterial({ color: "#343431", roughness: 0.82 });
  const carrot = new THREE.MeshStandardMaterial({ color: "#df7f32", roughness: 0.76 });
  const scarf = new THREE.MeshStandardMaterial({ color: "#c9554c", roughness: 0.8 });
  const twig = new THREE.MeshStandardMaterial({ color: "#70513b", roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 7), snow);
  body.position.y = 0.57;
  body.scale.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 7), snow);
  head.position.y = 1.35;
  head.castShadow = true;
  group.add(body, head);

  for (const offsetX of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 5), coal);
    eye.position.set(offsetX, 1.43, 0.37);
    group.add(eye);
  }
  for (const y of [0.48, 0.7, 0.92]) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), coal);
    button.position.set(0, y, 0.54);
    group.add(button);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 7), carrot);
  nose.position.set(0, 1.34, 0.49);
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 6, 12), scarf);
  scarfRing.position.y = 1.08;
  scarfRing.rotation.x = Math.PI / 2;
  group.add(scarfRing);
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.06), scarf);
  scarfTail.position.set(0.24, 0.91, 0.3);
  scarfTail.rotation.z = -0.2;
  group.add(scarfTail);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.72, 5), twig);
    arm.position.set(side * 0.58, 0.88, 0);
    arm.rotation.z = side * 1.08;
    arm.castShadow = true;
    group.add(arm);
  }

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10), coal);
  hatBrim.position.y = 1.73;
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.36, 10), coal);
  hatCrown.position.y = 1.92;
  group.add(hatBrim, hatCrown);

  const shadow = createSoftShadow(1.4, 0.92, 0.2);
  shadow.position.set(0.15, 0.034, 0.12);
  group.add(shadow);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.scale.setScalar(scale);
  return group;
}

function clearGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const candidates = Array.isArray(object.material) ? object.material : [object.material];
    candidates.forEach((material) => materials.add(material));
  });
  group.clear();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
