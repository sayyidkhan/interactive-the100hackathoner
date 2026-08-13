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
  setSunDirection(direction: THREE.Vector3): void;
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
  new THREE.Vector3(24, 0, -142),
  new THREE.Vector3(24, 0, -120),
  new THREE.Vector3(24, 0, -96),
  new THREE.Vector3(31, 0, -68),
  new THREE.Vector3(28, 0, -38),
  new THREE.Vector3(35, 0, -4),
  new THREE.Vector3(34, 0, 29),
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
  const inlet = 13 * Math.exp(-(((z + 16) / 54) ** 2));
  const northernCove = -7 * Math.exp(-(((z + 104) / 31) ** 2));
  return 18 * Math.sin(z * 0.016 + 0.35) + 7 * Math.sin(z * 0.043) + inlet + northernCove;
}

function coastalTerrainBaseHeight(x: number, z: number): number {
  const coastDistance = x - coastalShoreX(z);
  const land = smoothRange(-8, 22, coastDistance);
  const northernRise = Math.pow(smoothRange(64, -152, z), 1.56);
  const inland = smoothRange(4, 86, coastDistance);
  const bluff = Math.pow(smoothRange(35, 98, coastDistance), 1.42);
  let height = land * (0.35 + northernRise * 23 + bluff * (3.5 + northernRise * 10));
  height += land * inland * 4.8 * Math.sin(x * 0.043 + 1.3) * Math.sin(z * 0.031);
  height += land * 7.6 * smoothRange(14, 55, coastDistance) * Math.exp(-(((z - 2) / 78) ** 2));
  height += land * Math.pow(smoothRange(118, 185, coastDistance), 1.4) * 24;
  height -= height * 0.2 * Math.exp(-(((z + 72) / 37) ** 2));
  height += land * Math.sin(x * 0.088) * Math.cos(z * 0.068) * 1.12 * (0.3 + inland);
  // A shallow creek cuts diagonally through the interior bluff and makes the
  // main road read as a route through geography rather than a line on a plane.
  const creekX = 55 + Math.sin(z * 0.024) * 11;
  const creek = Math.exp(-(((x - creekX) / 7.2) ** 2));
  height -= land * creek * (2.8 + northernRise * 5.5);
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
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 96, 96), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-160, -0.55, -20);
  world.add(water);

  const terrain = createCoastalTerrain(world);
  createCoastalCliffs(world);
  createCoastalRoad(world);
  createCreekAndBridges(world);
  createPier(world);
  createDistantIslands(world);
  createShoreline(world);
  createHeadlandDetails(world);
  createHundredLanternWalk(world);

  const colliders: CollisionShape[] = [];
  const landmarks = COASTAL_LANDMARKS.map((landmark) => {
    const anchor = createLandmark(world, landmark, colliders);
    return anchor;
  });
  createDistrictSetDressing(world);

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
    isWalkable: (x, z) => z >= -148 && z <= 76 && x >= coastalShoreX(z) - 1 && x <= 112,
    setSunDirection(direction) {
      skyMaterial.uniforms.uSunDirection.value.copy(direction);
      waterMaterial.uniforms.uSunDirection.value.copy(direction);
    },
    applyEnvironment(state, palette) {
      skyMaterial.uniforms.uHorizon.value.set(palette.skyHorizon);
      skyMaterial.uniforms.uZenith.value.set(palette.skyZenith);
      skyMaterial.uniforms.uSunColor.value.set(palette.sunlight);
      skyMaterial.uniforms.uGlow.value = state.weather === "storm" ? 0.08 : palette.isNight ? 0.16 : state.time === "sunset" ? 0.6 : 0.42;
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
      balloon.position.y = 42 + Math.sin(time * 0.4) * 0.72;
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
  const geometry = new THREE.PlaneGeometry(340, 430, 136, 172);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(28, 0, -32);
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

function createCoastalCliffs(world: THREE.Group): void {
  const samples = 140;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topColor = new THREE.Color("#a08b6d");
  const lowerColor = new THREE.Color("#7c6f5d");
  const color = new THREE.Color();

  for (let index = 0; index < samples; index += 1) {
    const progress = index / (samples - 1);
    const z = -154 + progress * 340;
    const x = coastalShoreX(z) + 1.5;
    const topY = Math.max(-0.18, coastalTerrainHeight(x, z) - 0.05);
    const bottomY = -7;
    positions.push(x, topY, z, x - 2.5, bottomY, z);
    color.copy(topColor).lerp(lowerColor, 0.12);
    colors.push(color.r, color.g, color.b);
    color.copy(lowerColor).lerp(topColor, 0.08 + (index % 5) * 0.018);
    colors.push(color.r, color.g, color.b);
    if (index < samples - 1) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cliffs = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide
  }));
  cliffs.castShadow = true;
  cliffs.receiveShadow = true;
  world.add(cliffs);

  // A warm seabed catches any grazing camera ray without presenting a dark
  // geometric slab. Its top remains just below the animated water surface.
  const seabed = new THREE.Mesh(new THREE.BoxGeometry(360, 6, 460), matte("#b8a27f"));
  seabed.position.set(28, -3.9, -32);
  seabed.receiveShadow = true;
  seabed.userData.receiveOnly = true;
  world.add(seabed);
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

