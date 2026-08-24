import * as THREE from "three";

export type CoastalHoverboard = {
  object: THREE.Group;
  liftGlow: THREE.MeshBasicMaterial;
  trailMaterials: THREE.MeshBasicMaterial[];
  engineMaterials: THREE.MeshStandardMaterial[];
};

export function createCoastalHoverboard(): CoastalHoverboard {
  const object = new THREE.Group();
  object.name = "coastal-hoverboard";
  object.position.y = 0.07;
  object.visible = false;

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: "#19393a",
    roughness: 0.58,
    metalness: 0.12
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: "#f2cf86",
    roughness: 0.46,
    metalness: 0.24
  });
  const engineMaterials: THREE.MeshStandardMaterial[] = [];

  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.92, 5, 14), deckMaterial);
  deck.rotation.x = Math.PI / 2;
  deck.scale.set(1.08, 1, 0.14);
  deck.castShadow = true;
  deck.receiveShadow = true;
  object.add(deck);

  for (const x of [-0.39, 0.39]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 1.18), railMaterial);
    rail.position.set(x, 0.01, 0);
    rail.castShadow = true;
    object.add(rail);
  }

  for (const z of [-0.56, 0.56]) {
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: "#6fd8cf",
      emissive: "#45bdb8",
      emissiveIntensity: 1.25,
      roughness: 0.36,
      metalness: 0.16
    });
    engineMaterials.push(engineMaterial);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 12), engineMaterial);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(0, -0.09, z);
    object.add(engine);
  }

  const liftGlow = new THREE.MeshBasicMaterial({
    color: "#7be4dc",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 30), liftGlow);
  glow.rotation.x = -Math.PI / 2;
  glow.scale.set(1, 1.8, 1);
  glow.position.y = -0.13;
  glow.renderOrder = 4;
  object.add(glow);

  const trailMaterials: THREE.MeshBasicMaterial[] = [];
  for (let index = 0; index < 3; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: index === 1 ? "#f2cf86" : "#7be4dc",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    trailMaterials.push(material);
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.1 - index * 0.018, 0.48 + index * 0.13), material);
    trail.rotation.x = -Math.PI / 2;
    trail.position.set((index - 1) * 0.2, -0.1, 0.92 + index * 0.24);
    trail.renderOrder = 4;
    object.add(trail);
  }

  return { object, liftGlow, trailMaterials, engineMaterials };
}

export function updateCoastalHoverboard(
  hoverboard: CoastalHoverboard,
  active: boolean,
  elapsed: number,
  speed: number,
  delta: number
): void {
  hoverboard.object.visible = active;
  if (!active) return;

  const speedMix = THREE.MathUtils.clamp(speed / 15, 0, 1);
  hoverboard.object.position.y = 0.07 + Math.sin(elapsed * 4.8) * (0.012 + speedMix * 0.014);
  hoverboard.object.rotation.x = THREE.MathUtils.damp(
    hoverboard.object.rotation.x,
    -0.025 - speedMix * 0.035,
    6,
    delta
  );
  hoverboard.object.rotation.z = THREE.MathUtils.damp(
    hoverboard.object.rotation.z,
    Math.sin(elapsed * 2.6) * (0.012 + speedMix * 0.018),
    5,
    delta
  );
  hoverboard.liftGlow.opacity = 0.18 + speedMix * 0.2 + Math.sin(elapsed * 7) * 0.025;
  hoverboard.engineMaterials.forEach((material, index) => {
    material.emissiveIntensity = 1.1 + speedMix * 1.5 + Math.sin(elapsed * 8 + index) * 0.16;
  });
  hoverboard.trailMaterials.forEach((material, index) => {
    const pulse = 0.76 + Math.sin(elapsed * 9 - index * 0.8) * 0.24;
    material.opacity = speedMix > 0.12 ? (0.1 + speedMix * 0.48) * pulse : 0;
  });
}
