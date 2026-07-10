import * as THREE from "three";
import { DISCOVERIES, DiscoveryEntry } from "../data/discoveries";
import { createInput, InputControl, setInputControl } from "../systems/input";
import { loadDiscovered, saveDiscovered } from "../systems/storage";
import { createHud } from "../ui/hud";

type DiscoveryMarker = {
  entry: DiscoveryEntry;
  object: THREE.Object3D;
};

type PlayerMotion = {
  verticalVelocity: number;
  grounded: boolean;
  facingAngle: number;
  walkTime: number;
};

type PlayerRig = {
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  torso: THREE.Object3D;
  shadow: THREE.Object3D;
};

type CollisionShape =
  | { kind: "box"; x: number; z: number; width: number; depth: number }
  | { kind: "circle"; x: number; z: number; radius: number };

const WORLD_LIMIT = 15;
const INSPECT_RADIUS = 2.35;
const GRAVITY = 18;
const JUMP_VELOCITY = 7.4;
const SHADOW_Y = 0.026;
const PLAYER_RADIUS = 0.42;

let softShadowTexture: THREE.CanvasTexture | null = null;
let buildingShadowTexture: THREE.CanvasTexture | null = null;

export function initLoopTown(root: HTMLElement): void {
  root.className = "game-root";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#cfe1bc");
  scene.fog = new THREE.Fog("#cfe1bc", 24, 58);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(9, 7, 10);
  camera.lookAt(0, 0, 0);

  const clock = new THREE.Clock();
  const input = createInput();
  const hud = createHud(root);
  bindVirtualControls(root, input);
  const discovered = loadDiscovered();
  hud.setProgress(discovered);

  const player = createPlayer();
  const playerMotion: PlayerMotion = { verticalVelocity: 0, grounded: true, facingAngle: Math.PI, walkTime: 0 };
  player.position.set(1, 0, 2);
  player.rotation.y = Math.PI;
  scene.add(player);

  createLights(scene);
  const colliders = createTown(scene);
  const markers = createDiscoveryMarkers(scene);
  applySceneShadows(scene);

  let nearest: DiscoveryEntry | null = null;
  let cardOpen = false;
  let started = false;

  if (new URLSearchParams(window.location.search).has("autostart")) {
    started = true;
  } else {
    hud.openIntro(() => {
      started = true;
    });
  }

  const resize = () => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height);

    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", resize);
  resize();

  const animate = () => {
    const delta = Math.min(clock.getDelta(), 0.05);

    if (input.jumpRequested && nearest) {
      input.jumpRequested = false;
      input.inspectRequested = true;
    }

    if (started && !cardOpen) {
      updatePlayer(player, playerMotion, input, delta, colliders);
      nearest = findNearestDiscovery(player.position, markers);
      hud.setPrompt(nearest);
    }

    if (input.inspectRequested) {
      input.inspectRequested = false;
      if (cardOpen) {
        hud.closeCard();
        cardOpen = false;
      } else if (nearest) {
        discovered.add(nearest.id);
        saveDiscovered(discovered);
        hud.setProgress(discovered);
        cardOpen = true;
        hud.openCard(nearest, () => {
          cardOpen = false;
        });
      }
    }

    updateMarkers(markers, discovered, clock.elapsedTime);
    updateCamera(camera, player.position);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
}

function createLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#fff8e5", "#58794f", 0.42));

  const sun = new THREE.DirectionalLight("#fff7dd", 5.45);
  sun.position.set(-11, 9.5, 8.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 44;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 14;
  scene.add(sun);
}

function getSoftShadowTexture(): THREE.CanvasTexture {
  if (softShadowTexture) return softShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create shadow canvas");

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.64)");
  gradient.addColorStop(0.46, "rgba(0, 0, 0, 0.24)");
  gradient.addColorStop(0.78, "rgba(0, 0, 0, 0.08)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  softShadowTexture = new THREE.CanvasTexture(canvas);
  softShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return softShadowTexture;
}

function createSoftShadow(width: number, depth: number, opacity: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#202819",
      map: getSoftShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width, depth, 1);
  shadow.renderOrder = 1;
  shadow.userData.softShadow = true;
  return shadow;
}

function getBuildingShadowTexture(): THREE.CanvasTexture {
  if (buildingShadowTexture) return buildingShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create building shadow canvas");

  const points = [
    [78, 126],
    [278, 94],
    [412, 156],
    [478, 266],
    [402, 404],
    [248, 444],
    [104, 354],
    [44, 224]
  ] as const;

  const drawShape = () => {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
  };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(24, 37, 22, 0.58)";
  context.shadowBlur = 22;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = "rgba(24, 37, 22, 0.26)";
  drawShape();
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = "rgba(24, 37, 22, 0.34)";
  drawShape();
  context.fill();

  const coreGradient = context.createRadialGradient(260, 250, 80, 260, 250, 260);
  coreGradient.addColorStop(0, "rgba(20, 31, 18, 0.28)");
  coreGradient.addColorStop(0.7, "rgba(20, 31, 18, 0.1)");
  coreGradient.addColorStop(1, "rgba(20, 31, 18, 0)");
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = coreGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-over";

  buildingShadowTexture = new THREE.CanvasTexture(canvas);
  buildingShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return buildingShadowTexture;
}

