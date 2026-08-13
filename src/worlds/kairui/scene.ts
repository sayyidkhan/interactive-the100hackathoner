import * as THREE from "three";
import type { CollisionShape } from "../../world/player/movement";
import { addSoftShadow, applySceneShadows } from "../../world/rendering/shadows";
import { COASTAL_LANDMARKS, type CoastalLandmark } from "./content";
import { makeSkyMaterial, makeWaterMaterial, matte } from "./materials";
import type { CoastalEnvironmentState, CoastalPalette } from "./environment";

export type LandmarkAnchor = {
  landmark: CoastalLandmark;
  object: THREE.Group;
  marker: THREE.Mesh;
};

export type CoastalScene = {
  colliders: CollisionShape[];
  landmarks: LandmarkAnchor[];
  transit: { boat: THREE.Group; balloon: THREE.Group };
  getGroundHeight(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  applyEnvironment(state: CoastalEnvironmentState, palette: CoastalPalette): void;
  setTourRoute(from: THREE.Vector3, target: THREE.Vector3 | null): void;
  update(time: number, delta: number): void;
};

const colors = {
  sand: "#dfc99c",
  sandEdge: "#bea878",
  grass: "#789d71",
  grassDark: "#4d7658",
  timber: "#78533c",
  cream: "#f1e4ca",
  ink: "#273941"
};

const COASTAL_TRAIL_POINTS = [
  new THREE.Vector3(24, 0, -126),
  new THREE.Vector3(24, 0, -112),
  new THREE.Vector3(26, 0, -88),
  new THREE.Vector3(31, 0, -60),
  new THREE.Vector3(28, 0, -31),
  new THREE.Vector3(35, 0, 2),
  new THREE.Vector3(34, 0, 32),
  new THREE.Vector3(25, 0, 62)
];

const smooth01 = (value: number): number => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

const smoothRange = (from: number, to: number, value: number): number => {
  if (Math.abs(to - from) < 0.0001) return value >= to ? 1 : 0;
  return smooth01((value - from) / (to - from));
};

const hash2 = (x: number, z: number): number => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function coastalShoreX(z: number): number {
  return 12 * Math.sin(z * 0.021) + 5 * Math.sin(z * 0.051);
}

function coastalTerrainBaseHeight(x: number, z: number): number {
  const coastDistance = x - coastalShoreX(z);
  const land = smoothRange(-6, 22, coastDistance);
  const northernRise = Math.pow(smoothRange(48, -132, z), 1.7);
  const inland = smoothRange(7, 72, coastDistance);
  let height = land * (0.35 + northernRise * 12.5);
  height += land * inland * 3.1 * Math.sin(x * 0.052 + 1.3) * Math.sin(z * 0.038);
  height += land * 5.8 * smoothRange(14, 48, coastDistance) * Math.exp(-(((z - 4) / 64) ** 2));
  height -= height * 0.24 * Math.exp(-(((z + 72) / 34) ** 2));
  height += land * Math.sin(x * 0.105) * Math.cos(z * 0.082) * 0.72 * (0.3 + inland);
  height = Math.max(height, 0.22 * land);
  height -= (1 - land) * 4.2;
  return height;
}

const LANDMARK_PADS = new Map(COASTAL_LANDMARKS.map((landmark) => [
  `${landmark.position[0]}:${landmark.position[2]}`,
  coastalTerrainBaseHeight(landmark.position[0], landmark.position[2])
]));

export function coastalTerrainHeight(x: number, z: number): number {
  let height = coastalTerrainBaseHeight(x, z);
  for (const landmark of COASTAL_LANDMARKS) {
    const padHeight = LANDMARK_PADS.get(`${landmark.position[0]}:${landmark.position[2]}`) ?? height;
    const distance = Math.hypot(x - landmark.position[0], z - landmark.position[2]);
    const blend = 1 - smoothRange(4.8, 8.2, distance);
    height = THREE.MathUtils.lerp(height, padHeight, blend);
  }
  return height;
}

export function createCoastalScene(scene: THREE.Scene): CoastalScene {
  const world = new THREE.Group();
  world.name = "kairui-coastal-world";
  scene.add(world);

  const skyMaterial = makeSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 18), skyMaterial);
  sky.position.y = 36;
  world.add(sky);

  const waterMaterial = makeWaterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 120, 120), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-260, -0.5, -10);
  world.add(water);

  const terrain = createCoastalTerrain(world);
  createCoastalRoad(world);
  createPier(world);
  createDistantIslands(world);

  const colliders: CollisionShape[] = [];
  const landmarks = COASTAL_LANDMARKS.map((landmark) => {
    const anchor = createLandmark(world, landmark, colliders);
    return anchor;
  });

  const palms = [
    [18, -110, 0.2], [35, -105, -0.35], [48, -94, 0.5], [17, -76, -0.25],
    [46, -69, 0.3], [16, -52, -0.4], [52, -41, 0.15], [15, -25, 0.5],
    [51, -12, -0.2], [18, 4, 0.15], [54, 17, 0.35], [16, 34, -0.3],
    [46, 48, 0.15], [22, 61, -0.28]
  ] as const;
  const palmCrowns = palms.map(([x, z, rotation], index) => createPalm(world, x, z, rotation, index));
  createCoastalForest(world);
  const clouds = createClouds(world);
  const boat = createBoat(world);
  const balloon = createBalloon(world);
  createSeaBirds(world);
  const celestial = createCelestial(world);
  const tourRoute = createTourRoute(world);
  const seasonal = createSeasonalLayer(world);
  const weather = createWeatherLayer(world);
  applySceneShadows(world);

  return {
    colliders,
    landmarks,
    transit: { boat, balloon },
    getGroundHeight: coastalTerrainHeight,
    isWalkable: (x, z) => z >= -130 && z <= 72 && x >= coastalShoreX(z) - 1 && x <= 92,
    applyEnvironment(state, palette) {
      skyMaterial.uniforms.uHorizon.value.set(palette.skyHorizon);
      skyMaterial.uniforms.uZenith.value.set(palette.skyZenith);
      skyMaterial.uniforms.uSunColor.value.set(palette.sunlight);
      skyMaterial.uniforms.uGlow.value = state.weather === "storm" ? 0.08 : palette.isNight ? 0.16 : 0.42;
      waterMaterial.uniforms.uDeep.value.set(palette.waterDeep);
      waterMaterial.uniforms.uShallow.value.set(palette.waterShallow);
      terrain.setPalette(palette.grass, palette.sand);
      seasonal.setSeason(state.season);
      weather.setWeather(state.weather);
      celestial.setNight(palette.isNight && state.weather !== "storm");
      clouds.forEach((cloud) => {
        cloud.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
          object.material.color.set(state.weather === "storm" ? "#53616a" : state.weather === "rain" ? "#a9b4b0" : "#fff6e7");
          object.material.opacity = state.weather === "storm" ? 0.84 : state.weather === "rain" ? 0.78 : 0.72;
        });
      });
    },
    setTourRoute(from, target) {
      tourRoute.set(from, target);
    },
    update(time, delta) {
      waterMaterial.uniforms.uTime.value = time;
      palmCrowns.forEach((crown, index) => {
        crown.rotation.z = THREE.MathUtils.damp(
          crown.rotation.z,
          Math.sin(time * 0.56 + index) * 0.045,
          4,
          delta
        );
      });
      clouds.forEach((cloud, index) => {
        cloud.position.x = THREE.MathUtils.euclideanModulo(time * (0.42 + index * 0.055) + index * 58, 250) - 110;
      });
      boat.position.x = -42 + THREE.MathUtils.euclideanModulo(time * 0.72, 84);
      boat.position.z = -30 + Math.sin(time * 0.2) * 42;
      boat.rotation.z = Math.sin(time * 1.1) * 0.025;
      balloon.position.y = 28 + Math.sin(time * 0.4) * 0.72;
      balloon.rotation.y = time * 0.055;
      landmarks.forEach(({ marker }, index) => {
        const pulse = 1 + Math.sin(time * 1.6 + index) * 0.09;
        marker.scale.setScalar(pulse);
        marker.rotation.z = time * 0.22;
      });
      weather.update(time, delta);
      seasonal.update(time);
      tourRoute.update(time);
    }
  };
}