function createCreekAndBridges(world: THREE.Group): void {
  const creekPoints = Array.from({ length: 92 }, (_, index) => {
    const z = -144 + index * 2.42;
    const x = 55 + Math.sin(z * 0.024) * 11;
    return new THREE.Vector3(x, coastalTerrainHeight(x, z) + 0.18, z);
  });
  const creek = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(creekPoints), 260, 0.48, 8, false),
    new THREE.MeshStandardMaterial({
      color: "#79aaa4",
      roughness: 0.62,
      metalness: 0.02,
      envMapIntensity: 0.4,
      transparent: true,
      opacity: 0.88
    })
  );
  creek.scale.y = 0.14;
  creek.receiveShadow = true;
  creek.userData.receiveOnly = true;
  world.add(creek);

  for (const [index, z] of [-82, -18, 43].entries()) {
    const x = 55 + Math.sin(z * 0.024) * 11;
    const bridge = new THREE.Group();
    bridge.position.set(x, coastalTerrainHeight(x, z) + 0.5, z);
    bridge.rotation.y = Math.sin(z * 0.024) * -0.22;
    for (let plankIndex = 0; plankIndex < 7; plankIndex += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 1.65), matte(plankIndex % 2 ? "#a5744d" : "#91633f"));
      plank.position.x = -2.38 + plankIndex * 0.79;
      plank.position.y = Math.sin(plankIndex * 0.7) * 0.035;
      bridge.add(plank);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 5.8, 7), matte("#72513a"));
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.62, side * 0.74);
      bridge.add(rail);
    }
    bridge.userData.bridgeIndex = index;
    addSoftShadow(bridge, 0.3, 0.3, 6.4, 2.1, 0, 0.12);
    world.add(bridge);
  }
}