function addBuildingCastShadow(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  opacity: number
): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#263923",
      map: getBuildingShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = rotation;
  shadow.scale.set(width, depth, 1);
  shadow.position.set(x, SHADOW_Y + 0.001, z);
  shadow.renderOrder = 0;
  shadow.userData.softShadow = true;
  parent.add(shadow);
  return shadow;
}

function addSoftShadow(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  opacity: number
): THREE.Mesh {
  const shadow = createSoftShadow(width, depth, opacity);
  shadow.position.set(x, SHADOW_Y, z);
  shadow.rotation.z = rotation;
  parent.add(shadow);
  return shadow;
}

function addDirectionalShade(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  opacity: number
): THREE.Mesh {
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#263923",
      map: getSoftShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  shade.rotation.x = -Math.PI / 2;
  shade.rotation.z = rotation;
  shade.scale.set(width, depth, 1);
  shade.position.set(x, SHADOW_Y + 0.002, z);
  shade.renderOrder = 0;
  shade.userData.softShadow = true;
  parent.add(shade);
  return shade;
}

function makeDarkerMaterial(
  color: string,
  amount = 0.82,
  side: THREE.Side = THREE.FrontSide
): THREE.MeshStandardMaterial {
  const shaded = new THREE.Color(color).multiplyScalar(amount);
  return new THREE.MeshStandardMaterial({ color: shaded, roughness: 0.78, side });
}

function createGable(width: number, rise: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(width / 2, 0);
  shape.lineTo(-width / 2, 0);
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}

function applySceneShadows(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const isSpriteLike = material instanceof THREE.SpriteMaterial;
    const isEmissiveGlow =
      material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0.7;
    const isTransparent = Boolean(material?.transparent);
    const isFlatReceiver = object.geometry.type === "PlaneGeometry" || object.geometry.type === "CircleGeometry";
    const isSoftShadow = Boolean(object.userData.softShadow);

    object.castShadow = !isSpriteLike && !isEmissiveGlow && !isTransparent && !isFlatReceiver && !isSoftShadow;
    object.receiveShadow = !isSpriteLike && !isEmissiveGlow && !isSoftShadow;
  });
}

function createTown(scene: THREE.Scene): CollisionShape[] {
  addWaterfront(scene);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 42),
    new THREE.MeshStandardMaterial({ color: "#9fc58e", roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.005;
  ground.receiveShadow = true;
  scene.add(ground);

  addPath(scene, 0, 0, 32, 3.8, 0);
  addPath(scene, 0, 0, 3.8, 32, 0);
  addPath(scene, 0, 0, 29, 2.3, Math.PI / 4);
  addPath(scene, 0, 0, 29, 2.3, -Math.PI / 4);
  addPathStones(scene);

  addBuilding(scene, "AI Agents Lab", -8, -7, "#6fa6a0", "#2e6f72");
  addBuilding(scene, "SaaS Studio", 8, -6, "#d78c75", "#a94d42");
  addBuilding(scene, "Sustainability Garden", 12, 7.8, "#85ad6f", "#51783f");
  addBuilding(scene, "Crypto Alley", -9, 7, "#7f8eaa", "#4d5d7e");
  addBuilding(scene, "Founder School", -1.5, 13.1, "#d2ad6a", "#9c7032");
  addBuilding(scene, "Winners Hall", 0, -11, "#b88963", "#7d5138");
  addMarket(scene, "Devtools", 12, 1, "#f0c86b");

  addFountain(scene, -4.2, 1.4);
  addLoopMonument(scene);
  addDistrictProps(scene);
  addSparkles(scene);
  addTrees(scene);
  addLamp(scene, -3.5, -2.5);
  addLamp(scene, 4, 3.5);
  addLamp(scene, -11, 0);
  addLamp(scene, 7.2, -1.8);
  addLamp(scene, -2, 7.8);

  return createTownColliders();
}

function createTownColliders(): CollisionShape[] {
  const colliders: CollisionShape[] = [];

  const addBox = (x: number, z: number, width: number, depth: number) => {
    colliders.push({ kind: "box", x, z, width, depth });
  };
  const addCircle = (x: number, z: number, radius: number) => {
    colliders.push({ kind: "circle", x, z, radius });
  };

  for (const [x, z] of [
    [-8, -7],
    [8, -6],
    [12, 7.8],
    [-9, 7],
    [-1.5, 13.1],
    [0, -11]
  ] as const) {
    addBox(x, z, 4.9, 4.25);
  }

  addBox(12, 1, 3.3, 2);
  addCircle(-4.2, 1.4, 1.75);
  addCircle(0, 0, 1.55);

  for (const [x, z] of [
    [-13, -8],
    [-12, 8],
    [13, -9],
    [13, 8],
    [5, 12],
    [-6, 12],
    [-14, -1],
    [-5, -12],
    [5.5, -12],
    [13.5, 0.5],
    [-1.2, 13],
    [10.8, 10.5]
  ] as const) {
    addCircle(x, z, 0.55);
  }

  for (const [x, z] of [
    [-3.5, -2.5],
    [4, 3.5],
    [-11, 0],
    [7.2, -1.8],
    [-2, 7.8]
  ] as const) {
    addCircle(x, z, 0.32);
  }

  addBox(-4.5, 2.4, 0.9, 2.05);
  addBox(4.9, -2.7, 0.9, 2.05);
  addBox(2.3, 6.4, 1.95, 0.9);
  addBox(9.4, 7.2, 5.1, 0.35);
  addBox(-9.5, 9.2, 4.7, 0.35);

  for (const [x, z] of [
    [-7.6, -3.2],
    [6.7, -2.4],
    [7.2, 5.1]
  ] as const) {
    addCircle(x, z, 1.02);
  }

  for (const [x, z, radius] of [
    [-12.4, -5.4, 0.55],
    [11.4, -8.2, 0.48],
    [12.4, 5.8, 0.58]
  ] as const) {
    addCircle(x, z, radius);
  }

  return colliders;
}

function addWaterfront(scene: THREE.Scene): void {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 14),
    new THREE.MeshStandardMaterial({
      color: "#52aac0",
      roughness: 0.35,
      metalness: 0.05
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-7, -0.02, 20);
  scene.add(water);

  for (let i = 0; i < 16; i += 1) {
    addRock(scene, -18 + i * 2.2, 13.1 + Math.sin(i) * 0.8, 0.45 + (i % 3) * 0.12);
  }
}

function addPath(scene: THREE.Scene, x: number, z: number, width: number, depth: number, rotation: number): void {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: "#e8d9b7", roughness: 0.9 })
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, 0.012, z);
  path.receiveShadow = true;
  scene.add(path);
}

