import * as THREE from "three";

const SHADOW_Y = 0.026;
let softShadowTexture: THREE.CanvasTexture | null = null;

export function createTownLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#fff9ed", "#8b9d77", 0.96));

  const sun = new THREE.DirectionalLight("#fff1d5", 2.25);
  sun.position.set(-25, 32, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 92;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#dce9e4", 0.42);
  fill.position.set(26, 18, -22);
  scene.add(fill);
}

function getSoftShadowTexture(): THREE.CanvasTexture {
  if (softShadowTexture) return softShadowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create shadow canvas");

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(30, 39, 25, 0.5)");
  gradient.addColorStop(0.46, "rgba(30, 39, 25, 0.2)");
  gradient.addColorStop(0.78, "rgba(30, 39, 25, 0.05)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  softShadowTexture = new THREE.CanvasTexture(canvas);
  softShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return softShadowTexture;
}

export function createSoftShadow(width: number, depth: number, opacity: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#46513a",
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
