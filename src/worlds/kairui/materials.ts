import * as THREE from "three";

export type SwayTimeUniform = { value: number };

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

/**
 * Soft, low-poly vegetation movement. The phase uses the object's world
 * transform (and instance offset when present), so shared materials never make
 * a grove move in lockstep.
 */
export function matSway(
  color: THREE.ColorRepresentation,
  amount = 0.08,
  speed = 1,
  timeUniforms: SwayTimeUniform[] = []
): THREE.MeshStandardMaterial {
  const material = matte(color);
  const uTime: SwayTimeUniform = { value: 0 };
  timeUniforms.push(uTime);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 swayOrigin = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          swayOrigin += instanceMatrix[3].xyz;
        #endif
        float swayPhase = dot(swayOrigin.xz, vec2(1.73, 2.31));
        float swayWeight = smoothstep(-0.25, 1.1, position.y) * ${amount.toFixed(3)};
        transformed.x += sin(uTime * ${speed.toFixed(3)} + swayPhase) * swayWeight;
        transformed.z += cos(uTime * ${(speed * 0.83).toFixed(3)} + swayPhase * 1.29) * swayWeight * 0.62;`);
  };
  material.customProgramCacheKey = () => `kairui-sway-${amount}-${speed}`;
  return material;
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
      uSunDirection: { value: new THREE.Vector3(-0.46, 0.78, 0.42).normalize() },
      uGlitter: { value: 0.5 },
      uMoonPath: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(-0.9, 0.45, -0.06).normalize() },
      uHorizon: { value: new THREE.Color("#f7dfb5") }
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
      uniform vec3 uMoonDir;
      uniform vec3 uHorizon;
      uniform float uTime;
      uniform float uGlitter;
      uniform float uMoonPath;
      varying float vWave;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        vec3 sunDirection = normalize(uSunDirection);
        float ndl = max(dot(normal, sunDirection), 0.0);
        float waveMix = clamp(vWave * 0.55 + 0.5, 0.0, 1.0);
        vec3 water = mix(uDeep, uShallow, waveMix) * (0.72 + 0.45 * ndl);
        water = mix(water, vec3(0.82, 0.91, 0.92), smoothstep(0.86, 1.0, waveMix) * 0.16);

        vec3 reflection = reflect(-sunDirection, normal);
        float reflectedView = max(dot(reflection, viewDirection), 0.0);
        water += uSun * pow(reflectedView, 70.0) * 0.8;

        vec2 cell = floor(vWorld.xz * 1.4);
        float cellHash = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float twinkle = max(sin(uTime * (0.3 + cellHash * 0.75) + cellHash * 39.0), 0.0);
        float glitterGate = step(0.62, fract(cellHash * 7.31));
        water += uSun * pow(reflectedView, 120.0) * twinkle * twinkle * glitterGate * uGlitter * 0.9;

        float cameraDistance = length(cameraPosition - vWorld);
        vec2 moonOffset = vWorld.xz - cameraPosition.xz;
        vec2 moonDirection = normalize(uMoonDir.xz);
        float alongMoonPath = dot(moonOffset, moonDirection);
        float moonLateralDistance = abs(moonOffset.x * moonDirection.y - moonOffset.y * moonDirection.x);
        float moonBandWidth = 2.0 + alongMoonPath * 0.055;
        float moonPath = smoothstep(moonBandWidth, moonBandWidth * 0.25, moonLateralDistance) * step(0.0, alongMoonPath);
        float moonCrest = pow(waveMix, 2.0);
        water += vec3(0.72, 0.76, 0.78) * moonPath
          * (0.30 + 0.45 * twinkle + 0.55 * moonCrest)
          * uMoonPath * 0.12 * smoothstep(6.0, 14.0, cameraDistance);

        float shoreX = 18.0 * sin(vWorld.z * 0.016 + 0.35)
          + 7.0 * sin(vWorld.z * 0.043)
          + 13.0 * exp(-pow((vWorld.z + 16.0) / 54.0, 2.0))
          - 7.0 * exp(-pow((vWorld.z + 104.0) / 31.0, 2.0));
        float shoreDistance = vWorld.x - shoreX;
        float foamBand = smoothstep(-1.0, 0.5, shoreDistance) * (1.0 - smoothstep(1.6, 3.2, shoreDistance));
        float foamRoll = 0.5 + 0.5 * sin(shoreDistance * 1.9 - uTime * 1.3 + sin(vWorld.z * 0.3) * 1.2);
        float foam = foamBand * smoothstep(0.55, 0.9, foamRoll);
        water = mix(water, vec3(0.94, 0.95, 0.91), foam * 0.55);

        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
        water = mix(water, uHorizon, fresnel * 0.32);
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