function addPathStones(scene: THREE.Scene): void {
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#d7c59c", roughness: 0.95 });
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
    stone.position.set(x, 0.04, z);
    stone.rotation.y = x + z;
    stone.receiveShadow = true;
    scene.add(stone);
  }
}

function addBuilding(scene: THREE.Scene, label: string, x: number, z: number, color: string, roofColor: string): void {
  const group = new THREE.Group();
  const width = 4.4;
  const depth = 3.8;
  const height = 2.75;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.76 })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const sideShade = new THREE.Mesh(new THREE.BoxGeometry(0.055, height - 0.12, depth + 0.02), makeDarkerMaterial(color, 0.74));
  sideShade.position.set(width / 2 + 0.03, height / 2 + 0.02, 0);
  sideShade.castShadow = true;
  sideShade.receiveShadow = true;
  group.add(sideShade);

  const visibleSideShade = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, height - 0.18, depth - 0.14),
    makeDarkerMaterial(color, 0.86)
  );
  visibleSideShade.position.set(-width / 2 - 0.03, height / 2 + 0.02, 0.04);
  visibleSideShade.castShadow = true;
  visibleSideShade.receiveShadow = true;
  group.add(visibleSideShade);

  const frontShade = new THREE.Mesh(new THREE.BoxGeometry(width - 0.35, height - 0.24, 0.045), makeDarkerMaterial(color, 0.88));
  frontShade.position.set(0.22, height / 2 + 0.03, depth / 2 + 0.035);
  frontShade.castShadow = true;
  frontShade.receiveShadow = true;
  group.add(frontShade);

  const baseTrim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.2, 0.16, depth + 0.2),
    new THREE.MeshStandardMaterial({ color: "#d8d0bd", roughness: 0.75 })
  );
  baseTrim.position.y = 0.12;
  baseTrim.castShadow = true;
  group.add(baseTrim);

  const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.68 });
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-(width + 0.8) / 2, 0);
  roofShape.lineTo(0, 1.12);
  roofShape.lineTo((width + 0.8) / 2, 0);
  roofShape.lineTo(-(width + 0.8) / 2, 0);
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: depth + 0.62,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 1
    }),
    roofMaterial
  );
  roof.position.set(0, height, -(depth + 0.62) / 2);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const gableMaterial = makeDarkerMaterial(color, 0.9, THREE.DoubleSide);
  const frontGable = createGable(width + 0.08, 0.9, gableMaterial);
  frontGable.position.set(0, height + 0.02, -depth / 2 - 0.07);
  frontGable.castShadow = true;
  frontGable.receiveShadow = true;
  group.add(frontGable);

  const rearGable = createGable(width + 0.08, 0.9, gableMaterial);
  rearGable.position.set(0, height + 0.02, depth / 2 + 0.07);
  rearGable.rotation.y = Math.PI;
  rearGable.castShadow = true;
  rearGable.receiveShadow = true;
  group.add(rearGable);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, depth + 0.86), roofMaterial);
  ridge.position.y = height + 1.1;
  ridge.castShadow = true;
  group.add(ridge);

  const eaveMaterial = makeDarkerMaterial(roofColor, 0.58);
  const roofLipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, depth + 0.76), eaveMaterial);
  roofLipLeft.position.set(-(width + 0.55) / 2, height + 0.04, 0);
  roofLipLeft.rotation.z = -0.38;
  roofLipLeft.castShadow = true;
  group.add(roofLipLeft);

  const roofLipRight = roofLipLeft.clone();
  roofLipRight.position.x = (width + 0.55) / 2;
  roofLipRight.rotation.z = 0.38;
  roofLipRight.castShadow = true;
  group.add(roofLipRight);

  const underEaveRear = new THREE.Mesh(new THREE.BoxGeometry(width + 0.78, 0.1, 0.08), eaveMaterial);
  underEaveRear.position.set(0, height - 0.04, depth / 2 + 0.24);
  underEaveRear.castShadow = true;
  group.add(underEaveRear);

  const underEaveFront = underEaveRear.clone();
  underEaveFront.position.z = -depth / 2 - 0.24;
  group.add(underEaveFront);

  const frontFascia = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.92, 0.16, 0.18),
    new THREE.MeshStandardMaterial({ color: "#4d4a47", roughness: 0.75 })
  );
  frontFascia.position.set(0, height + 0.04, -depth / 2 - 0.34);
  frontFascia.castShadow = true;
  group.add(frontFascia);

  const rearFascia = frontFascia.clone();
  rearFascia.position.z = depth / 2 + 0.34;
  rearFascia.castShadow = true;
  group.add(rearFascia);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#f2ead8", roughness: 0.72 });
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.62, 0.08), frameMaterial);
  doorFrame.position.set(0, 0.81, -depth / 2 - 0.045);
  doorFrame.castShadow = true;
  group.add(doorFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 1.42, 0.1),
    new THREE.MeshStandardMaterial({ color: "#7a4a2d", roughness: 0.8 })
  );
  door.position.set(0, 0.72, -depth / 2 - 0.06);
  door.castShadow = true;
  group.add(door);

  const frontStep = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.13, 0.42),
    new THREE.MeshStandardMaterial({ color: "#d9d0ba", roughness: 0.82 })
  );
  frontStep.position.set(0, 0.065, -depth / 2 - 0.35);
  frontStep.castShadow = true;
  frontStep.receiveShadow = true;
  group.add(frontStep);

  const doorShadow = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.32, 0.035),
    new THREE.MeshStandardMaterial({ color: "#3f2d22", roughness: 0.85 })
  );
  doorShadow.position.set(-0.32, 0.77, -depth / 2 - 0.13);
  group.add(doorShadow);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#f2c96a", roughness: 0.38, metalness: 0.2 })
  );
  knob.position.set(0.25, 0.76, -depth / 2 - 0.13);
  group.add(knob);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: "#cde0d3",
    emissive: "#b5d8cb",
    emissiveIntensity: 0.08,
    roughness: 0.45
  });
  for (const offset of [-1.35, 1.35]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.08), frameMaterial);
    frame.position.set(offset, 1.48, -depth / 2 - 0.055);
    frame.castShadow = true;
    group.add(frame);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), windowMaterial);
    window.position.set(offset, 1.48, -depth / 2 - 0.11);
    group.add(window);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.15), frameMaterial);
    sill.position.set(offset, 1.08, -depth / 2 - 0.12);
    sill.castShadow = true;
    group.add(sill);
  }

  const roundWindowFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), frameMaterial);
  roundWindowFrame.position.set(0, 2.25, -depth / 2 - 0.06);
  roundWindowFrame.rotation.x = Math.PI / 2;
  group.add(roundWindowFrame);
  const roundWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24), windowMaterial);
  roundWindow.position.set(0, 2.25, -depth / 2 - 0.11);
  roundWindow.rotation.x = Math.PI / 2;
  group.add(roundWindow);

  const rearDoor = door.clone();
  rearDoor.position.z = depth / 2 + 0.06;
  const rearDoorFrame = doorFrame.clone();
  rearDoorFrame.position.z = depth / 2 + 0.045;
  group.add(rearDoorFrame);
  group.add(rearDoor);
  const rearKnob = knob.clone();
  rearKnob.position.set(-0.25, 0.76, depth / 2 + 0.13);
  group.add(rearKnob);
  const rearStep = frontStep.clone();
  rearStep.position.z = depth / 2 + 0.35;
  group.add(rearStep);
  for (const offset of [-1.35, 1.35]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.08), frameMaterial);
    frame.position.set(offset, 1.48, depth / 2 + 0.055);
    frame.castShadow = true;
    group.add(frame);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), windowMaterial);
    window.position.set(offset, 1.48, depth / 2 + 0.11);
    group.add(window);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.15), frameMaterial);
    sill.position.set(offset, 1.08, depth / 2 + 0.12);
    sill.castShadow = true;
    group.add(sill);
  }
  const rearRoundFrame = roundWindowFrame.clone();
  rearRoundFrame.position.z = depth / 2 + 0.06;
  group.add(rearRoundFrame);
  const rearRoundWindow = roundWindow.clone();
  rearRoundWindow.position.z = depth / 2 + 0.11;
  group.add(rearRoundWindow);

  for (const side of [-1, 1]) {
    const xEdge = side * (width / 2 + 0.055);
    const cornerPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, height + 0.1, 0.14),
      new THREE.MeshStandardMaterial({ color: "#e7dcc8", roughness: 0.76 })
    );
    cornerPost.position.set(side * (width / 2 + 0.04), height / 2, 0);
    cornerPost.castShadow = true;
    group.add(cornerPost);

    for (const zOffset of [-0.85, 0.85]) {
      const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.68), frameMaterial);
      sideFrame.position.set(xEdge, 1.5, zOffset);
      sideFrame.castShadow = true;
      group.add(sideFrame);
      const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.46), windowMaterial);
      sideWindow.position.set(side * (width / 2 + 0.11), 1.5, zOffset);
      group.add(sideWindow);

      const sideSill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.72), frameMaterial);
      sideSill.position.set(side * (width / 2 + 0.13), 1.1, zOffset);
      sideSill.castShadow = true;
      group.add(sideSill);
    }
  }

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1, 0.45),
    new THREE.MeshStandardMaterial({ color: "#75644f", roughness: 0.78 })
  );
  chimney.position.set(1.25, height + 1.1, 0.75);
  chimney.castShadow = true;
  group.add(chimney);

  const chimneyCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.16, 0.62),
    new THREE.MeshStandardMaterial({ color: "#4e4236", roughness: 0.72 })
  );
  chimneyCap.position.set(1.25, height + 1.66, 0.75);
  chimneyCap.castShadow = true;
  group.add(chimneyCap);

  const sign = createLabelSign(label);
  sign.position.set(0, height + 0.04, -depth / 2 - 0.22);
  group.add(sign);
  const rearSign = createLabelSign(label);
  rearSign.position.set(0, height + 0.04, depth / 2 + 0.22);
  group.add(rearSign);

  addLampToGroup(group, -2.35, -depth / 2 - 0.36);
  addLampToGroup(group, 2.35, depth / 2 + 0.36);
  addBuildingCastShadow(group, 1.9, 1.2, width + 3.05, depth + 2.05, -0.08, 0.74);
  addSoftShadow(group, 0.18, 0.04, width + 0.92, depth + 0.58, 0.02, 0.3);
  addSoftShadow(group, 2.45, 1.52, width + 3.75, depth + 1.9, -0.14, 0.18);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addMarket(scene: THREE.Scene, label: string, x: number, z: number, color: string): void {
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1, 1.5),
    new THREE.MeshStandardMaterial({ color: "#f6ead4", roughness: 0.75 })
  );
  counter.position.y = 0.5;
  counter.castShadow = true;
  stall.add(counter);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.25, 1.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  roof.position.y = 1.35;
  roof.castShadow = true;
  stall.add(roof);

  const sign = createLabelSign(label);
  sign.position.set(0, 1.9, -0.95);
  stall.add(sign);

  addSoftShadow(stall, 0.6, 0.45, 3.4, 1.9, -0.12, 0.2);
  stall.position.set(x, 0, z);
  scene.add(stall);
}

