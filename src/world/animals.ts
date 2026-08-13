import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { type AnimalSchema } from "../data/townSchema";
import { addSoftShadow } from "./rendering/shadows";
import { TOWN_SPREAD } from "./worldConstants";

export type TownAnimal = {
  schemaId: string;
  object: THREE.Group;
  waypoints: THREE.Vector3[];
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  phase: number;
  bob: number;
  nextDecision: number;
};

export function createTownAnimals(parent: THREE.Object3D, schemas: AnimalSchema[]): TownAnimal[] {
  const scaleWaypoints = (points: Array<[number, number]>) =>
    points.map(([x, z]) => new THREE.Vector3(x * TOWN_SPREAD, 0, z * TOWN_SPREAD));
  const specs = schemas.map((schema) => ({
    schemaId: schema.id,
    object: createAnimalModel(schema),
    waypoints: scaleWaypoints(schema.route),
    speed: schema.speed,
    phase: schema.phase ?? 0,
    bob: schema.bob ?? (schema.kind === "corgi" ? 0.035 : 0.025),
    nextDecision: 0
  }));

  for (const animal of specs) {
    animal.object.position.copy(animal.waypoints[0]);
    animal.object.name = `animal:${animal.schemaId}`;
    parent.add(animal.object);
  }
  return specs.map((animal) => ({
    ...animal,
    target: animal.waypoints[1].clone(),
    velocity: new THREE.Vector3()
  }));
}

export function createAnimalModel(schema: AnimalSchema): THREE.Group {
  return schema.kind === "goose"
    ? createGoose(schema.primaryColor, schema.secondaryColor)
    : createCorgi(schema.primaryColor, schema.secondaryColor);
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

function animalMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createGoose(primaryColor: string, secondaryColor: string): THREE.Group {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.76 });
  const wingWhite = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.86 });
  wingWhite.color.offsetHSL(0, -0.03, -0.04);
  const orange = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: "#292824", roughness: 0.68 });

  const body = animalMesh(new THREE.SphereGeometry(0.32, 22, 16), white);
  body.scale.set(0.95, 0.82, 1.3);
  body.position.set(0, 0.4, 0.02);
  group.add(body);

  const neck = animalMesh(new THREE.CapsuleGeometry(0.065, 0.4, 7, 14), white);
  neck.position.set(0, 0.72, -0.25);
  neck.rotation.x = -0.16;
  group.add(neck);

  const head = animalMesh(new THREE.SphereGeometry(0.13, 20, 14), white);
  head.scale.set(1, 0.96, 1.04);
  head.position.set(0, 1.03, -0.34);
  group.add(head);

  const beak = animalMesh(new THREE.ConeGeometry(0.052, 0.17, 12), orange);
  beak.position.set(0, 1.01, -0.48);
  beak.rotation.x = -Math.PI / 2;
  group.add(beak);

  for (const x of [-0.275, 0.275]) {
    const wing = animalMesh(new THREE.SphereGeometry(0.19, 18, 12), wingWhite);
    wing.scale.set(0.38, 0.5, 1.12);
    wing.position.set(x, 0.44, -0.005);
    wing.rotation.z = x > 0 ? 0.18 : -0.18;
    group.add(wing);
  }

  for (const x of [-0.062, 0.062]) {
    const eye = animalMesh(new THREE.SphereGeometry(0.014, 8, 6), dark);
    eye.position.set(x, 1.065, -0.445);
    group.add(eye);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.095, 0.095]) {
    const legRig = new THREE.Group();
    legRig.position.set(x, 0.25, 0.02);
    group.add(legRig);
    legs.push(legRig);
    const leg = animalMesh(new THREE.CylinderGeometry(0.016, 0.018, 0.24, 8), orange);
    leg.position.y = -0.11;
    legRig.add(leg);
    const foot = animalMesh(new RoundedBoxGeometry(0.085, 0.035, 0.15, 3, 0.014), orange);
    foot.position.set(0, -0.235, -0.045);
    legRig.add(foot);
  }

  group.userData.legs = legs;
  addSoftShadow(group, 0.08, 0.06, 0.76, 0.46, 0, 0.14);
  group.scale.setScalar(0.8);
  return group;
}

function createCorgi(primaryColor: string, secondaryColor: string): THREE.Group {
  const group = new THREE.Group();
  const tan = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.76 });
  const cream = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: "#302820", roughness: 0.68 });

  const body = animalMesh(new RoundedBoxGeometry(0.48, 0.34, 0.72, 6, 0.11), tan);
  body.position.y = 0.38;
  group.add(body);

  const chest = animalMesh(new RoundedBoxGeometry(0.28, 0.27, 0.055, 5, 0.025), cream);
  chest.position.set(0, 0.39, -0.375);
  group.add(chest);

  const head = animalMesh(new THREE.SphereGeometry(0.22, 22, 16), tan);
  head.scale.set(1.03, 0.98, 0.96);
  head.position.set(0, 0.65, -0.35);
  group.add(head);

  for (const x of [-0.14, 0.14]) {
    const ear = animalMesh(new THREE.ConeGeometry(0.082, 0.22, 5), tan);
    ear.position.set(x, 0.875, -0.34);
    ear.rotation.z = x > 0 ? -0.1 : 0.1;
    group.add(ear);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-0.16, 0.16]) {
    for (const z of [-0.22, 0.22]) {
      const legRig = new THREE.Group();
      legRig.position.set(x, 0.285, z);
      group.add(legRig);
      legs.push(legRig);
      const leg = animalMesh(new RoundedBoxGeometry(0.105, 0.2, 0.105, 4, 0.04), cream);
      leg.position.y = -0.105;
      legRig.add(leg);
      const paw = animalMesh(new RoundedBoxGeometry(0.115, 0.065, 0.15, 4, 0.025), cream);
      paw.position.set(0, -0.225, -0.025);
      legRig.add(paw);
    }
  }

  const forehead = animalMesh(new THREE.SphereGeometry(0.07, 14, 10), cream);
  forehead.scale.set(0.62, 1.2, 0.3);
  forehead.position.set(0, 0.745, -0.558);
  group.add(forehead);
  const muzzle = animalMesh(new RoundedBoxGeometry(0.235, 0.125, 0.16, 5, 0.052), cream);
  muzzle.position.set(0, 0.575, -0.515);
  group.add(muzzle);
  const nose = animalMesh(new THREE.SphereGeometry(0.034, 12, 8), dark);
  nose.position.set(0, 0.6, -0.615);
  group.add(nose);
  for (const x of [-0.075, 0.075]) {
    const eye = animalMesh(new THREE.SphereGeometry(0.021, 10, 7), dark);
    eye.position.set(x, 0.685, -0.55);
    group.add(eye);
  }
  const tail = animalMesh(new THREE.ConeGeometry(0.065, 0.32, 9), tan);
  tail.position.set(0, 0.57, 0.405);
  tail.rotation.x = 0.58;
  group.add(tail);

  group.userData.legs = legs;
  group.userData.tail = tail;
  addSoftShadow(group, 0.08, 0.08, 0.76, 0.46, 0, 0.14);
  group.scale.setScalar(0.94);
  return group;
}

function turnToward(current: number, target: number, maxStep: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + THREE.MathUtils.clamp(difference, -maxStep, maxStep);
}
