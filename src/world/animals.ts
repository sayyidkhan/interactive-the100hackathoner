import * as THREE from "three";
import { addSoftShadow } from "./rendering/shadows";
import { TOWN_SPREAD } from "./worldConstants";

export type TownAnimal = {
  object: THREE.Group;
  waypoints: THREE.Vector3[];
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  phase: number;
  bob: number;
  nextDecision: number;
};

export function createTownAnimals(scene: THREE.Scene): TownAnimal[] {
  const scaleWaypoints = (points: Array<[number, number]>) =>
    points.map(([x, z]) => new THREE.Vector3(x * TOWN_SPREAD, 0, z * TOWN_SPREAD));
  const specs = [
    {
      object: createGoose(),
      waypoints: scaleWaypoints([[2.8, 3.3], [5.4, 2.8], [7.1, 4.5], [5.8, 6.2], [2.6, 6.1], [1.7, 4.5], [4.2, 5.1]]),
      speed: 0.72,
      phase: 0.2,
      bob: 0.025,
      nextDecision: 0
    },
    {
      object: createCorgi(),
      waypoints: scaleWaypoints([[-6.6, -2.8], [-4.3, -5.7], [-0.8, -6.2], [2.7, -4.2], [3.4, -1.7], [-1.8, -2.6], [-5.1, -1.1], [0.8, -3.4]]),
      speed: 1.05,
      phase: 2.4,
      bob: 0.035,
      nextDecision: 0
    }
  ];

  for (const animal of specs) {
    animal.object.position.copy(animal.waypoints[0]);
    scene.add(animal.object);
  }
  return specs.map((animal) => ({
    ...animal,
    target: animal.waypoints[1].clone(),
    velocity: new THREE.Vector3()
  }));
}

export function updateTownAnimals(animals: TownAnimal[], time: number, delta: number): void {
  for (const animal of animals) {
    const toTarget = new THREE.Vector3().subVectors(animal.target, animal.object.position);
    toTarget.y = 0;
    if (toTarget.lengthSq() < 0.35 || time >= animal.nextDecision) {
      const choices = animal.waypoints.filter((point) => point.distanceToSquared(animal.target) > 1);
      animal.target.copy(choices[Math.floor(Math.random() * choices.length)] ?? animal.waypoints[0]);
      animal.nextDecision = time + 5 + Math.random() * 7;
      toTarget.subVectors(animal.target, animal.object.position).setY(0);
    }

    const desiredVelocity = toTarget.lengthSq() > 0.001
      ? toTarget.normalize().multiplyScalar(animal.speed)
      : new THREE.Vector3();
    animal.velocity.lerp(desiredVelocity, 1 - Math.exp(-3.2 * delta));
    animal.object.position.addScaledVector(animal.velocity, delta);
    animal.object.position.y = Math.sin(time * 8.5 + animal.phase) * animal.bob;

    if (animal.velocity.lengthSq() > 0.01) {
      const angle = Math.atan2(-animal.velocity.x, -animal.velocity.z);
      animal.object.rotation.y = turnToward(animal.object.rotation.y, angle, 5.5 * delta);
    }

    const gait = Math.sin(time * animal.speed * 11 + animal.phase);
    const legs = animal.object.userData.legs as THREE.Group[] | undefined;
    legs?.forEach((leg, index) => {
      leg.rotation.x = gait * (index % 2 === 0 ? 0.42 : -0.42);
    });
    const tail = animal.object.userData.tail as THREE.Object3D | undefined;
    if (tail) tail.rotation.z = Math.sin(time * 8 + animal.phase) * 0.32;
  }
}

function createGoose(): THREE.Group {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: "#fbf5e8", roughness: 0.58 });
  const orange = new THREE.MeshStandardMaterial({ color: "#d99537", roughness: 0.54 });
  const dark = new THREE.MeshStandardMaterial({ color: "#2e302d", roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), white);
  body.scale.set(1.28, 0.8, 1.55);
  body.position.y = 0.4;
  group.add(body);

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.27, 5, 10), white);
  neck.position.set(0, 0.69, -0.26);
  neck.rotation.x = -0.18;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), white);
  head.scale.set(1, 0.94, 1.08);
  head.position.set(0, 0.91, -0.33);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), orange);
  beak.scale.set(0.8, 0.35, 1.32);
  beak.position.set(0, 0.88, -0.48);
  group.add(beak);

  for (const x of [-0.28, 0.28]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), white);
    wing.scale.set(0.48, 0.48, 1.12);
    wing.position.set(x, 0.45, 0.03);
    wing.rotation.z = x * 0.65;
    group.add(wing);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), dark);
    eye.position.set(x, 0.95, -0.43);
    group.add(eye);

    const legRig = new THREE.Group();
    legRig.position.set(x * 2.4, 0.27, 0.02);
    group.add(legRig);
    legs.push(legRig);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 6), orange);
    leg.position.y = -0.12;
    legRig.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.13), orange);
    foot.position.set(0, -0.25, -0.04);
    legRig.add(foot);
  }

  group.userData.legs = legs;
  addSoftShadow(group, 0.08, 0.06, 0.82, 0.48, 0, 0.16);
  group.scale.setScalar(0.76);
  return group;
}

function createCorgi(): THREE.Group {
  const group = new THREE.Group();
  const tan = new THREE.MeshStandardMaterial({ color: "#bc763b", roughness: 0.56 });
  const cream = new THREE.MeshStandardMaterial({ color: "#f2dfbc", roughness: 0.58 });
  const dark = new THREE.MeshStandardMaterial({ color: "#302820", roughness: 0.56 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), tan);
  body.scale.set(1.25, 0.72, 1.05);
  body.position.y = 0.42;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 9), cream);
  chest.scale.set(1.08, 1.12, 0.35);
  chest.position.set(0, 0.41, -0.29);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), tan);
  head.scale.set(1.06, 0.94, 0.95);
  head.position.set(0, 0.7, -0.34);
  group.add(head);

  for (const x of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), tan);
    ear.position.set(x, 0.99, -0.31);
    ear.rotation.y = Math.PI / 4;
    group.add(ear);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.12, 0.12]) {
      const legRig = new THREE.Group();
      legRig.position.set(x, 0.29, z);
      group.add(legRig);
      legs.push(legRig);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 7), cream);
      leg.position.y = -0.14;
      legRig.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), cream);
      paw.scale.z = 1.25;
      paw.position.set(0, -0.29, -0.025);
      legRig.add(paw);
    }
  }

  const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), cream);
  forehead.scale.set(0.72, 1.18, 0.35);
  forehead.position.set(0, 0.79, -0.58);
  group.add(forehead);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), cream);
  muzzle.scale.set(1.1, 0.75, 0.75);
  muzzle.position.set(0, 0.64, -0.55);
  group.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
  nose.position.set(0, 0.66, -0.68);
  group.add(nose);
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark);
    eye.position.set(x, 0.75, -0.58);
    group.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 7), tan);
  tail.position.set(0, 0.61, 0.35);
  tail.rotation.x = 0.62;
  group.add(tail);

  group.userData.legs = legs;
  group.userData.tail = tail;
  addSoftShadow(group, 0.08, 0.08, 0.92, 0.5, 0, 0.16);
  group.scale.setScalar(0.88);
  return group;
}

function turnToward(current: number, target: number, maxStep: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + THREE.MathUtils.clamp(difference, -maxStep, maxStep);
}
