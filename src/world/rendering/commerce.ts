import * as THREE from "three";
import { addSoftShadow } from "./shadows";
import { createLabelSign } from "./signs";
import { addGrassClump } from "./props";

export function addMarket(scene: THREE.Scene, label: string, x: number, z: number, color: string, rotationY = 0): void {
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1, 1.5),
    new THREE.MeshStandardMaterial({ color: "#f6ead4", roughness: 0.75 })
  );
  counter.position.y = 0.5;
  counter.castShadow = true;
  stall.add(counter);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.25, 1.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  roof.position.y = 1.35;
  roof.castShadow = true;
  stall.add(roof);

  const sign = createLabelSign(label);
  sign.position.set(0, 1.9, -0.95);
  stall.add(sign);

  addSoftShadow(stall, 0.6, 0.45, 3.4, 1.9, -0.12, 0.2);
  stall.position.set(x, 0, z);
  stall.rotation.y = rotationY;
  scene.add(stall);
}

export function addMarketBooth(
  scene: THREE.Scene,
  x: number,
  z: number,
  label: string,
  canopyColor: string,
  stripeColor: string
): void {
  const booth = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#9b7046", roughness: 0.82 });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#5e4734", roughness: 0.86 });
  const canopyMaterials = [canopyColor, stripeColor, canopyColor].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.72, 1.18), wood);
  counter.position.y = 0.48;
  counter.castShadow = true;
  booth.add(counter);

  for (const [index, offset] of [-0.82, 0, 0.82].entries()) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 1.65), canopyMaterials[index]);
    stripe.position.set(offset, 1.92, 0);
    stripe.rotation.z = index === 1 ? 0.02 : -0.02;
    stripe.castShadow = true;
    booth.add(stripe);
  }

  for (const poleX of [-1.08, 1.08]) {
    for (const poleZ of [-0.58, 0.58]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.82, 0.07), darkWood);
      pole.position.set(poleX, 1.02, poleZ);
      pole.castShadow = true;
      booth.add(pole);
    }
  }

  const sign = createLabelSign(label);
  sign.position.set(0, 1.55, -0.66);
  sign.scale.setScalar(0.52);
  booth.add(sign);

  const crateMaterial = new THREE.MeshStandardMaterial({ color: "#bd8d55", roughness: 0.9 });
  for (const crateX of [-0.72, 0.72]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.52), crateMaterial);
    crate.position.set(crateX, 0.94, -0.06);
    crate.castShadow = true;
    booth.add(crate);
    for (let item = 0; item < 3; item += 1) {
      const produce = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: item % 2 ? "#f0b65c" : "#6d985d", roughness: 0.78 })
      );
      produce.position.set(crateX + (item - 1) * 0.15, 1.17, -0.06);
      produce.castShadow = true;
      booth.add(produce);
    }
  }

  addSoftShadow(booth, 0.38, 0.3, 3.1, 1.6, -0.1, 0.18);
  booth.position.set(x, 0, z);
  scene.add(booth);
}

export function addMarketLawn(scene: THREE.Scene, x: number, z: number, width = 3.75, depth = 2.55): void {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: "#96af78", roughness: 0.96 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(x, 0.014, z);
  lawn.receiveShadow = true;
  scene.add(lawn);

  for (const [offsetX, offsetZ, size] of [
    [-1.42, -0.86, 0.6],
    [1.35, 0.78, 0.55],
    [-1.52, 0.76, 0.42]
  ] as const) {
    addGrassClump(scene, x + offsetX, z + offsetZ, size);
  }
}

export function addParcelCart(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const cart = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.58, 0.82),
    new THREE.MeshStandardMaterial({ color: "#7f9a78", roughness: 0.78 })
  );
  body.position.y = 0.66;
  body.castShadow = true;
  cart.add(body);

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.94),
    new THREE.MeshStandardMaterial({ color: "#f0d18b", roughness: 0.7 })
  );
  lid.position.y = 1.01;
  lid.castShadow = true;
  cart.add(lid);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#3d403c", roughness: 0.72 });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.02, 10), wheelMaterial);
  axle.position.set(-0.55, 0.32, 0);
  axle.rotation.x = Math.PI / 2;
  axle.castShadow = true;
  cart.add(axle);

  for (const wheelZ of [-0.5, 0.5]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.12, 14), wheelMaterial);
    wheel.position.set(-0.55, 0.3, wheelZ);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    cart.add(wheel);
  }

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: "#5e4734", roughness: 0.8 })
  );
  handle.position.set(1.12, 0.48, 0);
  handle.rotation.z = Math.PI / 2;
  cart.add(handle);
  addSoftShadow(cart, 0.25, 0.18, 2.1, 1.05, -0.1, 0.16);
  cart.position.set(x, 0, z);
  cart.rotation.y = rotation;
  scene.add(cart);
}

export function addCommunityBoard(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const board = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: "#76583b", roughness: 0.84 });
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 1.05, 0.12),
    new THREE.MeshStandardMaterial({ color: "#e9d7ae", roughness: 0.86 })
  );
  panel.position.y = 1.2;
  panel.castShadow = true;
  board.add(panel);
  for (const postX of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.1), frame);
    post.position.set(postX, 0.88, 0);
    post.castShadow = true;
    board.add(post);
  }
  for (const [noteX, noteY, color] of [
    [-0.45, 1.35, "#d5745c"],
    [0.05, 1.12, "#6f9d91"],
    [0.48, 1.42, "#e7b956"]
  ] as const) {
    const note = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.3, 0.025),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    );
    note.position.set(noteX, noteY, -0.075);
    board.add(note);
  }
  addSoftShadow(board, 0.36, 0.16, 2.3, 0.5, -0.15, 0.18);
  board.position.set(x, 0, z);
  board.rotation.y = rotation;
  scene.add(board);
}