function addLoopMonument(scene: THREE.Scene): void {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.45, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: "#d6c6a4", roughness: 0.8 })
  );
  base.position.y = 0.25;
  base.castShadow = true;
  group.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.12, 12, 36),
    new THREE.MeshStandardMaterial({ color: "#ee765f", metalness: 0.05, roughness: 0.38 })
  );
  ring.position.y = 1.3;
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  group.add(ring);

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.6, 3),
    new THREE.MeshStandardMaterial({ color: "#ee765f", roughness: 0.45 })
  );
  arrow.position.set(0.8, 1.3, 0);
  arrow.rotation.z = -Math.PI / 2;
  group.add(arrow);

  group.position.set(0, 0, 0);
  addSoftShadow(group, 0.35, 0.35, 2.7, 1.7, -0.2, 0.18);
  scene.add(group);
}

function addFountain(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#cdbf9b", roughness: 0.82 });
  const water = new THREE.MeshStandardMaterial({
    color: "#9fd2ce",
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82
  });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.72, 0.35, 32), stone);
  basin.position.y = 0.18;
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.42, 0.08, 32), water);
  pool.position.y = 0.42;
  group.add(pool);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.95, 18), stone);
  stem.position.y = 0.85;
  stem.castShadow = true;
  group.add(stem);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.2, 28), stone);
  topBowl.position.y = 1.38;
  topBowl.castShadow = true;
  group.add(topBowl);

  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.9, 12), water);
  stream.position.y = 1.75;
  group.add(stream);

  addSoftShadow(group, 0.4, 0.35, 3.25, 2, -0.12, 0.2);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addSparkles(scene: THREE.Scene): void {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffd868",
    emissive: "#ffcc4a",
    emissiveIntensity: 1.8,
    roughness: 0.25
  });
  const points = [
    [-5.8, 0.25],
    [-4.8, -0.7],
    [-3.8, 2.8],
    [-2.1, 1.8],
    [0.2, -1.1],
    [1.9, 0.6],
    [3.3, -2.2],
    [4.4, 1.2],
    [6.1, -0.8],
    [-7.2, 2.2]
  ];
  for (const [x, z] of points) {
    const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), material);
    sparkle.position.set(x, 0.38 + ((x + z) % 1) * 0.35, z);
    scene.add(sparkle);
  }
}

