import * as THREE from "three";
import { addSoftShadow, createGable, makeDarkerMaterial } from "./shadows";
import { createLabelSign } from "./signs";
import { addLampToGroup } from "./props";

export function addBuilding(scene: THREE.Scene, label: string, x: number, z: number, color: string, roofColor: string): void {
  const group = new THREE.Group();
  const width = 4.4;
  const depth = 3.8;
  const height = 3.15;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.64, metalness: 0.02 })
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

  const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.54, metalness: 0.03 });
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

  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#f2ead8", roughness: 0.58 });
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.62, 0.08), frameMaterial);
  doorFrame.position.set(0, 0.81, -depth / 2 - 0.045);
  doorFrame.castShadow = true;
  group.add(doorFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 1.42, 0.1),
    new THREE.MeshStandardMaterial({ color: "#7a4a2d", roughness: 0.62 })
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
    roughness: 0.27,
    metalness: 0.05
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
  sign.position.set(0, height + 0.53, -depth / 2 - 0.46);
  sign.scale.setScalar(0.76);
  group.add(sign);
  const rearSign = createLabelSign(label);
  rearSign.position.set(0, height + 0.53, depth / 2 + 0.46);
  rearSign.scale.setScalar(0.76);
  group.add(rearSign);

  addLampToGroup(group, -2.35, -depth / 2 - 0.36);
  addLampToGroup(group, 2.35, depth / 2 + 0.36);
  addBuildingCharacter(group, label, width, depth, height);
  addSoftShadow(group, 1.35, 0.82, width + 2.35, 2.15, -0.16, 0.24);
  addSoftShadow(group, 0.12, 0.06, width + 0.72, depth + 0.46, 0.02, 0.14);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBuildingCharacter(group: THREE.Group, label: string, width: number, depth: number, height: number): void {
  const accents: Record<string, string> = {
    "AI Agents Lab": "#4b8da0",
    "SaaS Studio": "#d16f58",
    "Sustainability Garden": "#6d9c5a",
    "Crypto Alley": "#697eb0",
    "Founder School": "#c19a4b",
    "Winners Hall": "#bc7853"
  };
  const accent = accents[label] ?? "#b58452";
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 });
  const terracotta = new THREE.MeshStandardMaterial({ color: "#ad7650", roughness: 0.82 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#5d8d53", roughness: 0.9 });

  if (label !== "Winners Hall") {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.13, 0.7), accentMaterial);
    awning.position.set(0, 1.96, -depth / 2 - 0.42);
    awning.rotation.x = 0.12;
    awning.castShadow = true;
    group.add(awning);

    const awningTrim = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.1, 0.1), terracotta);
    awningTrim.position.set(0, 1.92, -depth / 2 - 0.78);
    awningTrim.castShadow = true;
    group.add(awningTrim);
  }

  if (label === "AI Agents Lab" || label === "Crypto Alley") {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), accentMaterial);
    mast.position.set(-1.35, height + 1.55, 0.55);
    mast.castShadow = true;
    group.add(mast);
    const receiver = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), accentMaterial);
    receiver.position.set(-1.35, height + 2.02, 0.55);
    receiver.castShadow = true;
    group.add(receiver);
  }

  if (label === "Sustainability Garden" || label === "Founder School") {
    for (const x of [-1.78, 1.78]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 10), terracotta);
      pot.position.set(x, 0.14, -depth / 2 - 0.42);
      pot.castShadow = true;
      group.add(pot);
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), leaf);
      plant.position.set(x, 0.38, -depth / 2 - 0.42);
      plant.castShadow = true;
      group.add(plant);
    }
  }

  if (label === "Sustainability Garden") {
    const solar = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.06, 0.78),
      new THREE.MeshStandardMaterial({ color: "#49687c", roughness: 0.46, metalness: 0.08 })
    );
    solar.position.set(0.55, height + 0.69, 0.28);
    solar.rotation.x = -0.36;
    solar.castShadow = true;
    group.add(solar);
  }

  if (label === "Winners Hall") {
    const medal = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: "#e7ba4e", roughness: 0.38, metalness: 0.18 })
    );
    medal.position.set(0, 1.84, -depth / 2 - 0.16);
    medal.castShadow = true;
    group.add(medal);
  }
}