function createCoastalTerrain(world: THREE.Group): { setPalette(grass: string, sand: string): void } {
  const geometry = new THREE.PlaneGeometry(230, 300, 116, 150);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(30, 0, -12);
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const vertexColors = new Float32Array(positions.count * 3);
  const sand = new THREE.Color(colors.sand);
  const wetSand = new THREE.Color("#b8a27f");
  const grass = new THREE.Color(colors.grass);
  const meadow = new THREE.Color("#aabd78");
  const rock = new THREE.Color("#8f806f");
  const working = new THREE.Color();
  const terrainBands = new Uint8Array(positions.count);
  const terrainVariation = new Float32Array(positions.count);

  for (let index = 0; index < positions.count; index += 1) {
    let x = positions.getX(index);
    let z = positions.getZ(index);
    x += (hash2(x, z) - 0.5) * 1.2;
    z += (hash2(z, x) - 0.5) * 1.2;
    const height = coastalTerrainHeight(x, z);
    positions.setXYZ(index, x, height, z);
    const shoreDistance = x - coastalShoreX(z);
    const slope = Math.hypot(
      coastalTerrainHeight(x + 1, z) - coastalTerrainHeight(x - 1, z),
      coastalTerrainHeight(x, z + 1) - coastalTerrainHeight(x, z - 1)
    ) * 0.5;
    if (shoreDistance < 4.4) {
      terrainBands[index] = shoreDistance < -1 ? 0 : 1;
      working.copy(shoreDistance < -1 ? wetSand : sand);
    } else if (slope > 1.05) {
      terrainBands[index] = 2;
      working.copy(rock);
    }
    else {
      terrainBands[index] = 3;
      working.copy(grass);
      const meadowMix = smooth01((Math.sin(x * 0.04 + z * 0.026) + Math.sin(x * 0.018 - z * 0.034)) * 0.25 + 0.46);
      terrainVariation[index] = meadowMix;
      working.lerp(meadow, meadowMix * 0.34);
    }
    vertexColors[index * 3] = working.r;
    vertexColors[index * 3 + 1] = working.g;
    vertexColors[index * 3 + 2] = working.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.24,
    dithering: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.receiveOnly = true;
  world.add(mesh);
  return {
    setPalette(grassColor, sandColor) {
      const nextGrass = new THREE.Color(grassColor);
      const nextSand = new THREE.Color(sandColor);
      const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let index = 0; index < colorAttribute.count; index += 1) {
        if (terrainBands[index] === 0) working.copy(nextSand).lerp(new THREE.Color("#81786b"), 0.22);
        else if (terrainBands[index] === 1) working.copy(nextSand);
        else if (terrainBands[index] === 2) working.copy(nextGrass).lerp(new THREE.Color("#756f67"), 0.54);
        else working.copy(nextGrass).lerp(meadow, terrainVariation[index] * 0.3);
        colorAttribute.setXYZ(index, working.r, working.g, working.b);
      }
      colorAttribute.needsUpdate = true;
    }
  };
}

