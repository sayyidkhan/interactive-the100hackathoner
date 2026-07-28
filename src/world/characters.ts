import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CharacterAppearance, CharacterSchema } from "../data/townSchema";
import { PersonaOption } from "../ui/hud";
import { roundRect, splitCanvasLines } from "./rendering/canvas";
import { createSoftShadow } from "./rendering/shadows";
import { TOWN_SPREAD } from "./worldConstants";

export type PlayerRig = {
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  torso: THREE.Object3D;
  shadow: THREE.Object3D;
  personaAura?: THREE.Mesh;
  personaAuraMaterial?: THREE.MeshBasicMaterial;
  trailDots?: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    phase: number;
  }>;
  shirtMaterial?: THREE.MeshStandardMaterial;
  trimMaterial?: THREE.MeshStandardMaterial;
  pantsMaterial?: THREE.MeshStandardMaterial;
  shoeMaterial?: THREE.MeshStandardMaterial;
  hairMaterial?: THREE.MeshStandardMaterial;
  skinMaterial?: THREE.MeshStandardMaterial;
  hairGroup?: THREE.Group;
  accessoryGroup?: THREE.Group;
  head?: THREE.Mesh;
  mouth?: THREE.Object3D;
  eyes?: THREE.Object3D[];
  hem?: THREE.Object3D;
  neck?: THREE.Object3D;
};

export type Citizen = {
  object: THREE.Group;
  origin: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  speechMaterial: THREE.SpriteMaterial;
};