function addDistrictProps(scene: THREE.Scene): void {
  addBench(scene, -4.5, 2.4, Math.PI / 2);
  addBench(scene, 4.9, -2.7, -Math.PI / 2);
  addBench(scene, 2.3, 6.4, Math.PI);
  addFlowerBed(scene, -7.6, -3.2, "#f2b35f");
  addFlowerBed(scene, 6.7, -2.4, "#ef765f");
  addFlowerBed(scene, 7.2, 5.1, "#f7d35d");
  addShrub(scene, -5.8, -4.4, 0.82);
  addShrub(scene, 5.5, -4.1, 0.72);
  addShrub(scene, -5.8, 5.6, 0.74);
  addShrub(scene, 5.2, 5.8, 0.78);
  addShrub(scene, -1.55, 7.1, 0.68);
  addShrub(scene, 1.55, -7.35, 0.7);
  addFence(scene, 9.4, 7.2, 4.8, 0);
  addFence(scene, -9.5, 9.2, 4.4, 0);
  addRock(scene, -12.4, -5.4, 0.7);
  addRock(scene, 11.4, -8.2, 0.6);
  addRock(scene, 12.4, 5.8, 0.75);
  addTinyFlag(scene, -7.8, -4.5, "#2e6f72");
  addTinyFlag(scene, 7.6, -3.9, "#a94d42");
  addTinyFlag(scene, 0.9, 8.3, "#9c7032");
}