function createCoastalRoad(world: THREE.Group): void {
  const material = matte("#cfb789");
  const curve = new THREE.CatmullRomCurve3(COASTAL_TRAIL_POINTS, false, "centripetal", 0.35);
  const samples = 240;
  const positions = new Float32Array((samples + 1) * 2 * 3);
  const uvs = new Float32Array((samples + 1) * 2 * 2);
  const indices: number[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(2.8);
    for (let edge = 0; edge < 2; edge += 1) {
      const point = center.clone().addScaledVector(side, edge === 0 ? -1 : 1);
      point.y = coastalTerrainHeight(point.x, point.z) + 0.1;
      const vertex = (index * 2 + edge) * 3;
      positions[vertex] = point.x;
      positions[vertex + 1] = point.y;
      positions[vertex + 2] = point.z;
      const uv = (index * 2 + edge) * 2;
      uvs[uv] = edge;
      uvs[uv + 1] = progress * 24;
    }
    if (index < samples) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, material);
  road.receiveShadow = true;
  road.userData.receiveOnly = true;
  world.add(road);

  for (const point of COASTAL_TRAIL_POINTS.slice(2, -1)) {
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.12, 30), matte("#dfcaa0"));
    plaza.position.copy(point);
    plaza.position.y = coastalTerrainHeight(point.x, point.z) + 0.08;
    plaza.receiveShadow = true;
    world.add(plaza);
  }
}