function roundedPart(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
  segments = 5
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, segments, radius),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPlayer(): THREE.Group {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: "#8a604a", roughness: 0.78 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#ef765f", roughness: 0.74 });
  const shirtDark = new THREE.MeshStandardMaterial({ color: "#c95749", roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: "#254b5f", roughness: 0.82 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#f2f0e9", roughness: 0.72 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: "#241f1a", roughness: 0.86 });

  const torso = roundedPart(0.58, 0.66, 0.38, 0.12, shirt);
  torso.position.y = 0.95;
  torso.userData.baseY = torso.position.y;
  group.add(torso);

  const hem = roundedPart(0.565, 0.075, 0.375, 0.03, shirtDark, 3);
  hem.position.y = 0.635;
  group.add(hem);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.11, 16), skin);
  neck.position.y = 1.315;
  neck.castShadow = true;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.305, 26, 20), skin);
  head.position.y = 1.56;
  head.scale.set(1, 0.98, 0.97);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const hairGroup = new THREE.Group();
  group.add(hairGroup);
  buildHairStyle(hairGroup, "crop", hairMaterial);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#14100d", roughness: 0.58 });
  const eyes: THREE.Object3D[] = [];
  for (const x of [-0.095, 0.095]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), eyeMaterial);
    eye.position.set(x, 1.535, -0.292);
    group.add(eye);
    eyes.push(eye);
  }

  const mouthMaterial = new THREE.MeshStandardMaterial({ color: "#a33c37", roughness: 0.7 });
  const mouth = roundedPart(0.082, 0.019, 0.018, 0.006, mouthMaterial, 2);
  mouth.position.set(0, 1.44, -0.295);
  group.add(mouth);

  const accessoryGroup = new THREE.Group();
  group.add(accessoryGroup);

  const armRigs: THREE.Group[] = [];
  for (const x of [-0.385, 0.385]) {
    const armRig = new THREE.Group();
    armRig.position.set(x, 1.17, -0.005);
    group.add(armRig);
    armRigs.push(armRig);

    const arm = roundedPart(0.15, 0.42, 0.16, 0.065, shirt);
    arm.position.y = -0.19;
    armRig.add(arm);

    const cuff = roundedPart(0.154, 0.068, 0.164, 0.025, shirtDark, 3);
    cuff.position.y = -0.375;
    armRig.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 11), skin);
    hand.position.y = -0.455;
    hand.castShadow = true;
    armRig.add(hand);
  }

  const legRigs: THREE.Group[] = [];
  for (const x of [-0.155, 0.155]) {
    const legRig = new THREE.Group();
    legRig.position.set(x, 0.635, 0);
    group.add(legRig);
    legRigs.push(legRig);

    const leg = roundedPart(0.18, 0.42, 0.2, 0.07, pants);
    leg.position.y = -0.185;
    legRig.add(leg);

    const shoe = roundedPart(0.19, 0.115, 0.275, 0.045, shoes, 4);
    shoe.position.set(0, -0.43, -0.04);
    legRig.add(shoe);
  }

  const shadow = createSoftShadow(0.84, 0.52, 0.18);
  shadow.position.y = 0.04;
  group.add(shadow);

  const personaAuraMaterial = new THREE.MeshBasicMaterial({
    color: "#c95749",
    transparent: true,
    opacity: 0.055,
    depthWrite: false
  });
  const personaAura = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 8, 56), personaAuraMaterial);
  personaAura.rotation.x = -Math.PI / 2;
  personaAura.position.y = 0.055;
  personaAura.renderOrder = 3;
  personaAura.userData.softShadow = true;
  group.add(personaAura);

  const trailDots = [
    { x: -0.22, z: 0.34, phase: 0 },
    { x: 0.22, z: 0.34, phase: 0.7 },
    { x: 0, z: 0.52, phase: 1.4 }
  ].map((dot) => {
    const material = new THREE.MeshBasicMaterial({
      color: "#ef765f",
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(dot.x, 0.056, dot.z);
    mesh.renderOrder = 4;
    mesh.userData.softShadow = true;
    group.add(mesh);
    return { mesh, material, phase: dot.phase };
  });

  group.userData.rig = {
    leftArm: armRigs[0],
    rightArm: armRigs[1],
    leftLeg: legRigs[0],
    rightLeg: legRigs[1],
    torso,
    shadow,
    personaAura,
    personaAuraMaterial,
    trailDots,
    shirtMaterial: shirt,
    trimMaterial: shirtDark,
    pantsMaterial: pants,
    shoeMaterial: shoes,
    hairMaterial,
    skinMaterial: skin,
    hairGroup,
    accessoryGroup,
    head,
    mouth,
    eyes,
    hem,
    neck
  } satisfies PlayerRig;

  group.scale.setScalar(0.88);
  return group;
}

export function applyPlayerPersona(player: THREE.Group, persona: PersonaOption): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig?.shirtMaterial || !rig.trimMaterial || !rig.pantsMaterial || !rig.shoeMaterial || !rig.hairMaterial) return;

  rig.shirtMaterial.color.set(persona.colors.shirt);
  rig.trimMaterial.color.set(persona.colors.trim);
  rig.personaAuraMaterial?.color.set(persona.colors.trim);
  rig.trailDots?.forEach((dot) => dot.material.color.set(persona.colors.shirt));
  rig.pantsMaterial.color.set(persona.colors.pants);
  rig.shoeMaterial.color.set(persona.colors.shoes);
  rig.hairMaterial.color.set(persona.colors.hair);
  player.userData.personaId = persona.id;
  player.userData.personaName = persona.name;
  player.userData.personaTrait = persona.trait;
  player.userData.walkMultiplier = persona.movement.walk;
  player.userData.sprintMultiplier = persona.movement.sprint;
  player.userData.jumpMultiplier = persona.movement.jump;
}

