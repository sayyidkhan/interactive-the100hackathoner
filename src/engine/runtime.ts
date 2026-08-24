import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type WorldFrame = (frame: {
  delta: number;
  elapsed: number;
  now: number;
}) => void;

export type WorldRuntimeOptions = {
  background: THREE.ColorRepresentation;
  fog?: { color: THREE.ColorRepresentation; near: number; far: number };
  camera?: { fov?: number; near?: number; far?: number };
  exposure?: number;
  environmentIntensity?: number;
};

export type WorldRuntime = {
  readonly root: HTMLElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly clock: THREE.Clock;
  start(frame: WorldFrame): void;
  dispose(): void;
};

export function createWorldRuntime(root: HTMLElement, options: WorldRuntimeOptions): WorldRuntime {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = options.exposure ?? 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background);
  if (options.fog) {
    scene.fog = new THREE.Fog(options.fog.color, options.fog.near, options.fog.far);
  }

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  scene.environment = environmentGenerator.fromScene(environmentScene, 0.04).texture;
  scene.environmentIntensity = options.environmentIntensity ?? 0.2;
  environmentScene.dispose();
  environmentGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(
    options.camera?.fov ?? 42,
    1,
    options.camera?.near ?? 0.1,
    options.camera?.far ?? 180
  );
  const clock = new THREE.Clock();
  let disposed = false;

  const resize = () => {
    const width = Math.max(root.clientWidth, 1);
    const height = Math.max(root.clientHeight, 1);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  const runtime: WorldRuntime = {
    root,
    renderer,
    scene,
    camera,
    clock,
    start(frame) {
      renderer.setAnimationLoop(() => {
        if (disposed) return;
        frame({
          delta: Math.min(clock.getDelta(), 0.05),
          elapsed: clock.elapsedTime,
          now: performance.now()
        });
        renderer.render(scene, camera);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };

  return runtime;
}
