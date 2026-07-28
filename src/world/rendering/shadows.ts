import * as THREE from "three";

const SHADOW_Y = 0.034;
let softShadowTexture: THREE.CanvasTexture | null = null;

export function createTownLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#fff6e6", "#c8d6b8", 0.77));

  const sun = new THREE.DirectionalLight("#ffedd2", 1.68);
  sun.position.set(-30, 42, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 3;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.024;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 1;
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#d8e8f0", 0.25);
  fill.position.set(30, 20, -25);
  scene.add(fill);
}

function getSoftShadowTexture(): THREE.CanvasTexture {
  if (softShadowTexture) return softShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create shadow canvas");

  const gradient = context.createRadialGradient(128, 128, 6, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.62)");
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.4)");
  gradient.addColorStop(0.56, "rgba(255, 255, 255, 0.14)");
  gradient.addColorStop(0.82, "rgba(255, 255, 255, 0.03)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  softShadowTexture = new THREE.CanvasTexture(canvas);
  softShadowTexture.colorSpace = THREE.SRGBColorSpace;
  softShadowTexture.magFilter = THREE.LinearFilter;
  return softShadowTexture;
}

export function createSoftShadow(width: number, depth: number, opacity: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#403c35",
      map: getSoftShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width * 1.14, depth * 1.18, 1);
  shadow.renderOrder = 1;
  shadow.userData.softShadow = true;
  return shadow;
}

export function addSoftShadow(
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

export function makeDarkerMaterial(
  color: string,
  amount = 0.82,
  side: THREE.Side = THREE.FrontSide
): THREE.MeshStandardMaterial {
  const shaded = new THREE.Color(color);
  shaded.lerp(new THREE.Color("#5f6258"), THREE.MathUtils.clamp(1 - amount, 0.08, 0.28));
  return new THREE.MeshStandardMaterial({ color: shaded, roughness: 0.78, side });
}

export function createGable(width: number, rise: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(width / 2, 0);
  shape.lineTo(-width / 2, 0);
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}

export function applySceneShadows(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  const worldQuaternion = new THREE.Quaternion();
  const worldNormal = new THREE.Vector3();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const isSpriteLike = materials.every((material) => material instanceof THREE.SpriteMaterial);
    const isEmissiveGlow = materials.every(
      (material) => material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0.7
    );
    const isTransparent = materials.every((material) => material.transparent && material.opacity < 0.98);
    const isFlatGeometry =
      object.geometry.type === "PlaneGeometry" || object.geometry.type === "CircleGeometry";
    object.getWorldQuaternion(worldQuaternion);
    worldNormal.set(0, 0, 1).applyQuaternion(worldQuaternion);
    const isHorizontalReceiver = isFlatGeometry && Math.abs(worldNormal.y) > 0.72;
    const isSoftShadow = Boolean(object.userData.softShadow);

    object.castShadow =
      !isSpriteLike && !isEmissiveGlow && !isTransparent && !isHorizontalReceiver && !isSoftShadow;
    object.receiveShadow = !isSpriteLike && !isEmissiveGlow && !isSoftShadow;

    for (const candidate of materials) {
      if (!(candidate instanceof THREE.MeshStandardMaterial) || isTransparent || isHorizontalReceiver) continue;
      candidate.roughness = THREE.MathUtils.clamp(candidate.roughness, 0.5, 0.9);
      candidate.metalness = THREE.MathUtils.clamp(candidate.metalness, 0, 0.32);
      candidate.envMapIntensity = Math.max(candidate.envMapIntensity, 0.55);
      candidate.dithering = true;
      if (isFlatGeometry) candidate.shadowSide = THREE.DoubleSide;
    }
  });
}
