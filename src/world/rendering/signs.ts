import * as THREE from "three";

export function createLabelSign(text: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create sign canvas");

  context.fillStyle = "#f7ecd8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#9e7750";
  context.lineWidth = 12;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = "#3e352a";
  context.font = "700 34px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  sign.rotation.x = -0.15;
  return sign;
}

export function createTownWelcomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1120;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create town welcome sign texture");

  context.fillStyle = "#fff3dc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#744d31";
  context.lineWidth = 20;
  context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  context.strokeStyle = "#c69a5c";
  context.lineWidth = 8;
  context.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);
  context.fillStyle = "#4b3829";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 48px Georgia, serif";
  context.fillText("THE 100TH", canvas.width / 2, 102);
  context.font = "700 70px Georgia, serif";
  context.fillText("HACKATHONER VILLE", canvas.width / 2, 186);
  context.fillStyle = "#a35b43";
  context.font = "700 31px Arial, sans-serif";
  context.fillText("19 OF 100 SHIPPED", canvas.width / 2, 265);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
