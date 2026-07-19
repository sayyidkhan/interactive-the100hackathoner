import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Discovery } from "./App";

type Props = {
  discoveries: Discovery[];
  persona: { shirt: string; accent: string; id: string };
  paused: boolean;
  onRead: (entry: Discovery) => void;
};

const COLORS = {
  grass: "#9eb47c",
  path: "#dcc9a3",
  wood: "#80533c",
  roof: "#a65f4f",
  wall: "#a28c7a",
  gold: "#f0b429"
};

export default function TownScene({ discoveries, persona, paused, onRead }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const personaRef = useRef(persona);
  const onReadRef = useRef(onRead);

  pausedRef.current = paused;
  personaRef.current = persona;
  onReadRef.current = onRead;

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#f0eadc");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#f0eadc", 42, 78);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    const clock = new THREE.Clock();
    const player = createPerson("#d95545", "#9c302c");
    player.position.set(0, 0.55, 5);
    scene.add(player);

    scene.add(new THREE.HemisphereLight("#fff6da", "#69734d", 2.4));
    const sun = new THREE.DirectionalLight("#fff2c9", 2.8);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    addPaths(scene);
    addTown(scene);

    const markerGroup = new THREE.Group();
    const markers = discoveries.map((entry) => {
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 0.72, roughness: 0.4 }));
      marker.position.set(entry.position[0], 1.18, entry.position[1]);
      marker.castShadow = true;
      marker.userData.entry = entry;
      markerGroup.add(marker);
      return marker;
    });
    scene.add(markerGroup);

    const keys = new Set<string>();
    let yaw = -0.55;
    let pitch = 0.55;
    let dragging = false;
    let previousPointer = { x: 0, y: 0 };
    let closest: Discovery | null = null;
    let lastClosestId = "";

    const setSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    setSize();
    window.addEventListener("resize", setSize);

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === " " && !pausedRef.current && closest) onReadRef.current(closest);
      keys.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      previousPointer = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw -= (event.clientX - previousPointer.x) * 0.008;
      pitch = THREE.MathUtils.clamp(pitch + (event.clientY - previousPointer.y) * 0.006, 0.25, 1.05);
      previousPointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = () => { dragging = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05);
      const currentPersona = personaRef.current;
      setPersonColors(player, currentPersona.shirt, currentPersona.accent);

      if (!pausedRef.current) {
        const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
        const side = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
        if (forward || side) {
          const direction = new THREE.Vector3(side, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
          const speed = keys.has("shift") ? 7.2 : 4.3;
          player.position.addScaledVector(direction, speed * delta);
          player.position.x = THREE.MathUtils.clamp(player.position.x, -28, 28);
          player.position.z = THREE.MathUtils.clamp(player.position.z, -28, 28);
          player.rotation.y = Math.atan2(direction.x, direction.z);
          player.userData.walk += delta * speed * 7;
        }
      }

      const walk = player.userData.walk as number;
      player.children[1].position.y = 0.88 + Math.sin(walk) * 0.035;
      markers.forEach((marker, index) => {
        marker.rotation.y += delta * 1.6;
        marker.position.y = 1.18 + Math.sin(elapsed * 2.5 + index) * 0.14;
      });
      closest = null;
      let nearestDistance = Infinity;
      for (const marker of markers) {
        const distance = Math.hypot(marker.position.x - player.position.x, marker.position.z - player.position.z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          closest = marker.userData.entry as Discovery;
        }
      }
      if (nearestDistance > 2.2) closest = null;
      const closestId = closest?.id ?? "";
      if (closestId !== lastClosestId) {
        container.dataset.nearby = closestId;
        lastClosestId = closestId;
      }

      const orbitDistance = 11;
      const target = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * orbitDistance,
        target.y + Math.sin(pitch) * orbitDistance,
        target.z + Math.cos(yaw) * Math.cos(pitch) * orbitDistance
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", setSize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      container.replaceChildren();
    };
  }, [discoveries]);

  return <div className="town-canvas" ref={host} aria-label="Walkable low-poly town" />;
}

