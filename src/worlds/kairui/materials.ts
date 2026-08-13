import * as THREE from "three";

export function matte(color: THREE.ColorRepresentation, roughness = 0.86): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

export function makeWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#397f90") },
      uShallow: { value: new THREE.Color("#8bc7bd") },
      uSun: { value: new THREE.Color("#ffe4a1") }
    },
    vertexShader: `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float waveA = sin(p.x * 0.22 + uTime * 0.72) * 0.12;
        float waveB = cos(p.y * 0.28 - uTime * 0.54) * 0.08;
        p.z += waveA + waveB;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vWave = waveA + waveB;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        float band = sin((vWorld.x + vWorld.z) * 0.36) * 0.5 + 0.5;
        float sparkle = smoothstep(0.91, 1.0, sin(vWorld.x * 1.8 + vWorld.z * 1.45 + vWave * 12.0) * 0.5 + 0.5);
        vec3 water = mix(uDeep, uShallow, 0.42 + vWave * 1.4 + band * 0.09);
        water = mix(water, uSun, sparkle * 0.2);
        gl_FragColor = vec4(water, 1.0);
      }
    `
  });
}

export function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: new THREE.Color("#f7dfb5") },
      uZenith: { value: new THREE.Color("#83b4c6") }
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vPosition;
      void main() {
        float height = smoothstep(-0.18, 0.72, normalize(vPosition).y);
        vec3 color = mix(uHorizon, uZenith, height);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}