function createCoastalForest(world: THREE.Group): void {
  const trunkMaterial = matte("#725238");
  const crownMaterials = [matte("#426c4d"), matte("#557f55"), matte("#668e5e")];
  for (let index = 0; index < 105; index += 1) {
    const z = -126 + (index * 17.3) % 196;
    const shoreline = coastalShoreX(z);
    const x = shoreline + 18 + (index * 29.7) % 62;
    if (COASTAL_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position[0], z - landmark.position[2]) < 8)) continue;
    if (COASTAL_TRAIL_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < 7)) continue;
    const ground = coastalTerrainHeight(x, z);
    if (ground < 0.2) continue;
    const scale = 0.72 + (index % 5) * 0.11;
    const tree = new THREE.Group();
    tree.position.set(x, ground, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.2 * scale, 6), trunkMaterial);
    trunk.position.y = 1.1 * scale;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05 * scale, 3.2 * scale, 7), crownMaterials[index % crownMaterials.length]);
    crown.position.y = 3.1 * scale;
    crown.rotation.y = index * 0.71;
    tree.add(crown);
    world.add(tree);
  }
}

function createPier(world: THREE.Group): void {
  const deckMaterial = matte("#9a704d");
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.28, 17), deckMaterial);
  deck.position.set(6, -0.05, 57);
  deck.rotation.y = Math.PI / 2;
  world.add(deck);
  for (const x of [0, 4, 8, 12]) {
    for (const z of [55.35, 58.65]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.1, 10), matte("#614937"));
      post.position.set(x, -0.7, z);
      world.add(post);
    }
  }
  const arch = new THREE.Group();
  arch.position.set(13.5, -0.15, 57);
  arch.rotation.y = Math.PI / 2;
  for (const x of [-1.7, 1.7]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.8, 0.22), deckMaterial);
    upright.position.set(x, 1.4, 0);
    arch.add(upright);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 0.25), deckMaterial);
  beam.position.y = 2.75;
  arch.add(beam);
  world.add(arch);
}

function createLandmark(world: THREE.Group, landmark: CoastalLandmark, colliders: CollisionShape[]): LandmarkAnchor {
  const group = new THREE.Group();
  group.name = `coastal-landmark:${landmark.id}`;
  group.position.set(landmark.position[0], coastalTerrainHeight(landmark.position[0], landmark.position[2]), landmark.position[2]);
  world.add(group);

  if (landmark.kind === "lighthouse") createLighthouse(group, landmark.color);
  else if (landmark.kind === "harbour") createHarbourMonument(group, landmark.color);
  else if (landmark.kind === "reef") createReefLab(group, landmark.color);
  else createCoastalStudio(group, landmark.color, landmark.kind === "archive");

  const markerMaterial = new THREE.MeshBasicMaterial({
    color: landmark.color,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.065, 8, 48), markerMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.79;
  marker.userData.softShadow = true;
  group.add(marker);
  addSoftShadow(group, 0, 0.35, 4.4, 3.2, 0, 0.16);

  if (landmark.kind !== "harbour") {
    colliders.push({ kind: "box", x: landmark.position[0], z: landmark.position[2], width: 3.6, depth: 3.1 });
  }
  return { landmark, object: group, marker };
}

function createLighthouse(group: THREE.Group, accent: string): void {
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 5.4, 18), matte("#f2e5cc"));
  tower.position.y = 3.35;
  group.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.72, 18), matte(accent));
  band.position.y = 4.15;
  group.add(band);
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.85, 14),
    new THREE.MeshStandardMaterial({ color: "#ffeab0", emissive: accent, emissiveIntensity: 1.8, roughness: 0.45 })
  );
  lantern.position.y = 6.45;
  group.add(lantern);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.72, 14), matte(colors.ink));
  roof.position.y = 7.25;
  group.add(roof);
}

function createHarbourMonument(group: THREE.Group, accent: string): void {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.15, 0.55, 28), matte(colors.cream));
  base.position.y = 1.02;
  group.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.23, 10, 44), matte(accent));
  ring.position.y = 2.45;
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), matte("#ffd66b"));
  core.position.y = 2.45;
  group.add(core);
}

function createCoastalStudio(group: THREE.Group, accent: string, archive: boolean): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.4, 3), matte(archive ? "#d6c8df" : "#d8dfd1"));
  body.position.y = 1.9;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.15, 1.15, 4), matte(accent));
  roof.position.y = 3.65;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.82;
  group.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.55, 0.12), matte(colors.timber));
  door.position.set(0, 1.35, -1.56);
  group.add(door);
  for (const x of [-1.15, 1.15]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.1), matte("#8fc4c5", 0.5));
    window.position.set(x, 2.12, -1.57);
    group.add(window);
  }
}