function createPerson(shirt: string, accent: string) {
  const group = new THREE.Group();
  group.userData.walk = 0;
  const skin = new THREE.MeshStandardMaterial({ color: "#d49a72", roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: "#2d221c", roughness: 1 });
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin);
  head.position.y = 1.5;
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.43, 18, 8, 0, Math.PI * 2, 0, 1.1), hair);
  fringe.position.y = 1.64;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.58, 8, 14), shirtMaterial);
  body.position.y = 0.88;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.28), accentMaterial);
  legs.position.y = 0.34;
  group.add(head, body, fringe, legs);
  group.userData.shirtMaterial = shirtMaterial;
  group.userData.accentMaterial = accentMaterial;
  return group;
}

function setPersonColors(person: THREE.Group, shirt: string, accent: string) {
  (person.userData.shirtMaterial as THREE.MeshStandardMaterial).color.set(shirt);
  (person.userData.accentMaterial as THREE.MeshStandardMaterial).color.set(accent);
}

function addPaths(scene: THREE.Scene) {
  const material = new THREE.MeshStandardMaterial({ color: COLORS.path, roughness: 1 });
  [[0, 0, 46, 3], [0, 0, 3, 46], [-8, -8, 19, 2.3], [8, -8, 19, 2.3]].forEach(([x, z, width, depth]) => {
    const path = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), material);
    path.position.set(x, 0.03, z);
    path.receiveShadow = true;
    scene.add(path);
  });
}

function addTown(scene: THREE.Scene) {
  const buildings: Array<[number, number, string, string, number, number]> = [
    [-10, 8, "#c9b38e", "#a25b4b", 4.8, 4], [-10, -8, "#a79ac0", "#6c516d", 6.1, 5],
    [-18, -7, "#8da8b1", "#3f6870", 4.6, 4], [-10, -18, "#dbb89b", "#a76b5f", 6, 4.8],
    [10, -8, "#a98d76", "#75483c", 5.4, 4.6], [20, -8, "#ba8e7c", "#b94d57", 4.2, 3.7],
    [-18, 8, "#c69bb9", "#975d82", 4.4, 3.8], [-10, 18, "#d3a881", "#a56146", 4.2, 3.6]
  ];
  buildings.forEach(([x, z, wall, roof, width, depth]) => scene.add(createBuilding(x, z, wall, roof, width, depth)));
  [[-3, 5], [7, 8], [15, 2], [-16, 1], [4, -14]].forEach(([x, z]) => scene.add(createTree(x, z)));
  [[-1, 2], [5, -1], [10, 5], [-7, 3]].forEach(([x, z]) => scene.add(createLamp(x, z)));
  scene.add(createFountain());
}

function createBuilding(x: number, z: number, wall: string, roof: string, width: number, depth: number) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 2.8, depth), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.92 }));
  base.position.y = 1.4;
  base.castShadow = true;
  base.receiveShadow = true;
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.78, 1.55, 4), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.85 }));
  roofMesh.position.y = 3.55;
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.45, 0.08), new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 1 }));
  door.position.set(0, 0.73, depth / 2 + 0.045);
  group.add(base, roofMesh, door);
  group.position.set(x, 0, z);
  return group;
}

function createTree(x: number, z: number) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.8, 8), new THREE.MeshStandardMaterial({ color: "#70513c", roughness: 1 }));
  trunk.position.y = 0.9;
  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), new THREE.MeshStandardMaterial({ color: "#4d7b47", roughness: 1 }));
  crown.position.y = 2.3;
  crown.castShadow = true;
  group.add(trunk, crown);
  group.position.set(x, 0, z);
  return group;
}

function createLamp(x: number, z: number) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.8, 8), new THREE.MeshStandardMaterial({ color: "#353333", roughness: 0.85 }));
  pole.position.y = 1.4;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), new THREE.MeshStandardMaterial({ color: "#ffebb0", emissive: "#ffdc78", emissiveIntensity: 1.2 }));
  glow.position.y = 2.75;
  group.add(pole, glow);
  group.position.set(x, 0, z);
  return group;
}

function createFountain() {
  const group = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.3, 32), new THREE.MeshStandardMaterial({ color: "#c6d8d1", roughness: 0.65 }));
  basin.position.y = 0.15;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.43, 1.43, 0.08, 32), new THREE.MeshStandardMaterial({ color: "#9ed3dc", transparent: true, opacity: 0.82 }));
  water.position.y = 0.34;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.25, 12), new THREE.MeshStandardMaterial({ color: "#b5b299", roughness: 0.8 }));
  spout.position.y = 0.92;
  group.add(basin, water, spout);
  group.position.set(0, 0, 0);
  return group;
}