function createCoastalForest(world: THREE.Group): void {
  const trunkMaterial = matte("#725238");
  const crownMaterials = [matte("#426c4d"), matte("#557f55"), matte("#668e5e")];
  const groves = [
    [82, -132, 16, 22], [71, -96, 12, 19], [80, -55, 17, 24],
    [68, -10, 13, 18], [79, 31, 18, 22], [70, 65, 15, 18],
    [49, -120, 10, 13], [52, 43, 9, 12]
  ] as const;
  for (let index = 0; index < 148; index += 1) {
    const grove = groves[index % groves.length];
    const angle = index * 2.39996;
    const radius = Math.sqrt((index % 19) / 18);
    const z = grove[1] + Math.sin(angle) * grove[3] * radius;
    const shoreline = coastalShoreX(z);
    const x = Math.max(shoreline + 11, grove[0] + Math.cos(angle) * grove[2] * radius);
    if (COASTAL_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position[0], z - landmark.position[2]) < 8)) continue;
    if (COASTAL_TRAIL_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < 7)) continue;
    if (Math.hypot(x - 68, z + 18) < 13) continue;
    const ground = coastalTerrainHeight(x, z);
    if (ground < 0.2) continue;
    const scale = 0.68 + (index % 7) * 0.12;
    const tree = new THREE.Group();
    tree.position.set(x, ground, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.2 * scale, 6), trunkMaterial);
    trunk.position.y = 1.1 * scale;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.32 * scale, 1), crownMaterials[index % crownMaterials.length]);
    crown.position.y = 3.18 * scale;
    crown.scale.y = 1.18;
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

  if (landmark.kind === "camp") createOperatorCamp(group, landmark.color);
  else if (landmark.kind === "workshop") createExecutionWorkshop(group, landmark.color);
  else if (landmark.kind === "career") createCareerRidge(group, landmark.color);
  else if (landmark.kind === "harbour") createVentureHarbour(group, landmark.color);
  else if (landmark.kind === "archive") createSignalArchive(group, landmark.color);
  else createLighthouse(group, landmark.color);

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

  if (landmark.kind !== "harbour" && landmark.kind !== "camp") {
    const size = landmark.kind === "career" ? 8.5 : landmark.kind === "workshop" ? 5.8 : 4.6;
    colliders.push({ kind: "box", x: landmark.position[0], z: landmark.position[2], width: size, depth: size * 0.82 });
  }
  return { landmark, object: group, marker };
}

function createLighthouse(group: THREE.Group, accent: string): void {
  const knoll = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), matte("#8f806f"));
  knoll.position.y = 0.72;
  knoll.scale.y = 0.58;
  group.add(knoll);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.9, 12.5, 18), matte("#f2e5cc"));
  tower.position.y = 7.05;
  group.add(tower);
  for (const y of [4.5, 9.5]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.48 - y * 0.025, 1.52 - y * 0.025, 0.58, 18), matte(accent));
    band.position.y = y;
    group.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 32), matte(colors.ink));
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 13.2;
  group.add(gallery);
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 1.05, 14),
    new THREE.MeshStandardMaterial({ color: "#fff0bd", emissive: accent, emissiveIntensity: 2.2, roughness: 0.42 })
  );
  lantern.position.y = 13.75;
  group.add(lantern);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 14), matte(colors.ink));
  roof.position.y = 14.75;
  group.add(roof);
}

function createDistrictSetDressing(world: THREE.Group): void {
  const hutPlacements = [
    [38, -106, 0.82, "#d48662", 0.18], [42, -90, 0.7, "#73958d", -0.2],
    [47, -76, 0.92, "#d6a05f", 0.12], [50, -60, 0.72, "#7c909b", -0.18],
    [49, -47, 0.78, "#a87259", 0.1], [53, -31, 0.9, "#73958d", -0.12],
    [50, -14, 0.75, "#d48662", 0.24], [56, 2, 0.9, "#d6a05f", -0.18],
    [48, 16, 0.72, "#73958d", 0.15], [53, 32, 0.9, "#8d79a6", -0.14],
    [45, 45, 0.72, "#a87259", 0.18], [47, 62, 0.82, "#73958d", -0.18]
  ] as const;
  const cream = matte("#eadabb");
  const roofMaterials = [matte("#bd694e"), matte("#4f6668"), matte("#8c704c")];
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: "#ffe7a3",
    emissive: "#e8a84c",
    emissiveIntensity: 0.86,
    roughness: 0.72
  });
  hutPlacements.forEach(([x, z, scale, color, rotation], index) => {
    const hut = new THREE.Group();
    hut.position.set(x, coastalTerrainHeight(x, z), z);
    hut.rotation.y = rotation;
    hut.scale.setScalar(scale);
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.42, 4.7), matte("#b7a47d"));
    terrace.position.y = 0.06;
    hut.add(terrace);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.8, 3.25), matte(color));
    body.position.y = 1.66;
    hut.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.15, 1.45, 4), roofMaterials[index % roofMaterials.length]);
    roof.position.y = 3.72;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    hut.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.72, 0.12), matte("#604433"));
    door.position.set(0, 1.02, -1.69);
    hut.add(door);
    for (const side of [-1, 1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.66, 0.13), glowMaterial);
      window.position.set(side * 1.08, 1.82, -1.7);
      hut.add(window);
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.13, 0.82), cream);
    awning.position.set(0, 2.1, -2.02);
    awning.rotation.x = -0.16;
    hut.add(awning);
    addSoftShadow(hut, 0.4, 0.4, 5.5, 4.6, rotation, 0.15);
    world.add(hut);
  });

  const lampMaterial = matte("#3b4645");
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: "#fff0bd",
    emissive: "#efad4b",
    emissiveIntensity: 1.35,
    roughness: 0.66
  });
  COASTAL_LANDMARKS.forEach((landmark, districtIndex) => {
    for (const side of [-1, 1]) {
      const z = landmark.position[2] + side * 7.5;
      const x = landmark.position[0] + 7 + (districtIndex % 2) * 2;
      const lamp = new THREE.Group();
      lamp.position.set(x, coastalTerrainHeight(x, z), z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.7, 8), lampMaterial);
      post.position.y = 1.85;
      lamp.add(post);
      const bulb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), bulbMaterial);
      bulb.position.y = 3.85;
      lamp.add(bulb);
      world.add(lamp);
    }
  });
}