function createReefLab(group: THREE.Group, accent: string): void {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.15, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), matte("#bdd6c7", 0.56));
  dome.position.y = 0.72;
  group.add(dome);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(2.14, 0.09, 8, 48), matte(accent));
  frame.rotation.x = Math.PI / 2;
  frame.position.y = 0.72;
  group.add(frame);
  for (let index = 0; index < 7; index += 1) {
    const coral = new THREE.Mesh(new THREE.ConeGeometry(0.22 + index % 2 * 0.1, 0.8 + index % 3 * 0.2, 7), matte(index % 2 ? "#f18d79" : "#e5bd68"));
    coral.position.set(-1.35 + index * 0.42, 1.05, -0.8 + (index % 3) * 0.45);
    group.add(coral);
  }
}

function createPalm(world: THREE.Group, x: number, z: number, rotation: number, phase: number): THREE.Group {
  const palm = new THREE.Group();
  palm.position.set(x, coastalTerrainHeight(x, z), z);
  palm.rotation.y = rotation;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 4.6, 9), matte("#855f3f"));
  trunk.position.y = 2.25;
  trunk.rotation.z = Math.sin(phase) * 0.06;
  palm.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = 4.55;
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 2.15, 4, 8), matte(index % 2 ? "#4d7956" : "#5f8c5e"));
    leaf.rotation.z = Math.PI / 2.7;
    leaf.rotation.y = index / 7 * Math.PI * 2;
    leaf.position.set(Math.cos(leaf.rotation.y) * 0.85, -0.12, Math.sin(leaf.rotation.y) * 0.85);
    crown.add(leaf);
  }
  palm.add(crown);
  world.add(palm);
  addSoftShadow(palm, 1.3, 0.6, 4.4, 1.3, rotation, 0.14);
  return crown;
}

function createClouds(world: THREE.Group): THREE.Group[] {
  return [0, 1, 2, 3].map((index) => {
    const cloud = new THREE.Group();
    cloud.position.set(-86 + index * 58, 30 + index % 2 * 9, -112 + index * 47);
    const material = new THREE.MeshBasicMaterial({ color: "#fff6e7", transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false });
    for (const [x, y, scale] of [[-1.2, 0, 1], [0, 0.35, 1.4], [1.25, 0, 0.9]] as const) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), material);
      puff.position.set(x, y, 0);
      puff.scale.set(scale, scale * 0.7, 0.65);
      puff.userData.softShadow = true;
      cloud.add(puff);
    }
    world.add(cloud);
    return cloud;
  });
}

function createBoat(world: THREE.Group): THREE.Group {
  const boat = new THREE.Group();
  boat.position.set(-34, -0.18, 8);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.15, 4.2, 5), matte("#bb6248"));
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.scale.z = 0.72;
  boat.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), matte(colors.timber));
  mast.position.y = 1.8;
  boat.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.7), matte("#f4e7cc", 0.7));
  sail.position.set(1.05, 2, 0);
  boat.add(sail);
  world.add(boat);
  return boat;
}

function createBalloon(world: THREE.Group): THREE.Group {
  const balloon = new THREE.Group();
  balloon.position.set(34, 28, -84);
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), matte("#ef835f"));
  envelope.scale.y = 1.28;
  balloon.add(envelope);
  for (const rotation of [0, Math.PI / 2]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.1, 8, 30), matte("#f6cf6d"));
    band.rotation.x = rotation;
    balloon.add(band);
  }
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.68, 0.75), matte(colors.timber));
  basket.position.y = -3.1;
  balloon.add(basket);
  world.add(balloon);
  return balloon;
}

function createSeaBirds(world: THREE.Group): void {
  const material = new THREE.MeshBasicMaterial({ color: "#f8efe0", side: THREE.DoubleSide, toneMapped: false });
  for (let index = 0; index < 12; index += 1) {
    const bird = new THREE.Group();
    bird.position.set(-52 + (index * 17) % 112, 18 + index % 5, -108 + (index * 29) % 174);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.22), material);
      wing.position.x = side * 0.38;
      wing.rotation.z = side * 0.2;
      bird.add(wing);
    }
    world.add(bird);
  }
}