function addTrees(scene: THREE.Scene): void {
  const positions = [
    [-13, -8],
    [-12, 8],
    [13, -9],
    [13, 8],
    [5, 12],
    [-6, 12],
    [-14, -1],
    [-5, -12],
    [5.5, -12],
    [13.5, 0.5],
    [-1.2, 13],
    [10.8, 10.5]
  ];
  for (const [x, z] of positions) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#7b5636", roughness: 0.85 })
    );
    trunk.position.set(x, 0.6, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 0),
      new THREE.MeshStandardMaterial({ color: "#5e8a5a", roughness: 0.9 })
    );
    leaves.position.set(x, 1.55, z);
    leaves.castShadow = true;
    scene.add(leaves);

    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#4d774e", roughness: 0.88 });
    const leafClusterA = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), leafMaterial);
    leafClusterA.position.set(x - 0.38, 1.42, z + 0.14);
    leafClusterA.castShadow = true;
    scene.add(leafClusterA);

    const leafClusterB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 0), leafMaterial);
    leafClusterB.position.set(x + 0.42, 1.5, z - 0.18);
    leafClusterB.castShadow = true;
    scene.add(leafClusterB);

    addDirectionalShade(scene, x + 0.78, z + 0.42, 2.2, 0.64, -0.22, 0.13);
    addSoftShadow(scene, x + 0.62, z + 0.38, 2.4, 0.88, -0.24, 0.18);
    addSoftShadow(scene, x + 0.08, z + 0.04, 0.64, 0.42, 0, 0.16);
  }
}

function addShrub(scene: THREE.Scene, x: number, z: number, size: number): void {
  const group = new THREE.Group();
  const leafLight = new THREE.MeshStandardMaterial({ color: "#67925d", roughness: 0.9 });
  const leafDark = new THREE.MeshStandardMaterial({ color: "#4c7448", roughness: 0.9 });
  const clusters = [
    [-0.22, 0.18, 0.34, leafDark],
    [0.18, 0.22, 0.4, leafLight],
    [0.02, -0.12, 0.32, leafDark]
  ] as const;

  for (const [offsetX, offsetZ, radius, material] of clusters) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * size, 0), material);
    leaf.position.set(offsetX * size, 0.22 + radius * size * 0.45, offsetZ * size);
    leaf.scale.y = 0.72;
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);
  }

  addSoftShadow(group, 0.18 * size, 0.14 * size, 1.24 * size, 0.66 * size, -0.15, 0.18);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBench(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#a7784b", roughness: 0.82 });
  const metal = new THREE.MeshStandardMaterial({ color: "#3a4843", roughness: 0.6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.16, 0.48), wood);
  seat.position.y = 0.45;
  seat.castShadow = true;
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.16, 0.38), wood);
  back.position.set(0, 0.82, 0.28);
  back.rotation.x = -0.18;
  back.castShadow = true;
  group.add(back);
  for (const offset of [-0.58, 0.58]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.08), metal);
    leg.position.set(offset, 0.22, -0.08);
    leg.castShadow = true;
    group.add(leg);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addSoftShadow(group, 0.22, 0.16, 2.1, 0.72, -0.08, 0.24);
  scene.add(group);
}

function addFlowerBed(scene: THREE.Scene, x: number, z: number, flowerColor: string): void {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.05, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: "#6f5b3e", roughness: 0.9 })
  );
  base.position.set(x, 0.09, z);
  base.castShadow = true;
  scene.add(base);
  addSoftShadow(scene, x + 0.24, z + 0.16, 1.45, 0.92, -0.12, 0.2);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#4f8a48", roughness: 0.9 });
  const flowerMaterial = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.65 });
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const radius = 0.18 + (i % 3) * 0.18;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), leafMaterial);
    leaf.position.set(x + Math.cos(angle) * radius, 0.28, z + Math.sin(angle) * radius);
    leaf.castShadow = true;
    scene.add(leaf);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flowerMaterial);
    bloom.position.set(leaf.position.x, 0.43, leaf.position.z);
    bloom.castShadow = true;
    scene.add(bloom);
  }
}

function addFence(scene: THREE.Scene, x: number, z: number, length: number, rotation: number): void {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#b58b56", roughness: 0.8 });
  const rails = [0.42, 0.78];
  for (const y of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.08), material);
    rail.position.y = y;
    rail.castShadow = true;
    group.add(rail);
  }
  for (let i = -length / 2; i <= length / 2; i += 0.8) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), material);
    post.position.set(i, 0.5, 0);
    post.castShadow = true;
    group.add(post);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

function addRock(scene: THREE.Scene, x: number, z: number, size: number): void {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ color: "#9b9b8f", roughness: 0.95 })
  );
  rock.position.set(x, size * 0.42, z);
  rock.scale.y = 0.62;
  rock.rotation.set(size, x, z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  addSoftShadow(scene, x + size * 0.35, z + size * 0.24, size * 1.9, size * 0.92, -0.2, 0.2);
}

function addTinyFlag(scene: THREE.Scene, x: number, z: number, color: string): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: "#4a4036", roughness: 0.7 })
  );
  pole.position.y = 0.68;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.34, 0.035),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  flag.position.set(0.28, 1.08, 0);
  group.add(flag);
  group.position.set(x, 0, z);
  addSoftShadow(group, 0.32, 0.2, 1.25, 0.34, -0.2, 0.18);
  scene.add(group);
}