function createOperatorCamp(group: THREE.Group, accent: string): void {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(5.4, 28), matte("#cfb58b"));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.05;
  ground.receiveShadow = true;
  group.add(ground);

  const tent = new THREE.Group();
  tent.position.set(-2.4, 0, 0.7);
  const tentBody = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3, 4), matte("#d98962"));
  tentBody.position.y = 1.45;
  tentBody.rotation.y = Math.PI / 4;
  tentBody.scale.z = 0.7;
  tent.add(tentBody);
  const opening = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), matte("#4d3b32"));
  opening.position.set(0, 0.88, -1.42);
  opening.rotation.x = Math.PI / 2;
  tent.add(opening);
  group.add(tent);

  const fire = new THREE.Group();
  fire.position.set(1.2, 0, 0.35);
  for (const rotation of [-0.55, 0.55]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.7, 8), matte("#6c4934"));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rotation;
    log.position.y = 0.22;
    fire.add(log);
  }
  for (const [scale, color, y] of [[1, "#ef6e48", 0.72], [0.72, accent, 0.94], [0.42, "#fff1b6", 1.12]] as const) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 1.05 * scale, 9), new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.7
    }));
    flame.position.y = y;
    fire.add(flame);
  }
  const fireLight = new THREE.PointLight("#ffb35e", 1.35, 14, 2);
  fireLight.position.y = 1.15;
  fire.add(fireLight);
  group.add(fire);

  const props = [
    [-4.1, -2.1, "#6b8f8a"], [-3.2, -2.55, "#d1a15e"],
    [2.8, 1.5, "#866a55"], [3.75, 1.1, "#8f775e"], [3.3, -1.4, "#668c82"]
  ] as const;
  props.forEach(([x, z, color], index) => {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.75 + index % 2 * 0.3, 0.7, 0.5), matte(color));
    pack.position.set(x, 0.4, z);
    pack.rotation.y = index * 0.7;
    group.add(pack);
  });
  createJournalSign(group, "WHY 100?", 3.8, -2.6, -0.4, accent);
}

function createExecutionWorkshop(group: THREE.Group, accent: string): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.6, 5.2), matte("#547b78"));
  body.position.y = 2.2;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.05, 4), matte("#49525b"));
  roof.position.y = 4.78;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.72;
  group.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.6, 0.18), matte("#5c3d2e"));
  door.position.set(0, 1.52, -2.68);
  group.add(door);
  for (const x of [-2.35, 2.35]) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.25, 0.16),
      new THREE.MeshStandardMaterial({ color: "#ffd67d", emissive: "#e9a84f", emissiveIntensity: 0.68, roughness: 0.72 })
    );
    window.position.set(x, 2.35, -2.69);
    group.add(window);
  }
  const workbench = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.32, 1.25), matte("#a9784e"));
  workbench.position.set(0, 1.25, 3.15);
  group.add(workbench);
  for (let index = 0; index < 4; index += 1) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22 + index * 0.12, 0.44), matte(index % 2 ? accent : "#ef835f"));
    tool.position.set(-2.05 + index * 1.35, 1.56, 3.12);
    group.add(tool);
  }
  createJournalSign(group, "BUILD · SHIP · SCALE", 0, -3.05, 0, accent);
}

