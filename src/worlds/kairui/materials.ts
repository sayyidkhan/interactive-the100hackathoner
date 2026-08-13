import * as THREE from "three";

export function matte(color: THREE.ColorRepresentation, roughness = 0.86): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: Math.max(roughness, 0.82),
    metalness: 0,
    envMapIntensity: 0.34,
    dithering: true
  });
}

export function makeWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#397f90") },
      uShallow: { value: new THREE.Color("#8bc7bd") },
      uSun: { value: new THREE.Color("#ffe4a1") },
      uSunDirection: { value: new THREE.Vector3(-0.46, 0.78, 0.42).normalize() }
    },
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float waveA = sin(p.x * 0.048 + uTime * 0.58) * 0.25;
        float waveB = cos(p.y * 0.061 - uTime * 0.42) * 0.18;
        float waveC = sin((p.x + p.y) * 0.024 + uTime * 0.29) * 0.14;
        p.z += waveA + waveB + waveC;
        float dx = cos(p.x * 0.048 + uTime * 0.58) * 0.012
          + cos((p.x + p.y) * 0.024 + uTime * 0.29) * 0.0034;
        float dy = -sin(p.y * 0.061 - uTime * 0.42) * 0.011
          + cos((p.x + p.y) * 0.024 + uTime * 0.29) * 0.0034;
        vNormal = normalize(mat3(modelMatrix) * vec3(-dx, -dy, 1.0));
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vWave = waveA + waveB + waveC;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      uniform vec3 uSunDirection;
      varying float vWave;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.2);
        vec3 halfVector = normalize(viewDirection + uSunDirection);
        float glint = pow(max(dot(normalize(vNormal), halfVector), 0.0), 110.0);
        float crest = smoothstep(0.32, 0.52, vWave);
        vec3 water = mix(uDeep, uShallow, 0.30 + fresnel * 0.48 + vWave * 0.18);
        water = mix(water, uSun, glint * 0.72 + crest * 0.045);
        gl_FragColor = vec4(water, 1.0);
        #include <fog_fragment>
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
        float sunAmount = max(dot(direction, uSunDirection), 0.0);
        color += uSunColor * pow(sunAmount, 10.0) * uGlow;
        color += uSunColor * smoothstep(0.9985, 0.9995, sunAmount) * 1.35;
        color *= 1.0 - 0.08 * (1.0 - smoothstep(0.0, 0.12, direction.y));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}
