import * as THREE from "three";

export function matte(color: THREE.ColorRepresentation, roughness = 0.86): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: Math.max(roughness, 0.9),
    metalness: 0,
    envMapIntensity: 0.34,
    dithering: true
  });
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
        float waveA = sin(p.x * 0.055 + uTime * 0.42) * 0.34;
        float waveB = cos(p.y * 0.068 - uTime * 0.32) * 0.22;
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
        float band = sin((vWorld.x + vWorld.z) * 0.11) * 0.5 + 0.5;
        float sparkle = smoothstep(0.94, 1.0, sin(vWorld.x * 0.9 + vWorld.z * 0.72 + vWave * 9.0) * 0.5 + 0.5);
        vec3 water = mix(uDeep, uShallow, 0.38 + vWave * 0.48 + band * 0.08);
        water = mix(water, uSun, sparkle * 0.12);
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
      uZenith: { value: new THREE.Color("#83b4c6") },
      uSunColor: { value: new THREE.Color("#ffd59e") },
      uSunDirection: { value: new THREE.Vector3(0.72, 0.26, -0.34).normalize() },
      uGlow: { value: 0.42 }
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
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      uniform float uGlow;
      varying vec3 vPosition;
      void main() {
        vec3 direction = normalize(vPosition);
        float height = pow(smoothstep(-0.08, 0.72, direction.y), 0.72);
        vec3 color = mix(uHorizon, uZenith, height);
        color += uSunColor * pow(max(dot(direction, uSunDirection), 0.0), 10.0) * uGlow;
        color *= 1.0 - 0.08 * (1.0 - smoothstep(0.0, 0.12, direction.y));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}