function createDistantIslands(world: THREE.Group): void {
  for (const [x, z, scale] of [[-88, -98, 2.8], [-74, -10, 2.1], [-98, 62, 3.2], [-52, 126, 2.4]] as const) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(4.3 * scale, 0), matte(colors.grassDark));
    rock.position.set(x, -1.1, z);
    rock.scale.y = 0.42;
    world.add(rock);
  }
}

function createTourRoute(world: THREE.Group): {
  set(from: THREE.Vector3, target: THREE.Vector3 | null): void;
  update(time: number): void;
} {
  const group = new THREE.Group();
  group.name = "coastal-guided-route";
  world.add(group);
  const material = new THREE.MeshBasicMaterial({
    color: "#ffd46b",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const dots = Array.from({ length: 12 }, (_, index) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09 + index * 0.004, 10, 8), material.clone());
    dot.position.y = 1.02;
    dot.visible = false;
    dot.userData.routeIndex = index;
    dot.userData.softShadow = true;
    group.add(dot);
    return dot;
  });

  return {
    set(from, target) {
      group.visible = Boolean(target);
      if (!target) return;
      dots.forEach((dot, index) => {
        const progress = (index + 1) / (dots.length + 1);
        dot.position.lerpVectors(from, target, progress);
        dot.position.y = 1.08;
        dot.visible = true;
      });
    },
    update(time) {
      if (!group.visible) return;
      dots.forEach((dot, index) => {
        const pulse = 0.78 + Math.max(0, Math.sin(time * 2.4 - index * 0.48)) * 0.7;
        dot.scale.setScalar(pulse);
        if (dot.material instanceof THREE.MeshBasicMaterial) {
          dot.material.opacity = 0.28 + Math.max(0, Math.sin(time * 2.4 - index * 0.48)) * 0.66;
        }
      });
    }
  };
}

function createCelestial(world: THREE.Group): { setNight(active: boolean): void } {
  const group = new THREE.Group();
  group.name = "coastal-night-sky";
  group.visible = false;
  world.add(group);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 18),
    new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#dce9ff", emissiveIntensity: 1.25, roughness: 0.9 })
  );
  moon.position.set(-155, 145, -220);
  moon.userData.softShadow = true;
  group.add(moon);
  const glow = new THREE.PointLight("#c9dcff", 1.8, 70, 2);
  glow.position.copy(moon.position);
  group.add(glow);

  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(270 * 3);
  for (let index = 0; index < 270; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const elevation = 0.18 + Math.random() * 0.82;
    const radius = 480;
    positions[index * 3] = Math.cos(angle) * radius * Math.cos(elevation);
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(angle) * radius * Math.cos(elevation);
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: "#fff1cf", size: 0.72, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false })
  );
  group.add(stars);
  return { setNight(active) { group.visible = active; } };
}