export function applyCharacterAppearance(
  player: THREE.Group,
  appearance: CharacterAppearance,
  movement?: { walk: number; sprint: number; jump: number }
): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig?.shirtMaterial || !rig.trimMaterial || !rig.pantsMaterial || !rig.shoeMaterial || !rig.hairMaterial || !rig.skinMaterial) return;

  rig.skinMaterial.color.set(appearance.skin);
  rig.shirtMaterial.color.set(appearance.shirt);
  rig.trimMaterial.color.set(appearance.trim);
  rig.pantsMaterial.color.set(appearance.pants);
  rig.shoeMaterial.color.set(appearance.shoes);
  rig.hairMaterial.color.set(appearance.hair);
  rig.personaAuraMaterial?.color.set(appearance.trim);
  rig.trailDots?.forEach((dot) => dot.material.color.set(appearance.shirt));
  if (rig.hairGroup) {
    rig.hairGroup.visible = appearance.hairStyle !== "bald";
    if (rig.hairGroup.userData.style !== appearance.hairStyle) buildHairStyle(rig.hairGroup, appearance.hairStyle, rig.hairMaterial);
  }
  if (rig.accessoryGroup) {
    const accessory = appearance.accessory ?? "none";
    if (rig.accessoryGroup.userData.style !== accessory) buildAccessory(rig.accessoryGroup, accessory, rig.hairMaterial);
  }

  const bodyPreset = appearance.bodyPreset ?? "average";
  const bodyShape = {
    compact: { torsoX: 1.06, torsoY: 0.9, head: 1.07 },
    average: { torsoX: 1, torsoY: 1, head: 1 },
    tall: { torsoX: 0.94, torsoY: 1.12, head: 0.96 },
    broad: { torsoX: 1.18, torsoY: 1, head: 1.02 }
  }[bodyPreset];
  rig.torso.scale.set(bodyShape.torsoX, bodyShape.torsoY, 1);
  rig.hem?.scale.set(bodyShape.torsoX, 1, 1);
  rig.head?.scale.set(bodyShape.head, bodyShape.head * 0.98, bodyShape.head * 0.97);

  const faceStyle = appearance.faceStyle ?? "soft";
  const eyeScale = faceStyle === "bright" ? 1.2 : faceStyle === "round" ? 1.08 : 1;
  rig.eyes?.forEach((eye, index) => {
    eye.scale.setScalar(eyeScale);
    eye.position.x = (index === 0 ? -1 : 1) * (faceStyle === "round" ? 0.088 : 0.095);
  });
  if (rig.mouth) {
    const mouthWidth = faceStyle === "bright" ? 1.28 : faceStyle === "round" ? 0.9 : 1;
    rig.mouth.scale.set(mouthWidth, 1, 1);
  }
  if (movement) {
    player.userData.walkMultiplier = movement.walk;
    player.userData.sprintMultiplier = movement.sprint;
    player.userData.jumpMultiplier = movement.jump;
  }
  player.userData.characterAppearance = appearance;
}

function buildHairStyle(group: THREE.Group, style: CharacterAppearance["hairStyle"], material: THREE.Material): void {
  group.children.splice(0).forEach((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
  group.userData.style = style;
  group.visible = style !== "bald";
  if (style === "bald") return;

  const addSphere = (radius: number, position: [number, number, number], scale: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    group.add(mesh);
  };

  if (style === "afro" || style === "coily") {
    const points = style === "afro"
      ? [[0, 1.72, 0], [-0.19, 1.68, 0], [0.19, 1.68, 0], [0, 1.75, 0.17], [0, 1.75, -0.14]]
      : [[-0.17, 1.69, 0], [0, 1.73, 0], [0.17, 1.69, 0], [-0.1, 1.66, -0.2], [0.1, 1.66, -0.2]];
    points.forEach((point) => addSphere(style === "afro" ? 0.19 : 0.14, point as [number, number, number], [1, 1, 1]));
    return;
  }

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), material);
  cap.position.set(0, 1.645, 0.005);
  cap.scale.set(style === "bob" || style === "long" ? 1.06 : 1.015, style === "crop" ? 0.68 : 0.79, 1);
  cap.castShadow = true;
  group.add(cap);

  if (style === "mohawk") {
    cap.visible = false;
    for (const z of [-0.2, -0.08, 0.04, 0.16, 0.28]) addSphere(0.105, [0, 1.77, z], [0.7, 1.45, 0.8]);
    return;
  }
  if (style === "bun") addSphere(0.15, [0, 1.89, 0.12], [1, 1, 1]);
  if (style === "bob" || style === "long") {
    const length = style === "long" ? 0.48 : 0.3;
    [-0.27, 0.27].forEach((x) => {
      const side = roundedPart(0.13, length, 0.19, 0.055, material, 4);
      side.position.set(x, style === "long" ? 1.47 : 1.56, 0.01);
      group.add(side);
    });
  }
  if (style === "braids") {
    [-0.23, 0.23].forEach((x) => {
      for (let index = 0; index < 4; index += 1) addSphere(0.067, [x, 1.55 - index * 0.11, 0.03], [0.85, 1.05, 0.85]);
    });
  }

  const fringeCount = style === "swept" ? 4 : 3;
  for (let index = 0; index < fringeCount; index += 1) {
    const x = style === "swept" ? -0.2 + index * 0.13 : -0.18 + index * 0.18;
    addSphere(0.095, [x, 1.61 + (style === "swept" ? index * 0.014 : index === 1 ? 0.02 : 0), -0.268], [1, 0.46, 0.52]);
  }
}