function addLamp(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: "#263238", roughness: 0.6 })
  );
  pole.position.y = 1.1;
  group.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f1be54", emissiveIntensity: 1.1 })
  );
  bulb.position.y = 2.25;
  group.add(bulb);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: "#3c3a34", roughness: 0.62 })
  );
  shade.position.y = 2.48;
  shade.rotation.x = Math.PI;
  shade.castShadow = true;
  group.add(shade);

  addDirectionalShade(group, 0.75, 0.32, 1.8, 0.18, -0.18, 0.16);
  addSoftShadow(group, 0.52, 0.28, 1.9, 0.32, -0.18, 0.17);
  addSoftShadow(group, 0.05, 0.02, 0.42, 0.32, 0, 0.18);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addLampToGroup(group: THREE.Group, x: number, z: number): void {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.55, 8),
    new THREE.MeshStandardMaterial({ color: "#2c332f", roughness: 0.58 })
  );
  pole.position.y = 0.78;
  lamp.add(pole);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.23, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: "#4a4840", roughness: 0.6 })
  );
  shade.position.y = 1.62;
  shade.rotation.x = Math.PI;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f3bd58", emissiveIntensity: 0.85 })
  );
  bulb.position.y = 1.48;
  lamp.add(bulb);

  addDirectionalShade(lamp, 0.42, 0.2, 1.25, 0.14, -0.18, 0.12);
  addSoftShadow(lamp, 0.36, 0.22, 1.35, 0.24, -0.18, 0.16);
  lamp.position.set(x, 0, z);
  group.add(lamp);
}

function createPlayer(): THREE.Group {
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: "#8a604a", roughness: 0.68 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#ef765f", roughness: 0.62 });
  const shirtDark = new THREE.MeshStandardMaterial({ color: "#c95749", roughness: 0.68 });
  const pants = new THREE.MeshStandardMaterial({ color: "#254b5f", roughness: 0.72 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#f2f0e9", roughness: 0.55 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: "#241f1a", roughness: 0.84 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.38, 12, 24), shirt);
  torso.position.y = 0.98;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.08, 24), shirtDark);
  hem.position.y = 0.61;
  hem.scale.z = 0.7;
  hem.castShadow = true;
  group.add(hem);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 20), shirtDark);
  collar.position.set(0, 1.38, -0.02);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.55;
  collar.castShadow = true;
  group.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 18), skin);
  neck.position.y = 1.48;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 22), skin);
  head.position.y = 1.72;
  head.scale.set(0.96, 1.02, 0.92);
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.375, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMaterial
  );
  hair.position.y = 1.84;
  hair.scale.set(1.02, 0.78, 0.95);
  hair.castShadow = true;
  group.add(hair);

  for (const [x, scale] of [
    [-0.18, 0.95],
    [0, 1.1],
    [0.18, 0.82]
  ] as const) {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 12, 8), hairMaterial);
    fringe.position.set(x, 1.82, -0.28);
    fringe.scale.y = 0.55;
    fringe.castShadow = true;
    group.add(fringe);
  }

  for (const x of [-0.32, 0.32]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
    ear.position.set(x, 1.7, -0.03);
    ear.castShadow = true;
    group.add(ear);
  }

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#14100d", roughness: 0.45 });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMaterial);
    eye.position.set(x, 1.72, -0.33);
    group.add(eye);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 4, 8), hairMaterial);
    brow.position.set(x, 1.81, -0.34);
    brow.rotation.x = Math.PI / 2;
    brow.rotation.z = x > 0 ? -0.12 : 0.12;
    group.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 10), skin);
  nose.position.set(0, 1.66, -0.36);
  nose.rotation.x = -Math.PI / 2;
  group.add(nose);

  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 4, 8), new THREE.MeshStandardMaterial({ color: "#a33c37", roughness: 0.6 }));
  mouth.position.set(0, 1.58, -0.345);
  mouth.rotation.x = Math.PI / 2;
  mouth.rotation.z = Math.PI / 2;
  group.add(mouth);

  const armRigs: THREE.Group[] = [];
  for (const x of [-0.52, 0.52]) {
    const armRig = new THREE.Group();
    armRig.position.set(x, 1.18, -0.01);
    armRig.rotation.z = x > 0 ? -0.08 : 0.08;
    group.add(armRig);
    armRigs.push(armRig);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.14, 8, 14), shirt);
    sleeve.position.y = -0.05;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    armRig.add(sleeve);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 8, 14), skin);
    arm.position.y = -0.35;
    arm.castShadow = true;
    arm.receiveShadow = true;
    armRig.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
    hand.position.y = -0.58;
    hand.castShadow = true;
    armRig.add(hand);
  }

  const legRigs: THREE.Group[] = [];
  for (const x of [-0.18, 0.18]) {
    const legRig = new THREE.Group();
    legRig.position.set(x, 0.62, 0);
    group.add(legRig);
    legRigs.push(legRig);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 8, 14), pants);
    leg.position.y = -0.22;
    leg.castShadow = true;
    leg.receiveShadow = true;
    legRig.add(leg);

    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 8, 14), shoes);
    shoe.position.set(0, -0.52, -0.06);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.x = 0.85;
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    legRig.add(shoe);
  }

  const shadow = createSoftShadow(0.86, 0.56, 0.22);
  shadow.position.y = 0.012;
  group.add(shadow);

  group.userData.rig = {
    leftArm: armRigs[0],
    rightArm: armRigs[1],
    leftLeg: legRigs[0],
    rightLeg: legRigs[1],
    torso,
    shadow
  } satisfies PlayerRig;

  return group;
}