function createSeasonalLayer(world: THREE.Group): {
  setSeason(season: CoastalEnvironmentState["season"]): void;
  update(time: number): void;
} {
  const layer = new THREE.Group();
  layer.name = "coastal-seasonal-scenery";
  world.add(layer);
  const groups = {
    spring: new THREE.Group(),
    summer: new THREE.Group(),
    autumn: new THREE.Group(),
    winter: new THREE.Group()
  };
  Object.entries(groups).forEach(([name, group]) => {
    group.name = `coastal-season:${name}`;
    layer.add(group);
  });

  const flowerColors = ["#f19ab1", "#f6cf66", "#efe6df", "#8c87cd"];
  for (let index = 0; index < 150; index += 1) {
    const z = -122 + (index * 19.7) % 188;
    const x = coastalShoreX(z) + 8 + (index * 13.3) % 63;
    const flower = new THREE.Group();
    flower.position.set(x, coastalTerrainHeight(x, z) + 0.05, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6), matte("#4c7952"));
    stem.position.y = 0.16;
    flower.add(stem);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matte(flowerColors[index % flowerColors.length]));
    bloom.position.y = 0.36;
    flower.add(bloom);
    groups.spring.add(flower);
  }

  for (let index = 0; index < 82; index += 1) {
    const z = -122 + (index * 23.9) % 188;
    const x = coastalShoreX(z) + 11 + (index * 17.1) % 61;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.75, 5), matte(index % 2 ? "#6e9c65" : "#88b875"));
    tuft.position.set(x, coastalTerrainHeight(x, z) + 0.4, z);
    groups.summer.add(tuft);
  }

  const autumnLeaves: THREE.Mesh[] = [];
  for (let index = 0; index < 220; index += 1) {
    const z = -125 + (index * 11.9) % 194;
    const x = coastalShoreX(z) + 9 + (index * 7.7) % 66;
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.12 + index % 3 * 0.035, 7), matte(index % 3 === 0 ? "#d66d43" : index % 3 === 1 ? "#e4a34f" : "#9f6d3f"));
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = index * 1.72;
    leaf.position.set(x, coastalTerrainHeight(x, z) + 0.06, z);
    leaf.userData.baseY = leaf.position.y;
    groups.autumn.add(leaf);
    autumnLeaves.push(leaf);
  }

  for (let index = 0; index < 74; index += 1) {
    const z = -122 + (index * 17.2) % 188;
    const x = coastalShoreX(z) + 7 + (index * 21.3) % 65;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.75 + index % 4 * 0.24, 16),
      new THREE.MeshStandardMaterial({ color: "#f1f3ea", roughness: 0.98, transparent: true, opacity: 0.82 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, coastalTerrainHeight(x, z) + 0.07, z);
    groups.winter.add(patch);
  }
  const snowman = new THREE.Group();
  snowman.position.set(25, coastalTerrainHeight(25, -72), -72);
  for (const [radius, y] of [[0.7, 0.7], [0.52, 1.62], [0.36, 2.28]] as const) {
    const snow = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), matte("#f8f5ec"));
    snow.position.y = y;
    snowman.add(snow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.44, 8), matte("#dc7a3d"));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 2.28, -0.38);
  snowman.add(nose);
  groups.winter.add(snowman);

  return {
    setSeason(season) {
      Object.entries(groups).forEach(([name, group]) => {
        group.visible = name === season;
      });
    },
    update(time) {
      autumnLeaves.forEach((leaf, index) => {
        leaf.position.y = leaf.userData.baseY + Math.sin(time * 0.8 + index) * 0.012;
      });
    }
  };
}

function createWeatherLayer(world: THREE.Group): {
  setWeather(weather: CoastalEnvironmentState["weather"]): void;
  update(time: number, delta: number): void;
} {
  const count = 3200;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = -24 + Math.random() * 132;
    positions[index * 3 + 1] = Math.random() * 38 + 1;
    positions[index * 3 + 2] = -135 + Math.random() * 218;
    seeds[index] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rainMaterial = new THREE.PointsMaterial({
    color: "#c8e3eb",
    size: 0.075,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const rain = new THREE.Points(geometry, rainMaterial);
  rain.visible = false;
  rain.frustumCulled = false;
  world.add(rain);

  const flashMaterial = new THREE.MeshBasicMaterial({ color: "#e9f1ff", transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide, toneMapped: false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), flashMaterial);
  flash.position.y = 6;
  flash.userData.softShadow = true;
  world.add(flash);
  let weather: CoastalEnvironmentState["weather"] = "clear";
  let flashEnergy = 0;
  let nextFlash = 2.2;

  return {
    setWeather(next) {
      weather = next;
      rain.visible = next !== "clear";
      rainMaterial.opacity = next === "storm" ? 0.88 : 0.58;
      rainMaterial.size = next === "storm" ? 0.095 : 0.065;
    },
    update(time, delta) {
      if (rain.visible) {
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < count; index += 1) {
          const y = position.getY(index) - delta * (weather === "storm" ? 24 : 14) * (0.75 + seeds[index] * 0.6);
          position.setY(index, y < 0.8 ? 19 + seeds[index] * 4 : y);
          position.setX(index, position.getX(index) + delta * (weather === "storm" ? 2.8 : 0.9));
          if (position.getX(index) > 108) position.setX(index, -24);
        }
        position.needsUpdate = true;
      }
      if (weather === "storm" && time > nextFlash) {
        flashEnergy = 0.95;
        nextFlash = time + 2.8 + Math.random() * 5;
      }
      flashEnergy = THREE.MathUtils.damp(flashEnergy, 0, 7, delta);
      flashMaterial.opacity = flashEnergy;
    }
  };
}