function buildAccessory(group: THREE.Group, style: NonNullable<CharacterAppearance["accessory"]>, hairMaterial: THREE.Material): void {
  group.children.splice(0).forEach((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
    if (child instanceof THREE.Line) child.geometry.dispose();
  });
  group.userData.style = style;
  if (style === "none") return;

  if (style === "glasses") {
    const material = new THREE.MeshStandardMaterial({ color: "#302a25", roughness: 0.55 });
    [-0.1, 0.1].forEach((x) => {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 20), material);
      lens.position.set(x, 1.54, -0.315);
      group.add(lens);
    });
    const bridge = roundedPart(0.075, 0.014, 0.014, 0.004, material, 2);
    bridge.position.set(0, 1.54, -0.315);
    group.add(bridge);
    return;
  }

  const hatMaterial = style === "cap"
    ? new THREE.MeshStandardMaterial({ color: "#d45e4b", roughness: 0.76 })
    : hairMaterial;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.345, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMaterial);
  crown.position.set(0, 1.74, 0);
  crown.scale.y = style === "beanie" ? 0.82 : 0.62;
  crown.castShadow = true;
  group.add(crown);
  if (style === "cap") {
    const brim = roundedPart(0.34, 0.035, 0.18, 0.02, hatMaterial, 3);
    brim.position.set(0, 1.7, -0.28);
    group.add(brim);
  }
}

export function createCharacterPreview(spec: CharacterSchema): THREE.Group {
  const preview = createPlayer();
  applyCharacterAppearance(preview, spec.appearance, spec.movement);

  if (spec.kind === "citizen") {
    const rig = preview.userData.rig as PlayerRig;
    if (rig.personaAura) rig.personaAura.visible = false;
    rig.trailDots?.forEach((dot) => {
      dot.mesh.visible = false;
    });
    preview.scale.setScalar(0.7);
  }

  return preview;
}

export function createCitizens(scene: THREE.Object3D, specs: CharacterSchema[]): Citizen[] {
  return specs.map((spec) => {
    const citizen = createCitizen(spec.appearance, spec.speech ?? "town signal");
    const [logicalX, logicalZ] = spec.position ?? [0, 0];
    const radius = spec.radius ?? 1;
    const x = logicalX * TOWN_SPREAD;
    const z = logicalZ * TOWN_SPREAD;
    citizen.object.position.set(x + radius, 0, z);
    scene.add(citizen.object);
    return {
      object: citizen.object,
      origin: new THREE.Vector3(x, 0, z),
      radius,
      speed: spec.speed ?? 0.5,
      phase: spec.phase ?? 0,
      speechMaterial: citizen.speechMaterial
    };
  });
}

export function updateCitizens(citizens: Citizen[], time: number, playerPosition: THREE.Vector3): void {
  for (const citizen of citizens) {
    const angle = time * citizen.speed + citizen.phase;
    const nextX = citizen.origin.x + Math.cos(angle) * citizen.radius;
    const nextZ = citizen.origin.z + Math.sin(angle) * citizen.radius * 0.58;
    const tangentX = -Math.sin(angle);
    const tangentZ = Math.cos(angle) * 0.58;
    citizen.object.position.set(nextX, 0, nextZ);
    citizen.object.rotation.y = Math.atan2(-tangentX, -tangentZ);
    updatePlayerRig(citizen.object, time * 8 + citizen.phase, true);
    const speechWave = Math.sin(time * 0.9 + citizen.phase * 1.7);
    const speechOpacity = THREE.MathUtils.smoothstep(speechWave, 0.15, 0.92) * 0.62;
    const distance = citizen.object.position.distanceTo(playerPosition);
    citizen.speechMaterial.opacity = distance < 3.4 ? 0.12 + speechOpacity : 0;
  }
}

