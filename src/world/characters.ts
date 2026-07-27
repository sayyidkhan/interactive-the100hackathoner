import * as THREE from "three";
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
};

export type Citizen = {
  object: THREE.Group;
  origin: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  speechMaterial: THREE.SpriteMaterial;
};

export function createPlayer(): THREE.Group {
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

  const hairGroup = new THREE.Group();
  group.add(hairGroup);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.375, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMaterial
  );
  hair.position.y = 1.84;
  hair.scale.set(1.02, 0.78, 0.95);
  hair.castShadow = true;
  hairGroup.add(hair);

  for (const [x, scale] of [
    [-0.18, 0.95],
    [0, 1.1],
    [0.18, 0.82]
  ] as const) {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 12, 8), hairMaterial);
    fringe.position.set(x, 1.82, -0.28);
    fringe.scale.y = 0.55;
    fringe.castShadow = true;
    hairGroup.add(fringe);
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
    hairGroup.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 10), skin);
  nose.position.set(0, 1.66, -0.36);
  nose.rotation.x = -Math.PI / 2;
  group.add(nose);

  const mouth = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.09, 4, 8),
    new THREE.MeshStandardMaterial({ color: "#a33c37", roughness: 0.6 })
  );
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

  const personaAuraMaterial = new THREE.MeshBasicMaterial({
    color: "#c95749",
    transparent: true,
    opacity: 0.14,
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
    hairGroup
  } satisfies PlayerRig;

  group.scale.setScalar(0.78);
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
    const hairScale = appearance.hairStyle === "afro" ? 1.22 : appearance.hairStyle === "crop" ? 0.86 : 1;
    rig.hairGroup.scale.set(hairScale, appearance.hairStyle === "afro" ? 1.14 : 1, hairScale);
  }
  if (movement) {
    player.userData.walkMultiplier = movement.walk;
    player.userData.sprintMultiplier = movement.sprint;
    player.userData.jumpMultiplier = movement.jump;
  }
  player.userData.characterAppearance = appearance;
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
  rig.torso.position.y = 0.98 + (moving ? Math.abs(Math.sin(walkTime)) * 0.025 : 0);

  rig.shadow.position.y = 0.012 - player.position.y;
  const shadowMaterial = rig.shadow instanceof THREE.Mesh ? rig.shadow.material : null;
  if (shadowMaterial instanceof THREE.MeshBasicMaterial) {
    shadowMaterial.opacity = THREE.MathUtils.clamp(0.25 - player.position.y * 0.11, 0.06, 0.25);
  }

  if (rig.personaAura && rig.personaAuraMaterial && rig.trailDots) {
    const auraPulse = 1 + Math.sin(walkTime * (moving ? 0.8 : 0.45)) * (moving ? 0.055 : 0.025);
    rig.personaAura.scale.setScalar((sprinting ? 1.16 : moving ? 1.04 : 0.94) * auraPulse);
    rig.personaAuraMaterial.opacity = moving ? (sprinting ? 0.38 : 0.26) : 0.13;

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