function createCareerRidge(group: THREE.Group, accent: string): void {
  const labels = ["NCS", "FREELANCE", "UBS", "DBS", "SEMBCORP"];
  const colors = ["#a87057", "#c58d65", "#617a8e", "#667f75", "#6f8e7f"];
  labels.forEach((label, index) => {
    const building = new THREE.Group();
    const row = index < 3 ? 0 : 1;
    const column = row === 0 ? index : index - 3;
    building.position.set((column - (row === 0 ? 1 : 0.5)) * 4.6, row * 2.5, row * 4.1);
    const width = index === 4 ? 4.3 : 3.7;
    const height = 3.5 + index * 1.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 3.6), matte(colors[index]));
    body.position.y = height / 2 + 0.18;
    building.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.74, 1.25, 4), matte(index === 4 ? accent : "#4f4b4b"));
    roof.position.y = height + 0.82;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    building.add(roof);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.54, 0.75, 0.12),
      new THREE.MeshStandardMaterial({ color: "#ffe3a3", emissive: "#e9b85e", emissiveIntensity: 0.64, roughness: 0.75 })
    );
    light.position.set(0, height * 0.58, -1.86);
    building.add(light);
    createJournalSign(building, label, 0, -2.02, 0, index === 4 ? accent : "#e9d8b8", 1.36);
    group.add(building);
  });
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(12, 0.45, 5.4), matte("#b7a47d"));
  terrace.position.set(0, 2.3, 4.3);
  group.add(terrace);
}

function createVentureHarbour(group: THREE.Group, accent: string): void {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.38, 5.3), matte("#9b6c46"));
  deck.position.y = 0.28;
  group.add(deck);
  for (const x of [-4.6, -1.55, 1.55, 4.6]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 8), matte("#4b453f"));
    bollard.position.set(x, 0.72, -2.15);
    group.add(bollard);
  }
  const boatColors = ["#df6e52", "#5c8e88", "#e0ab4f", "#8d79a6"];
  boatColors.forEach((color, index) => {
    const boat = new THREE.Group();
    boat.position.set(-6.2 + index * 4.15, -0.55 - (index % 2) * 0.08, -5.2 - (index % 2) * 2.5);
    boat.rotation.y = -0.12 + index * 0.08;
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.15, 4.2, 5), matte(color));
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.scale.z = 0.72;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 3.4, 8), matte(colors.timber));
    mast.position.y = 1.78;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), matte(index % 2 ? "#f4e7cc" : accent, 0.82));
    sail.position.set(0.88, 1.95, 0);
    boat.add(sail);
    group.add(boat);
  });
  createJournalSign(group, "IDEAS LEAVE THE DOCK", 0, 0.1, 0, accent);
}

function createSignalArchive(group: THREE.Group, accent: string): void {
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.1, 0.7, 30), matte("#d0bea0"));
  floor.position.y = 0.35;
  group.add(floor);
  for (let index = 0; index < 9; index += 1) {
    const angle = -Math.PI * 0.76 + index / 8 * Math.PI * 1.52;
    const shelf = new THREE.Group();
    shelf.position.set(Math.cos(angle) * 4.65, 0.7, Math.sin(angle) * 4.65);
    shelf.rotation.y = -angle + Math.PI / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.85, 0.28), matte(index % 2 ? "#6c5c78" : "#776b82"));
    back.position.y = 1.45;
    shelf.add(back);
    for (let row = 0; row < 3; row += 1) {
      for (let book = 0; book < 4; book += 1) {
        const volume = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.56, 0.24), matte((book + row) % 3 === 0 ? accent : (book + row) % 3 === 1 ? "#ef835f" : "#e5c078"));
        volume.position.set(-0.66 + book * 0.43, 0.62 + row * 0.82, -0.2);
        shelf.add(volume);
      }
    }
    group.add(shelf);
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.35, 0.75, 22), matte("#8e684d"));
  table.position.y = 1.05;
  group.add(table);
  const journal = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.05), matte("#f0dfbd"));
  journal.position.set(0, 1.48, 0);
  journal.rotation.y = -0.35;
  group.add(journal);
  createJournalSign(group, "FIELD NOTES", 0, -5.7, 0, accent);
}