function createDiscoveryMarkers(scene: THREE.Scene): DiscoveryMarker[] {
  const starTexture = createStarTexture();
  return DISCOVERIES.map((entry) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTexture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.position.set(entry.position.x, 1.55, entry.position.z);
    sprite.scale.set(1.15, 1.15, 1.15);
    scene.add(sprite);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: "#fff4cf", roughness: 0.55 })
    );
    plinth.position.set(entry.position.x, 0.09, entry.position.z);
    plinth.castShadow = true;
    scene.add(plinth);

    return { entry, object: sprite };
  });
}

function bindVirtualControls(root: HTMLElement, input: ReturnType<typeof createInput>): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-control]");

  for (const button of buttons) {
    const control = button.dataset.control as InputControl | undefined;
    if (!control) continue;

    const setActive = (active: boolean) => {
      setInputControl(input, control, active);
      button.classList.toggle("active", active);
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setActive(true);
    });
    button.addEventListener("pointerup", () => setActive(false));
    button.addEventListener("pointerleave", () => setActive(false));
    button.addEventListener("click", () => {
      if (control === "jump" || control === "inspect") setInputControl(input, control, true);
    });
  }
}

function updatePlayer(
  player: THREE.Group,
  motion: PlayerMotion,
  input: ReturnType<typeof createInput>,
  delta: number,
  colliders: CollisionShape[]
): void {
  const direction = new THREE.Vector3();
  if (input.forward) direction.z -= 1;
  if (input.backward) direction.z += 1;
  if (input.left) direction.x -= 1;
  if (input.right) direction.x += 1;

  if (input.jumpRequested) {
    input.jumpRequested = false;
    if (motion.grounded) {
      motion.verticalVelocity = JUMP_VELOCITY;
      motion.grounded = false;
    }
  }

  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = input.sprint ? 7 : 4.2;
    const nextPosition = player.position.clone().addScaledVector(direction, speed * delta);
    resolvePlayerCollisions(nextPosition, colliders);
    player.position.copy(nextPosition);
    const angle = Math.atan2(-direction.x, -direction.z);
    motion.facingAngle = turnToward(motion.facingAngle, angle, 32 * delta);
    player.rotation.y = motion.facingAngle;
    motion.walkTime += delta * (input.sprint ? 12 : 8.5);
    updatePlayerRig(player, motion.walkTime, true);
  } else {
    updatePlayerRig(player, motion.walkTime, false);
  }

  motion.verticalVelocity -= GRAVITY * delta;
  player.position.y += motion.verticalVelocity * delta;
  if (player.position.y <= 0) {
    player.position.y = 0;
    motion.verticalVelocity = 0;
    motion.grounded = true;
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
}

function resolvePlayerCollisions(position: THREE.Vector3, colliders: CollisionShape[]): void {
  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);

  for (const collider of colliders) {
    if (collider.kind === "circle") {
      resolveCircleCollision(position, collider);
    } else {
      resolveBoxCollision(position, collider);
    }
  }

  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT + PLAYER_RADIUS, WORLD_LIMIT - PLAYER_RADIUS);
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

  if (smallestPush === pushLeft) {
    position.x = minX;
  } else if (smallestPush === pushRight) {
    position.x = maxX;
  } else if (smallestPush === pushBack) {
    position.z = minZ;
  } else {
    position.z = maxZ;
  }
}

function turnToward(current: number, target: number, maxStep: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

function updatePlayerRig(player: THREE.Group, walkTime: number, moving: boolean): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig) return;

  const swing = moving ? Math.sin(walkTime) * 0.34 : 0;
  const settle = moving ? 0.26 : 0.16;
  rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, swing, settle);
  rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -swing, settle);
  rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, -swing * 0.78, settle);
  rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, swing * 0.78, settle);
  rig.torso.position.y = 0.98 + (moving ? Math.abs(Math.sin(walkTime)) * 0.025 : 0);

  rig.shadow.position.y = 0.012 - player.position.y;
  const shadowMaterial = rig.shadow instanceof THREE.Mesh ? rig.shadow.material : null;
  if (shadowMaterial instanceof THREE.MeshBasicMaterial) {
    shadowMaterial.opacity = THREE.MathUtils.clamp(0.25 - player.position.y * 0.11, 0.06, 0.25);
  }
}

function findNearestDiscovery(playerPosition: THREE.Vector3, markers: DiscoveryMarker[]): DiscoveryEntry | null {
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

function updateMarkers(markers: DiscoveryMarker[], discovered: Set<string>, time: number): void {
  for (const marker of markers) {
    const unlocked = discovered.has(marker.entry.id);
    const scale = unlocked ? 0.92 : 1.1 + Math.sin(time * 3 + marker.entry.number) * 0.08;
    marker.object.scale.setScalar(scale);
    marker.object.position.y = 1.55 + Math.sin(time * 2.4 + marker.entry.number) * 0.12;
  }
}

function updateCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3): void {
  const desired = new THREE.Vector3(target.x - 8.7, 5.25, target.z + 9.8);
  camera.position.lerp(desired, 0.075);
  camera.lookAt(target.x, 0.82, target.z);
}

function createLabelSign(text: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create sign canvas");

  context.fillStyle = "#f7ecd8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#9e7750";
  context.lineWidth = 12;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = "#3e352a";
  context.font = "700 34px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  sign.rotation.x = -0.15;
  return sign;
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

  const centerX = 64;
  const centerY = 64;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 48 : 20;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