export function updatePlayerRig(player: THREE.Group, walkTime: number, moving: boolean, sprinting = false): void {
  const rig = player.userData.rig as PlayerRig | undefined;
  if (!rig) return;

  const swing = moving ? Math.sin(walkTime) * 0.34 : 0;
  const settle = moving ? 0.26 : 0.16;
  rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, swing, settle);
  rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -swing, settle);
  rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, -swing * 0.78, settle);
  rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, swing * 0.78, settle);
  const torsoBaseY = (rig.torso.userData.baseY as number | undefined) ?? 0.95;
  rig.torso.position.y = torsoBaseY + (moving ? Math.abs(Math.sin(walkTime)) * 0.022 : 0);

  rig.shadow.position.y = 0.04 - player.position.y;
  const shadowMaterial = rig.shadow instanceof THREE.Mesh ? rig.shadow.material : null;
  if (shadowMaterial instanceof THREE.MeshBasicMaterial) {
    shadowMaterial.opacity = THREE.MathUtils.clamp(0.25 - player.position.y * 0.11, 0.06, 0.25);
  }

  if (rig.personaAura && rig.personaAuraMaterial && rig.trailDots) {
    const auraPulse = 1 + Math.sin(walkTime * (moving ? 0.8 : 0.45)) * (moving ? 0.055 : 0.025);
    rig.personaAura.scale.setScalar((sprinting ? 1.16 : moving ? 1.04 : 0.94) * auraPulse);
    rig.personaAuraMaterial.opacity = moving ? (sprinting ? 0.2 : 0.11) : 0.045;

    rig.trailDots.forEach((dot, index) => {
      const pulse = Math.max(0, Math.sin(walkTime * 1.15 - dot.phase));
      const sprintBoost = sprinting ? 1.4 : 1;
      dot.mesh.scale.setScalar(0.72 + pulse * 0.8 * sprintBoost + index * 0.04);
      dot.material.opacity = moving ? (0.16 + pulse * (sprinting ? 0.58 : 0.36)) : 0.035;
    });
  }
}

function createCitizen(appearance: CharacterAppearance, speechText: string): { object: THREE.Group; speechMaterial: THREE.SpriteMaterial } {
  const group = createPlayer();
  applyCharacterAppearance(group, appearance);
  const rig = group.userData.rig as PlayerRig;
  if (rig.personaAura) rig.personaAura.visible = false;
  rig.trailDots?.forEach((dot) => {
    dot.mesh.visible = false;
  });
  group.scale.setScalar(0.7);

  const speechMaterial = new THREE.SpriteMaterial({
    map: createCitizenSpeechTexture(speechText, appearance.shirt),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: 0
  });
  const speech = new THREE.Sprite(speechMaterial);
  speech.position.set(0, 2.42, 0);
  speech.scale.set(1.55, 0.46, 1);
  speech.renderOrder = 6;
  group.add(speech);

  return { object: group, speechMaterial };
}

function createCitizenSpeechTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create citizen speech canvas");

  const line = splitCanvasLines(context, text.toUpperCase(), 340, "900 32px Inter, sans-serif", 1)[0];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(55, 42, 25, 0.26)";
  context.shadowBlur = 16;
  roundRect(context, 42, 22, 428, 88, 20);
  context.fillStyle = "rgba(255, 250, 240, 0.95)";
  context.fill();
  context.beginPath();
  context.moveTo(224, 108);
  context.lineTo(256, 136);
  context.lineTo(276, 108);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  roundRect(context, 42, 22, 428, 88, 20);
  context.lineWidth = 5;
  context.strokeStyle = accent;
  context.stroke();
  context.fillStyle = accent;
  context.font = "900 16px Inter, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("TOWN SIGNAL", 64, 48);
  context.fillStyle = "#2f2922";
  context.font = "900 32px Inter, sans-serif";
  context.fillText(line, 64, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