function createJournalSign(
  group: THREE.Group,
  label: string,
  x: number,
  z: number,
  rotation: number,
  accent: string,
  scale = 1
): void {
  const sign = new THREE.Group();
  sign.position.set(x, 0, z);
  sign.rotation.y = rotation;
  sign.scale.setScalar(scale);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), matte("#6e4e38"));
  post.position.y = 0.95;
  sign.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.02, 0.18), matte("#f0e1c3"));
  board.position.y = 1.85;
  sign.add(board);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.13, 0.04), matte(accent));
  stripe.position.set(0, 2.12, -0.12);
  sign.add(stripe);
  const markerCount = Math.min(9, Math.max(3, Math.round(label.length / 2.8)));
  for (let index = 0; index < markerCount; index += 1) {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.19 + index % 2 * 0.05, 0.08, 0.035), matte("#4e453d"));
    glyph.position.set((index - (markerCount - 1) / 2) * 0.3, 1.72 + (index % 3) * 0.12, -0.12);
    sign.add(glyph);
  }
  sign.userData.label = label;
  group.add(sign);
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
  balloon.position.set(-72, 42, -18);
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
  const islands = [
    [-94, -106, 3.8, 0.58], [-55, -58, 2.6, 0.5], [-112, 6, 4.8, 0.7],
    [-70, 72, 3.3, 0.56], [-52, 126, 2.7, 0.5], [-142, 106, 5.2, 0.66]
  ] as const;
  for (const [x, z, scale, height] of islands) {
    const island = new THREE.Group();
    island.position.set(x, -0.6, z);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(4.3 * scale, 1), matte("#55654f"));
    stone.scale.y = height;
    island.add(stone);
    const meadow = new THREE.Mesh(new THREE.DodecahedronGeometry(3.9 * scale, 1), matte("#4f6e4c"));
    meadow.position.y = 0.45;
    meadow.scale.y = height * 0.62;
    island.add(meadow);
    const treeCount = Math.max(2, Math.floor(scale * 2));
    for (let index = 0; index < treeCount; index += 1) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 6), matte(index % 2 ? "#3f6548" : "#547b50"));
      tree.position.set((index - treeCount / 2) * 1.6, 1.4, Math.sin(index * 2.1) * 2.2);
      island.add(tree);
    }
    world.add(island);
  }
}

function createShoreline(world: THREE.Group): void {
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: "#f8f0df",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const wetMaterial = new THREE.MeshStandardMaterial({
    color: "#9db9a8",
    transparent: true,
    opacity: 0.3,
    roughness: 0.9,
    depthWrite: false
  });
  const points = Array.from({ length: 100 }, (_, index) => {
    const z = -136 + index * 2.18;
    return new THREE.Vector3(coastalShoreX(z) - 0.9, -0.06, z);
  });
  const foam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 260, 0.11, 6, false), foamMaterial);
  world.add(foam);
  const wetPoints = points.map((point) => point.clone().add(new THREE.Vector3(1.45, 0.01, 0)));
  const wetLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wetPoints), 260, 0.62, 8, false), wetMaterial);
  wetLine.scale.y = 0.08;
  world.add(wetLine);

  for (let index = 0; index < 22; index += 1) {
    const z = -126 + index * 9.2;
    const x = coastalShoreX(z) + 3.2 + (index % 3) * 0.9;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (index % 4) * 0.12, 0), matte(index % 2 ? "#8d8272" : "#a39782"));
    rock.position.set(x, coastalTerrainHeight(x, z) + 0.18, z);
    rock.scale.y = 0.62;
    world.add(rock);
  }
}

function createHeadlandDetails(world: THREE.Group): void {
  const flowerColors = ["#f09a91", "#f3cc70", "#eee4cf", "#89b7ac"];
  const stemGeometry = new THREE.CylinderGeometry(0.025, 0.035, 0.34, 5);
  const bloomGeometry = new THREE.DodecahedronGeometry(0.1, 0);
  const stemMaterial = matte("#527451");
  const bloomMaterials = flowerColors.map((color) => matte(color));
  for (let index = 0; index < 90; index += 1) {
    const z = -124 + (index * 13.73) % 190;
    const x = coastalShoreX(z) + 8 + (index * 23.17) % 75;
    if (COASTAL_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position[0], z - landmark.position[2]) < 5.8)) continue;
    const ground = coastalTerrainHeight(x, z);
    if (ground < 0.35) continue;
    const flower = new THREE.Group();
    flower.position.set(x, ground, z);
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.17;
    flower.add(stem);
    const bloom = new THREE.Mesh(bloomGeometry, bloomMaterials[index % bloomMaterials.length]);
    bloom.position.y = 0.38;
    bloom.scale.setScalar(0.82 + (index % 3) * 0.16);
    flower.add(bloom);
    world.add(flower);
  }

  const overlooks = [[73, -46, 0.28], [70, 22, -0.2], [62, 51, 0.5]] as const;
  overlooks.forEach(([x, z, rotation], index) => {
    const group = new THREE.Group();
    group.position.set(x, coastalTerrainHeight(x, z), z);
    group.rotation.y = rotation;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.62), matte(index === 1 ? "#a66f4d" : "#896044"));
    seat.position.y = 0.85;
    group.add(seat);
    for (const legX of [-1.1, 1.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.42), matte("#4d4740"));
      leg.position.set(legX, 0.42, 0);
      group.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.85, 0.18), matte(index === 1 ? "#a66f4d" : "#896044"));
    back.position.set(0, 1.35, 0.22);
    back.rotation.x = -0.1;
    group.add(back);
    addSoftShadow(group, 0.4, 0.35, 3.8, 1.4, rotation, 0.12);
    world.add(group);
  });
}

function createHundredLanternWalk(world: THREE.Group): void {
  const group = new THREE.Group();
  group.name = "the-100-lantern-walk";
  world.add(group);

  const postGeometry = new THREE.CylinderGeometry(0.055, 0.075, 1.08, 7);
  const bulbGeometry = new THREE.DodecahedronGeometry(0.145, 0);
  const posts = new THREE.InstancedMesh(postGeometry, matte("#5e5144"), 100);
  const lit = new THREE.InstancedMesh(
    bulbGeometry,
    new THREE.MeshStandardMaterial({ color: "#ffd674", emissive: "#f0a83f", emissiveIntensity: 1.35, roughness: 0.78 }),
    19
  );
  const waiting = new THREE.InstancedMesh(bulbGeometry, matte("#786f60"), 81);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < 100; index += 1) {
    const z = -141 + index * 2.08;
    const x = 91 + Math.sin(index * 0.21) * 5.5 + Math.sin(z * 0.032) * 4;
    const ground = coastalTerrainHeight(x, z);
    position.set(x, ground + 0.54, z);
    matrix.compose(position, quaternion, scale);
    posts.setMatrixAt(index, matrix);
    position.y = ground + 1.18;
    matrix.compose(position, quaternion, scale);
    if (index < 19) lit.setMatrixAt(index, matrix);
    else waiting.setMatrixAt(index - 19, matrix);

    if (index === 0 || index === 9 || index === 18) {
      const glow = new THREE.PointLight("#ffc95f", 0.48, 9, 2);
      glow.position.copy(position);
      group.add(glow);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  lit.instanceMatrix.needsUpdate = true;
  waiting.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  lit.castShadow = false;
  waiting.castShadow = false;
  group.add(posts, lit, waiting);

  const startZ = -141;
  const startX = 91 + Math.sin(startZ * 0.032) * 4;
  const sign = new THREE.Group();
  sign.position.set(startX - 4.8, coastalTerrainHeight(startX - 4.8, startZ + 2), startZ + 2);
  createJournalSign(sign, "19 SHIPPED · 81 AHEAD", 0, 0, 0.28, "#f3bd52", 0.9);
  group.add(sign);
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
