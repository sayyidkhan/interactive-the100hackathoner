
/* ── cold-load bootstrap: local three.js with real byte progress; CDN only as a last resort ── */
const __ogMode = new URLSearchParams(location.search).get('capture') === 'og';
let gateLock = true, __framesRendered = 0;
async function __loadThree() {
  const L = window.__loader;
  try {
    const res = await fetch('./three.module.js');
    if (!res.ok) throw new Error('http ' + res.status);
    const len = +res.headers.get('Content-Length') || 0;
    if (res.body) {
      const rd = res.body.getReader(), chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (L) L.progress(len ? 0.8 * Math.min(1, got / len) : 0.8 * (got / (got + 400000)));
      }
      return await import(URL.createObjectURL(new Blob(chunks, { type: 'text/javascript' })));
    }
    return await import('./three.module.js');
  } catch (e) {
    try { return await import('./three.module.js'); }
    catch (e2) { return await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'); }
  }
}
const THREE = await __loadThree();
window.__threeReady = true;
if (window.__loader) window.__loader.progress(0.85);

/* ═══════════════════════ TUNABLES ═══════════════════════ */
const CONFIG = {
  scrollLengthPx: 9000,     // total virtual scroll distance
  touchMultiplier: 2.2,     // touch-drag speed vs wheel
  flickCap: 0.07,           // burst budget: max u an instant flick can jump
  flickRefill: 0.10,        // budget refill rate (u/sec) — sustained scroll always keeps moving
  followEase: 4.0,          // how quickly camera chases scroll target
  maxScrollSpeed: 0.22,     // u/sec cap — nav jumps fly, never teleport
  parallaxDeg: 2.0,         // mouse parallax amplitude
  camFov: 55,
  fogNear: 160, fogFar: 800,
  waves: { a1: 0.48, f1: 0.045, s1: 0.9,   // three summed sines
           a2: 0.32, f2: 0.062, s2: 1.25,
           a3: 0.24, f3: 0.028, s3: 0.55 },
};

/* Chapter windows in scroll-space (UI: dots, cards, glow). `jump` = dot-nav landing */
const CHAPTERS = [
  { label: 'Start',    u0: 0.000, u1: 0.096, jump: 0.000 },
  { label: 'About',    u0: 0.140, u1: 0.250, jump: 0.195 },
  { label: 'Skills',   u0: 0.294, u1: 0.386, jump: 0.340 },
  { label: 'Work',     u0: 0.386, u1: 0.678, jump: 0.426 },
  { label: 'Projects', u0: 0.730, u1: 0.869, jump: 0.744 },
  { label: 'Contact',  u0: 0.885, u1: 1.000, jump: 1.000 },
];
/* Five street-level mini-dwells through town — camera settles square-on to each facade */
const TOWN_STOPS = [
  { u0: 0.404,  u1: 0.448,  node: 8,  drift: 0.10 },  // Gobattle
  { u0: 0.4585, u1: 0.5025, node: 9,  drift: 0.10 },  // U-Mich
  { u0: 0.513,  u1: 0.557,  node: 10, drift: 0.10 },  // PlatePromos
  { u0: 0.5675, u1: 0.6115, node: 11, drift: 0.10 },  // Mirai
  { u0: 0.622,  u1: 0.666,  node: 12, drift: 0.10 },  // Stanford
];
/* Full dwell list driving the camera warp (chapter dwells + town mini-dwells) */
const STOPS = [
  { u0: 0.000, u1: 0.096, node: 0,  drift: 0.35 },
  { u0: 0.140, u1: 0.250, node: 2,  drift: 0.30 },   // campsite (longer hero→campsite transit ahead of it)
  { u0: 0.294, u1: 0.386, node: 4,  drift: 0.30 },   // boathouse (longer campsite→boathouse transit ahead of it)
  ...TOWN_STOPS,
  { u0: 0.692, u1: 0.712, node: 15, drift: 0.30 },   // village farewell hold — slow rise in, long decelerating glide out
  { u0: 0.730, u1: 0.758, node: 17, drift: 0.08 },   // harbor walk: 2048
  { u0: 0.767, u1: 0.795, node: 18, drift: 0.08 },   // harbor walk: MeetWise
  { u0: 0.804, u1: 0.832, node: 19, drift: 0.08 },   // harbor walk: PlatePromos
  { u0: 0.841, u1: 0.869, node: 20, drift: 0.08 },   // harbor walk: Gobattle — then the fleet casts off (0.869→0.885)
  { u0: 0.885, u1: 1.000, node: 22, drift: 0.30 },
];

/* Canonical rest positions for snap-scrolling: hero, campsite, boathouse, 5 town buildings, farewell, 4 fleet boats, finale */
const SNAP_STOPS = [0.000, 0.195, 0.340, 0.426, 0.4805, 0.535, 0.5895, 0.644, 0.702, 0.744, 0.781, 0.818, 0.855, 1.000];   /* finale = EXACT end of range: the designed final composition */
function snapStopFor(u, dir) {
  if (dir > 0) { for (const s of SNAP_STOPS) if (s > u + 1e-4) return s; return SNAP_STOPS[SNAP_STOPS.length - 1]; }
  if (dir < 0) { for (let i = SNAP_STOPS.length - 1; i >= 0; i--) if (SNAP_STOPS[i] < u - 1e-4) return SNAP_STOPS[i]; return SNAP_STOPS[0]; }
  return SNAP_STOPS.reduce((a, b) => Math.abs(b - u) < Math.abs(a - u) ? b : a);
}
/* dot-nav / skip landings must BE canonical stops — snap every chapter jump onto the shared list */
CHAPTERS.forEach(ch => { ch.jump = SNAP_STOPS.reduce((a, b) => Math.abs(b - ch.jump) < Math.abs(a - ch.jump) ? b : a); });

/* ── Per-segment scroll budget ──────────────────────────────────────────────
   The scroll→journey mapping is NOT a single global slope. Each gap between two
   canonical SNAP_STOPS gets its own scroll weight: weight N means that segment
   costs N× the scroll input per unit of journey it covers. The four harbor hops
   (farewell→boat1 lead-in + the three boat→boat hops) are the physically-shortest
   segments, so they were the fastest to blow through — here they're weighted so a
   boat→boat hop costs MORE scroll than a town building→building hop, and the camera
   creeps through the harbor. Tune any single segment without touching the others.
   (Exit damping near each stop is layered ON TOP of this in scrollGear.) */
const SEG_WEIGHT = [
  1,    // 0.000→0.195  hero → campsite
  1,    // 0.195→0.340  campsite → boathouse
  1,    // 0.340→0.426  boathouse → Gobattle
  1.2,  // 0.426→0.4805 town hop — generous: first-visit arrest now guards the stops, weight is pacing only
  1.2,  // 0.4805→0.535 town hop
  1.2,  // 0.535→0.5895 town hop
  1.2,  // 0.5895→0.644 town hop
  1.2,  // 0.644→0.702  Stanford → farewell — matched to the town hops so every building exit costs the same
  1.75, // 0.702→0.744  farewell → boat 1 (harbor lead-in)
  1.75, // 0.744→0.781  boat 1 → boat 2
  1.75, // 0.781→0.818  boat 2 → boat 3
  1.75, // 0.818→0.855  boat 3 → boat 4
  1,    // 0.855→1.000  cast-off + rise to the finale deck
];
/* piecewise weights, value-blended across ±0.01 of each interior stop so the scroll→journey
   slope never steps at a scroll position — pacing changes are always a smooth ramp */
function segWeight(u) {
  let i = 0;
  while (i < SEG_WEIGHT.length - 1 && u >= SNAP_STOPS[i + 1] - 1e-9) i++;
  let w = SEG_WEIGHT[i];
  const B = 0.01;
  if (i > 0) {
    const d = u - SNAP_STOPS[i];
    if (d < B) w = SEG_WEIGHT[i - 1] + (w - SEG_WEIGHT[i - 1]) * (0.5 + 0.5 * smooth01(d / B));
  }
  if (i < SEG_WEIGHT.length - 1) {
    const d = SNAP_STOPS[i + 1] - u;
    if (d < B) w = SEG_WEIGHT[i + 1] + (w - SEG_WEIGHT[i + 1]) * (0.5 + 0.5 * smooth01(d / B));
  }
  return w;
}
/* input-side factor (≤1): how much of a raw scroll delta reaches the journey here */
const regionBudget = (u) => 1 / segWeight(u);

/* Camera path nodes: x/z + eye height above terrain; look target likewise */
const PATH_NODES = [
  { x: 110, z: -233, up: 19, look: { x: -4,   z: 55,   up: 4  } }, // 0  bluff (Start)
  { x: 84,  z: -185, up: 9,  look: { x: 30,   z: -80,  up: 6  } }, // 1
  { x: 52.5,z: -128, up: 3.6,look: { x: 45.5, z: -119.5,up: 1 } }, // 2  campsite (About)
  { x: 54,  z: -104, up: 7,  look: { x: 26,   z: -66,  up: 4  } }, // 3 — swings east, clear of the campsite circle
  { x: 32.5,z: -68,  up: 4.5,look: { x: 22.5, z: -56.5,up: 2.2} }, // 4  boathouse (Skills)
  { x: 32,  z: -38, up: 10, look: { x: 46,   z: -2,  up: 4  } }, // 5 — climbs from the boathouse toward the village
  { x: 38,  z: -19, up: 7,  look: { x: 31,   z: 32,  up: 2  } }, // 6  village gate — overlook down the cascading terraces
  { x: 41.5,z: -10, up: 3.6,look: { x: 52,   z: -6.5,up: 2.6} }, // 7  Kumon (top terrace)
  { x: 41.5,z: 6.8, up: 3.8,look: { x: 50.5, z: 3.8, up: 2.8} }, // 8  Gobattle — inside the terrace, no wall-back in frame
  { x: 30.5,z: 15,  up: 3.6,look: { x: 40.5, z: 12,  up: 2.4} }, // 9  U-Mich (third terrace)
  { x: 25.5,z: 31,  up: 3.8,look: { x: 36.5, z: 27,  up: 2.4} }, // 10 PlatePromos (second terrace)
  { x: 23,  z: 46,  up: 3.6,look: { x: 33,   z: 43,  up: 2.4} }, // 11 Mirai (lowest terrace)
  { x: 22.5,z: 54,  up: 3.7,look: { x: 31,   z: 50.5,up: 2.5} }, // 12 Stanford — sea edge, inside the parapet
  { x: 19.8,z: 57,  up: 8,  look: { x: 8,    z: 64,  up: 4  } }, // 13 lifts over the sea-gate gap
  { x: 13.5,z: 61,  up: 11, look: { x: -2,   z: 74,  up: 3  } }, // 14 rises over the sea wall, out across the water
  { x: 2,   z: 75,   up: 9,  look: { x: 30,   z: 38,   up: 2  } }, // 15 village farewell — out over the water, the full terraced hillside in one frame
  { x: 6,   z: 92,   up: 7,  look: { x: -14,  z: 112,  up: 2  } }, // 16 — approaches the pier ramp, first boat in view
  { x: -9,  z: 122,  up: 3.0,look: { x: -16.5,z: 113.2,up: 1.6} }, // 17 harbor walk: 2048 dinghy — boat-level; aim left of the hull so she sits clear of the card
  { x: -27, z: 128.5,up: 3.4,look: { x: -35.5,z: 114.8,up: 1.7} }, // 18 harbor walk: MeetWise day-sailer
  { x: -45, z: 131,  up: 3.6,look: { x: -55,  z: 116.6,up: 1.8} }, // 19 harbor walk: PlatePromos trawler
  { x: -61, z: 136,  up: 4.2,look: { x: -75.5,z: 119.4,up: 2.2} }, // 20 harbor walk: Gobattle flagship
  { x: -48, z: 138,  up: 13, look: { x: -30,  z: 152,  up: 2  } }, // 21 casts off with the fleet — rises off the pier end over the bay
  { x: 3.4, z: 154.6,up: 3.6,look: { x: -140, z: 148,  up: 10 } }, // 22 boat deck (Contact) — brazier left, bottle right, stars above
];

/* Time-of-day keyframes, lerped by scroll u */
const TOD = [
  { u: 0.00, sun: [0.75, 0.22, -0.35], sunCol: 0xFFD59E, dirCol: 0xFFD9A8, dirInt: 1.05,
    hemiSky: 0xFFE8C9, hemiGnd: 0xA3B08A, hemiInt: 0.78, top: 0xA8D8EA, hor: 0xFFE8C9,
    fog: 0xFFE3C6, deep: 0x3E86A3, shal: 0x5FB0C4, glow: 0.55 },
  { u: 0.42, sun: [0.25, 0.85, -0.20], sunCol: 0xFFF2CC, dirCol: 0xFFF6E0, dirInt: 1.20,
    hemiSky: 0xBFE3F2, hemiGnd: 0x9DB287, hemiInt: 0.82, top: 0x8EC9E8, hor: 0xDFF0F8,
    fog: 0xD9ECF5, deep: 0x2E7D9A, shal: 0x4FABC6, glow: 0.25 },
  { u: 0.74, sun: [-0.85, 0.16, 0.20], sunCol: 0xFFD9A0, dirCol: 0xFFB77D, dirInt: 1.10,
    hemiSky: 0xF5B98E, hemiGnd: 0x8F7B6A, hemiInt: 0.70, top: 0xE8788A, hor: 0xFFB77D,
    fog: 0xF2AC8B, deep: 0x35708E, shal: 0x5B93A8, glow: 0.65 },
  { u: 0.88, sun: [-0.6, 0.28, 0.26], sunCol: 0xC9D9F5, dirCol: 0x9FB8DD, dirInt: 0.7,
    hemiSky: 0x3D5480, hemiGnd: 0x35404F, hemiInt: 0.72, top: 0x1B2A4A, hor: 0x51689A,
    fog: 0x3E5378, deep: 0x1D3E5E, shal: 0x2A5273, glow: 0.30 },
  { u: 1.00, sun: [-0.9, 0.45, -0.06], sunCol: 0xDCE8FF, dirCol: 0xA9C3E8, dirInt: 0.75,
    hemiSky: 0x2A3E66, hemiGnd: 0x232D42, hemiInt: 0.92, top: 0x0D1530, hor: 0x1B2A4A,
    fog: 0x16264A, deep: 0x16324F, shal: 0x1E4260, glow: 0.55 },
];

/* ═══════════════════════ HELPERS ═══════════════════════ */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth01 = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const smoothstep = (a, b, x) => smooth01((x - a) / (b - a));
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

/* ═══════════════════════ TERRAIN ═══════════════════════ */
function shoreX(z) { return 14 * Math.sin(z * 0.017) + 6 * Math.sin(z * 0.043); }
/* terraced cliffside village: flat plateaus carved into the seaward ridge (walls dress the cuts) */
const TERR = [
  { x: 49, z: -2, r: 10.5, y: 17.5 },  // T4 — Kumon + Gobattle (top)
  { x: 38, z: 12, r: 10,   y: 13.5 },  // T3 — U-Mich
  { x: 33, z: 30, r: 11,   y: 9.5  },  // T2 — PlatePromos + Micheline
  { x: 30, z: 46, r: 10,   y: 6    },  // T1 — Mirai + Stanford (sea edge)
  { x: 68, z: 12, r: 9,    y: 21   },  // campus knoll — Berkeley keeps the highest point
];
function terrainH(x, z) {
  const d = x - shoreX(z);
  const land = smoothstep(-6, 30, d);
  const north = Math.pow(smoothstep(0, -215, z), 2.0);
  let h = land * (4 + 62 * north);
  /* rolling hills, stronger inland */
  const inland = smoothstep(10, 80, d);
  h += land * 3.5 * Math.sin(x * 0.05 + 1.3) * Math.sin(z * 0.045) * (0.5 + 1.5 * inland);
  /* seaward village ridge — the cliffside the terraces are carved into */
  h += land * 18 * smoothstep(16, 46, d) * Math.exp(-(((z - 20) / 40) ** 2));
  /* valley channel running to the sea around z ≈ -95 */
  h -= h * 0.38 * Math.exp(-(((z + 95) / 55) ** 2));
  /* facet noise */
  h += land * Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.6 * (0.3 + north);
  /* keep dry land above the waterline — no inland ponds */
  h = Math.max(h, 2.2 * land);
  /* terrace plateaus */
  for (const T of TERR) {
    const w = smoothstep(T.r + 6, T.r - 2.5, Math.hypot(x - T.x, z - T.z));
    h += (T.y - h) * w;
  }
  /* seabed dips below waterline offshore */
  h -= (1 - land) * 4;
  return h;
}

/* ═══════════════════════ SCENE ═══════════════════════ */
const canvas = document.getElementById('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); }
catch (e) { if (window.__loader) window.__loader.fail(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xFFE3C6, CONFIG.fogNear, CONFIG.fogFar);

const camera = new THREE.PerspectiveCamera(CONFIG.camFov, innerWidth / innerHeight, 0.5, 2500);

const hemi = new THREE.HemisphereLight(0xFFE8C9, 0x8FA07A, 0.75);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xFFD9A8, 1.05);
scene.add(dir);

/* — Terrain blockout — */
{
  const W = 460, D = 620, SX = 150, SZ = 200;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xDBC79C), cGrassA = new THREE.Color(0x9BC995),
        cGrassB = new THREE.Color(0x7FB069), cCliff = new THREE.Color(0xC9A87A),
        cDeepSand = new THREE.Color(0xB0A184), cWetSand = new THREE.Color(0xC4AD86),
        cDrySand = new THREE.Color(0xE4D3A8), cRockDark = new THREE.Color(0x8F7350),
        cMeadow = new THREE.Color(0xBACB7F), cOutcrop = new THREE.Color(0xA39A87);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + 55, z = pos.getZ(i) - 30;           // world offset
    x += (hash2(x, z) - 0.5) * 2.2; z += (hash2(z, x) - 0.5) * 2.2; // low-poly jitter
    const h = terrainH(x, z);
    pos.setXYZ(i, x, h, z);
    const gx = (terrainH(x + 1.5, z) - terrainH(x - 1.5, z)) / 3;
    const gz = (terrainH(x, z + 1.5) - terrainH(x, z - 1.5)) / 3;
    const slope = Math.hypot(gx, gz);
    const d = x - shoreX(z);
    if (d < -4) tmp.copy(cDeepSand);
    else if (h < 0.9 && d < 20) tmp.copy(cWetSand);       // sand only hugs the shoreline
    else if (h < 1.7 && d < 20) tmp.copy(cSand);
    else if (h < 2.6 && d < 20) tmp.copy(cDrySand);
    else if (slope > 1.85 && d < 30) tmp.copy(cRockDark); // sea-cliff faces only
    else if (slope > 1.35 && d < 30) tmp.copy(cCliff);
    else {
      tmp.copy(cGrassA).lerp(cGrassB, hash2(Math.floor(x / 7), Math.floor(z / 7)) * 0.85);
      /* meadow drifts: broad yellow-green patches from low-frequency waves */
      const mp = Math.sin(x * 0.045 + z * 0.028) + Math.sin(x * 0.019 - z * 0.041) + Math.sin((x + z) * 0.012 + 1.7);
      let k = Math.min(Math.max((mp - 1.05) * 1.3, 0), 1);
      tmp.lerp(cMeadow, k * k * (3 - 2 * k) * 0.5);
      /* faint rocky speckle on steeper grass */
      if (slope > 0.85) tmp.lerp(cOutcrop, Math.min((slope - 0.85) * 0.9, 0.4));
    }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
  scene.add(new THREE.Mesh(geo, mat));
}

/* — Ocean — */
const W = CONFIG.waves;
const waterUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  uTime:   { value: 0 },
  uA:      { value: new THREE.Vector3(W.a1, W.a2, W.a3) },
  uF:      { value: new THREE.Vector3(W.f1, W.f2, W.f3) },
  uS:      { value: new THREE.Vector3(W.s1 / 3, W.s2 / 3, W.s3 / 3) },   /* ÷3: the drifting crest-sheen patches read calm, not busy — wave SHAPE (uA/uF) untouched; no floater samples the water, so buoyancy is unaffected */
  uCalm:   { value: new THREE.Vector4(-1.5, 154.5, 9.0, 30.0) },   /* xy = finale mooring, zw = inner/outer damp radii */
  uMoonPath: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(-0.9, 0.45, -0.06).normalize() },
  uSunDir: { value: new THREE.Vector3(0.75, 0.22, -0.35).normalize() },
  uSunCol: { value: new THREE.Color(0xFFD59E) },
  uDeep:   { value: new THREE.Color(0x2E7D9A) },
  uShallow:{ value: new THREE.Color(0x3E9BB8) },
  uHor:    { value: new THREE.Color(0xFFE8C9) },
  uGlitter:{ value: 0.5 },
}]);
{
  const geo = new THREE.PlaneGeometry(1500, 1500, 130, 130);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: waterUniforms, fog: true,
    vertexShader: `
      uniform float uTime; uniform vec3 uA, uF, uS; uniform vec4 uCalm;
      varying float vWave; varying vec3 vNormal; varying vec3 vWorldPos;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float x = p.x, z = p.z;
        /* sheltered mooring: damp the swell near the finale boat so the deck always keeps freeboard */
        float calm = mix(0.25, 1.0, smoothstep(uCalm.z, uCalm.w, distance(p.xz, uCalm.xy)));
        float w = uA.x*sin(x*uF.x + uTime*uS.x) + uA.y*sin(z*uF.y + uTime*uS.y) + uA.z*sin((x+z)*uF.z + uTime*uS.z);
        w *= calm;
        p.y += w;
        float dx = calm * (uA.x*uF.x*cos(x*uF.x + uTime*uS.x) + uA.z*uF.z*cos((x+z)*uF.z + uTime*uS.z));
        float dz = calm * (uA.y*uF.y*cos(z*uF.y + uTime*uS.y) + uA.z*uF.z*cos((x+z)*uF.z + uTime*uS.z));
        vNormal = normalize(vec3(-dx, 1.0, -dz));
        vWave = w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uDeep, uShallow, uSunDir, uSunCol, uHor, uMoonDir;
      uniform float uTime, uGlitter, uMoonPath;
      varying float vWave; varying vec3 vNormal; varying vec3 vWorldPos;
      #include <fog_pars_fragment>
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorldPos);
        vec3 s = normalize(uSunDir);
        float ndl = max(dot(n, s), 0.0);
        float t = clamp(vWave * 0.55 + 0.5, 0.0, 1.0);
        vec3 col = mix(uDeep, uShallow, t) * (0.72 + 0.45 * ndl);
        col = mix(col, vec3(0.82, 0.91, 0.92), smoothstep(0.86, 1.0, t) * 0.16);
        vec3 r = reflect(-s, n);
        float rv = max(dot(r, v), 0.0);
        col += uSunCol * pow(rv, 70.0) * 0.8;
        vec2 cell = floor(vWorldPos.xz * 1.4);
        float h1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float tw = max(sin(uTime * (0.3 + h1 * 0.75) + h1 * 39.0), 0.0);   /* slow, breathing glitter plates — was 1.0–3.5 rad/s, too blinky */
        float gate = step(0.62, fract(h1 * 7.31));
        col += uSunCol * pow(rv, 120.0) * tw * tw * gate * uGlitter * 0.9;
        float camD = length(cameraPosition - vWorldPos);
        vec2 mo = vWorldPos.xz - cameraPosition.xz;                 // silver shimmer path: runs from the horizon beneath the moon toward the viewer
        vec2 mdir = normalize(uMoonDir.xz);
        float along = dot(mo, mdir);
        float lat = abs(mo.x * mdir.y - mo.y * mdir.x);
        float bandw = 2.0 + along * 0.055;                            // widens with distance (perspective)
        float mpath = smoothstep(bandw, bandw * 0.25, lat) * step(0.0, along);
        float crest = pow(clamp(vWave * 0.55 + 0.5, 0.0, 1.0), 2.0);  // glints ride the wave facets, not a painted stripe
        col += vec3(0.72, 0.76, 0.78) * mpath * (0.30 + 0.45 * tw + 0.55 * crest) * uMoonPath * 0.12 * smoothstep(6.0, 14.0, camD);
        float sd = vWorldPos.x - (14.0 * sin(vWorldPos.z * 0.017) + 6.0 * sin(vWorldPos.z * 0.043));
        float band = smoothstep(-1.0, 0.5, sd) * (1.0 - smoothstep(1.6, 3.2, sd));
        float roll = 0.5 + 0.5 * sin(sd * 1.9 - uTime * 1.3 + sin(vWorldPos.z * 0.3) * 1.2);
        float foam = band * smoothstep(0.55, 0.9, roll);
        col = mix(col, vec3(0.94, 0.95, 0.91), foam * 0.55);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col = mix(col, uHor, fres * 0.32);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(-250, 0.55, -30);
  scene.add(mesh);
}
/* far sea: giant flat plane carries the ocean color out to the horizon */
const farSeaMat = new THREE.MeshBasicMaterial({ color: 0x2E7D9A, fog: true });
{
  const g = new THREE.PlaneGeometry(9000, 9000);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, farSeaMat);
  m.position.set(-250, -0.7, -30);   // sits below the wave plane — only visible beyond its edge
  scene.add(m);
}

/* — Sky dome (follows camera) — */
const skyUniforms = {
  uTop:    { value: new THREE.Color(0xA8D8EA) },
  uHor:    { value: new THREE.Color(0xFFE8C9) },
  uSea:    { value: new THREE.Color(0x2E7D9A) },
  uSunDir: { value: new THREE.Vector3(0.75, 0.22, -0.35).normalize() },
  uSunCol: { value: new THREE.Color(0xFFD59E) },
  uGlow:   { value: 0.55 },
  uDither: { value: 0 },   /* og capture: kills gradient banding; 0 on normal loads */
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1100, 24, 12),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uSunDir, uSunCol, uSea; uniform float uGlow, uDither;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float f = pow(clamp(d.y * 2.2 + 0.10, 0.0, 1.0), 0.62);
        vec3 col = mix(uHor, uTop, f);
        col *= 1.0 - 0.10 * (1.0 - smoothstep(0.0, 0.09, d.y));   // ease into the horizon, no white glare
        col += uSunCol * pow(max(dot(d, normalize(uSunDir)), 0.0), 8.0) * uGlow;
        vec3 sea = uSea;                                           // matches fogged ocean at the horizon
        col = mix(sea, col, smoothstep(-0.006, 0.012, d.y));
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.6 / 255.0) * uDither;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

/* — Sun + moon billboard discs — */
function makeDisc(size, color) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, fog: false, depthWrite: false })
  );
  scene.add(m);
  return m;
}
const sunDisc = makeDisc(48, 0xFFD59E);
const moonDir = waterUniforms.uMoonDir.value;
/* — Moon: warm ivory gradient disc + flat maria + two-layer smooth halo + rare night wisp — */
const moonDisc = (() => {
  const R = 30, g = new THREE.Group();
  const geo = new THREE.CircleGeometry(R, 40);
  { const p = geo.attributes.position, arr = [];
    const cB = new THREE.Color(0xE9DAB9), cD = new THREE.Color(0xD2C398), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {   // brighter toward the sun's arc (lower edge), shaded upper rim
      const t = Math.min(1, Math.max(0, 0.5 - (p.getX(i) * 0.30 + p.getY(i) * 0.92) / (R * 1.9)));
      cc.copy(cD).lerp(cB, t); arr.push(cc.r, cc.g, cc.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3)); }
  const baseM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false, depthWrite: false });
  const base = new THREE.Mesh(geo, baseM); base.renderOrder = 1; g.add(base);
  const mariaM = new THREE.MeshBasicMaterial({ color: 0xC3B28A, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  for (const [x, y, r, sx, sy, rz] of [[-8.5, 5.5, 8.2, 1.35, 0.85, 0.4], [6.5, -3.5, 5.6, 0.95, 1.3, 2.1], [-3.5, -10.5, 4.3, 1.25, 0.8, 5.3], [10, 9.5, 3.1, 1, 1, 0]]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 8), mariaM);
    m.position.set(x, y, 0.6); m.scale.set(sx, sy, 1); m.rotation.z = rz; m.renderOrder = 2; g.add(m);
  }
  const haloM = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    uniforms: { uOp: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uOp; varying vec2 vUv;
      void main(){
        float rr = length(vUv - 0.5) * 9.0;                       // radial dist in moon radii
        float d = max(rr - 1.0, 0.0);
        float a = (0.26 * exp(-pow(d * 2.3, 1.25)) + 0.09 * exp(-d * 0.8)) * uOp;   // tight bright + wide faint, both smooth
        a += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.5 / 255.0);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.76) * max(a, 0.0), 1.0);
      }` });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(R * 9, R * 9), haloM);
  halo.position.z = -0.8; halo.renderOrder = 0; g.add(halo);
  const wispM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uOp: { value: 0 }, uSilver: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uOp, uSilver; varying vec2 vUv;
      void main(){
        vec2 q = (vUv - 0.5) * vec2(2.3, 2.7);
        float a = exp(-dot(q, q) * 1.7);
        vec2 q2 = q - vec2(0.6, 0.16);
        a = max(a, 0.75 * exp(-dot(q2, q2) * 2.4));
        vec3 col = mix(vec3(0.52, 0.57, 0.68), vec3(0.90, 0.94, 0.97), uSilver);   // edge silvers as it crosses the disc
        gl_FragColor = vec4(col, a * uOp);
      }` });
  const wisp = new THREE.Mesh(new THREE.PlaneGeometry(52, 14), wispM);
  wisp.position.set(0, 4, 1.4); wisp.renderOrder = 3; wisp.visible = false; g.add(wisp);
  g.userData = { baseM, mariaM, haloM, wispM, wisp, base };
  scene.add(g);
  return g;
})();

/* ═══════════════════════ WORLD PASS ═══════════════════════ */
const g0 = (x, z) => Math.max(terrainH(x, z), 0);
const MATS = {};
function mat(hex, em = 0) {
  const k = hex + '_' + em;
  if (!MATS[k]) MATS[k] = new THREE.MeshStandardMaterial({
    color: hex, flatShading: true, roughness: 1, metalness: 0,
    emissive: em ? hex : 0x000000, emissiveIntensity: em });
  return MATS[k];
}
/* material with gentle vertex sway — phase from instance position so nothing syncs */
const swayUnis = [];
function matSway(hex, amt = 0.08, spd = 1.0) {
  const m = new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n` +
        `#ifdef USE_INSTANCING\n float swPh = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;\n` +
        `#else\n float swPh = 0.0;\n#endif\n` +
        `float swW = smoothstep(-0.6, 1.2, position.y) * ${amt.toFixed(3)};\n` +
        `transformed.x += sin(uTime * ${spd.toFixed(3)} + swPh) * swW;\n` +
        `transformed.z += cos(uTime * ${(spd * 0.83).toFixed(3)} + swPh * 1.3) * swW * 0.6;`);
    swayUnis.push(sh.uniforms.uTime);
  };
  return m;
}
function add(parent, geo, hex, x, y, z, ry = 0, em = 0) {
  const m = new THREE.Mesh(geo, hex && hex.isMaterial ? hex : mat(hex, em));
  m.position.set(x, y, z); m.rotation.y = ry;
  parent.add(m); return m;
}
function prism(w, h, d) { /* triangular prism, ridge along z */
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}
/* terrain-conforming strip (creek, street) */
function ribbon(pts, width, hex, lift = 0.2, jitter = 0) {
  const pos = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, n - 1)], r = pts[Math.max(i - 1, 0)];
    const dx = q.x - r.x, dz = q.z - r.z, len = Math.hypot(dx, dz) || 1;
    const wl = width / 2 * (1 + jitter * (hash2(p.x * 3.1, p.z * 1.7) - 0.5));
    const wr = width / 2 * (1 + jitter * (hash2(p.z * 2.3, p.x * 4.7) - 0.5));
    const nxl = -dz / len * wl, nzl = dx / len * wl;
    const nxr = -dz / len * wr, nzr = dx / len * wr;
    pos.push(p.x + nxl, g0(p.x + nxl, p.z + nzl) + lift, p.z + nzl);
    pos.push(p.x - nxr, g0(p.x - nxr, p.z - nzr) + lift, p.z - nzr);
  }
  for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
  scene.add(m); return m;
}

/* — Idle glow-pulse for interactables: soft coral breathing, strongest at their chapter's dwell — */
const _cTmp = new THREE.Color();
const glowables = [], glowById = {}, hoverMeshes = [];
let campFire = null;
let boathouseDoors = null;
/* D: marker dots fade permanently once seen (persisted) */
let SEEN_IDS = new Set();
try { SEEN_IDS = new Set(JSON.parse(localStorage.getItem('cv_seen_markers') || '[]')); } catch (e) {}
const markSeen = (id) => { if (!id) return; SEEN_IDS.add(id); try { localStorage.setItem('cv_seen_markers', JSON.stringify([...SEEN_IDS])); } catch (e) {} };
/* Click-to-fly: which canonical scroll stop each interactable id flies the camera to. */
const STOP_BY_ID = {
  campsite: 0.195, boathouse: 0.340,
  gobattle: 0.426, umich: 0.4805, platepromos: 0.535, mirai: 0.5895, stanford: 0.644,
  berkeley: 0.426, 'berkeley-hall': 0.426,
  'boat-solver2048': 0.744, 'boat-meetwise': 0.781, 'boat-platepromos': 0.818, 'boat-gobattle': 0.855,
  pier: 0.744, 'finale-boat': 1.000,
};
/* Lightweight click-to-fly target: clickable + pointer cursor, no rim glow/marker — for big
   surfaces (pier, finale deck). Skips meshes already claimed by another interactable. */
function registerFly(obj, id) {
  obj.traverse((n) => {
    if (n.isMesh && !n.isInstancedMesh && !n.userData.hid) { n.userData.hid = id; hoverMeshes.push(n); }
  });
}
function registerGlow(obj, chapter, small = false, id = null, opts = {}) {
  const mats = [], meshes = [];
  obj.traverse((n) => { if (n.isMesh) meshes.push(n); });
  for (const n of meshes) {
    if (n.userData.hid && n.userData.hid !== id) continue;   // leave meshes already owned by another interactable (e.g. skill racks nested in the boathouse)
    if (id && !n.userData.hid) { n.userData.hid = id; hoverMeshes.push(n); }
    if (n.material && n.material.isMeshStandardMaterial && !(n.material.emissiveIntensity > 0)) {
      n.material = n.material.clone();
      n.material.emissive.setHex(0xFF7E5F);
      n.material.emissiveIntensity = 0;
      mats.push(n.material);
    }
  }
  const entry = { obj, mats, chapter, small, hover: false, em: 0, y0: obj.position.y, ry0: obj.rotation.y, s0: obj.scale.x, top: 0, ph: glowables.length * 1.7 };
  if (id) {
    const bb = new THREE.Box3().setFromObject(obj);
    entry.top = bb.max.y - bb.min.y;
    glowById[id] = entry;
    entry.id = id;
    entry.seen = SEEN_IDS.has(id);
    if (!opts.noShell) {
      /* white rim outline: inverted-hull shell per mesh, one material per interactable */
      entry.shellMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false });
      entry.shells = [];
      entry.shellVis = false;
      for (const n of meshes) {
        if (n.isInstancedMesh || (n.userData.hid && n.userData.hid !== id)) continue;
        if (!n.geometry.boundingSphere) n.geometry.computeBoundingSphere();
        const r = Math.max(n.geometry.boundingSphere.radius, 0.06);
        const sh = new THREE.Mesh(n.geometry, entry.shellMat);
        sh.scale.setScalar(Math.min(1.3, 1 + 0.055 / r));
        sh.visible = false;
        n.add(sh);
        entry.shells.push(sh);
      }
    }
    if (!opts.noMarker) {
      /* floating beacon dot — gentle bob, warm coral, gone forever once this object has been hovered */
      entry.markY = Math.min(entry.top + 0.6, 8);
      entry.marker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xFF7E5F, transparent: true, opacity: 0, depthWrite: false }));
      entry.marker.renderOrder = 5;
      entry.marker.visible = false;
      entry.marker.position.y = entry.markY;
      obj.add(entry.marker);
    }
  }
  glowables.push(entry);
}

/* — Ground-clamp helpers: everything samples terrain and sits ON it — */
function clampTo(grp, x, z, lift = 0) { grp.position.set(x, g0(x, z) + lift, z); return grp; }
/* flattened dirt pad under a building footprint; returns pad-top Y */
/* stone base under towers/boathouse; returns base-top Y */
function dirtPad(x, z, r) {
  r = r * 0.72;
  let top = -1e9, sum = 0;
  for (let a = 0; a < 8; a++) {
    const s = g0(x + Math.cos(a * 0.785) * r * 0.8, z + Math.sin(a * 0.785) * r * 0.8);
    top = Math.max(top, s); sum += s;
  }
  top = Math.min(top, sum / 8 + 0.9) + 0.08;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 1.4, 2.0, 9), mat(0x9A9284));
  m.position.set(x, top - 1.0, z);
  scene.add(m);
  return top;
}

/* — Creek: valley → sea (leads the eye forward) — */
const creekPts = [{x:66,z:-118},{x:60,z:-112},{x:50,z:-100},{x:40,z:-88},{x:30,z:-74},{x:22,z:-62},{x:14,z:-52},{x:2,z:-47},{x:-16,z:-44}];
ribbon(creekPts, 2.6, 0x3E9BB8, 0.22);
/* distance to the creek centerline — used to keep scatter off the water */
function nearCreek(x, z, r) {
  for (let i = 0; i < creekPts.length - 1; i++) {
    const a = creekPts[i], b = creekPts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < r) return true;
  }
  return false;
}
/* (village walkway + stream are built with the terrace hardscape below) */

/* — Buildings — */
const buildings = {};
const PALETTE = { white: 0xF2EDE3, whiteDk: 0xDFD8C6, sand: 0xE8D9BC, sandDk: 0xD6C3A0, terra: 0xC97B5A, terraDk: 0xB56A4C, sage: 0xA8B49A, sageDk: 0x94A187, charc: 0x4A4550, charcDk: 0x3B3742, trim: 0xF7F0DC, stone: 0x9A9284, roofT: 0xB35C40, roofB: 0x7A5A42, roofS: 0x5C6670 };
/* shared warm-glow glass: emissive driven by time-of-day (dusk/night) */
const glassMat = new THREE.MeshStandardMaterial({ color: 0xE8D9B8, emissive: 0xFFC98A, emissiveIntensity: 0.001, flatShading: true, roughness: 1 });
const lampMat  = new THREE.MeshStandardMaterial({ color: 0xF2E4C0, emissive: 0xFFC98A, emissiveIntensity: 0.001, flatShading: true, roughness: 1 });

function building(o) {
  const grp = new THREE.Group();
  /* low stone foundation stepping with the slope */
  const rad = Math.hypot(o.w, o.d) / 2;
  let hi = -1e9, lo = 1e9;
  for (let a = 0; a < 8; a++) {
    const s = g0(o.x + Math.cos(a * 0.785) * rad, o.z + Math.sin(a * 0.785) * rad);
    hi = Math.max(hi, s); lo = Math.min(lo, s);
  }
  const top = lo + Math.min(hi - lo, 1.6) * 0.6 + 0.14;   // cut into the uphill slope; low exposed face downhill
  grp.position.set(o.x, top, o.z);
  grp.rotation.y = o.ry || 0;
  const fdn = top - lo + 0.5;
  add(grp, new THREE.BoxGeometry(o.w + 1.0, fdn, o.d + 1.0), PALETTE.stone, 0, -fdn / 2 + 0.02, 0);
  add(grp, new THREE.BoxGeometry(o.w + 0.5, 0.3, o.d + 0.5), PALETTE.stone, 0, -0.15, 0); // step slab

  /* walls + slightly darker plinth band (sun-bleached panel variation) */
  add(grp, new THREE.BoxGeometry(o.w, o.h, o.d), o.c, 0, o.h / 2, 0);
  add(grp, new THREE.BoxGeometry(o.w + 0.08, 0.75, o.d + 0.08), o.c2 || o.c, 0, 0.38, 0);
  if (o.wing) {                                                                   // L-shaped footprint
    add(grp, new THREE.BoxGeometry(o.wing.w, o.wing.h, o.wing.d), o.c2 || o.c, o.wing.x, o.wing.h / 2, o.wing.z);
    const wr = new THREE.Mesh(prism(o.wing.w * 1.2, o.wing.h * 0.42, o.wing.d * 1.18), mat(o.rc));
    wr.position.set(o.wing.x, o.wing.h, o.wing.z);
    grp.add(wr);
  }

  /* roof: overhang + eaves fascia + ridge cap, or flat parapet */
  if (o.flat) {
    add(grp, new THREE.BoxGeometry(o.w * 1.08, 0.45, o.d * 1.08), o.rc, 0, o.h + 0.22, 0);
    add(grp, new THREE.BoxGeometry(o.w * 1.1, 0.14, o.d * 1.1), PALETTE.trim, 0, o.h + 0.48, 0); // parapet cap
  } else {
    const rh = o.rh || Math.min(o.h * 0.45, 2.0);
    const roof = new THREE.Mesh(prism(o.w * 1.22, rh, o.d * 1.22), mat(o.rc));
    roof.position.y = o.h;
    grp.add(roof);
    for (const s of [1, -1])                                                      // eaves fascia along the eave lines (ridge runs along z)
      add(grp, new THREE.BoxGeometry(0.18, 0.14, o.d * 1.18), shade(o.rc), s * o.w * 0.59, o.h - 0.05, 0);
    add(grp, new THREE.BoxGeometry(0.3, 0.13, o.d * 1.24), shade(o.rc), 0, o.h + rh - 0.02, 0); // ridge cap along the ridge
  }

  /* door: cream frame + wood door + stone step */
  if (!o.noDoor) {
    add(grp, new THREE.BoxGeometry(1.34, 2.0, 0.12), PALETTE.trim, 0, 1.0, o.d / 2 + 0.03);
    add(grp, new THREE.BoxGeometry(1.0, 1.75, 0.14), 0x7A5A42, 0, 0.87, o.d / 2 + 0.06);
    add(grp, new THREE.BoxGeometry(1.5, 0.22, 0.8), PALETTE.stone, 0, 0.11, o.d / 2 + 0.4);
  }

  /* windows: inset — cream frame proud of wall, glass recessed behind it */
  const rows = o.stories || 1, cols = o.cols || 2, ww = o.winW || 0.95;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = (c - (cols - 1) / 2) * (o.w / (cols + 0.6));
    const wy = 1.55 + r * 2.15;
    for (const s of [1, -1]) {
      if (s === 1 && !o.noDoor && r === 0 && Math.abs(wx) < 1.05) continue;
      add(grp, new THREE.BoxGeometry(ww + 0.24, 1.16, 0.1), PALETTE.trim, wx, wy, s * (o.d / 2 + 0.03));
      add(grp, new THREE.BoxGeometry(ww, 0.92, 0.07), glassMat, wx, wy, s * (o.d / 2 + 0.115)); // solid pane, fully proud of the wall — no coplanar faces
    }
  }
  if (o.sign) add(grp, new THREE.BoxGeometry(Math.min(o.w * 0.55, 4), 0.7, 0.14), o.sign, 0, o.h - 0.35, o.d / 2 + 0.1, 0, 0.4);
  if (o.lines) for (const ly of [o.h * 0.42, o.h * 0.78])
    add(grp, new THREE.BoxGeometry(o.w + 0.08, 0.18, o.d + 0.08), o.lines, 0, ly, 0);
  scene.add(grp);
  if (o.id) buildings[o.id] = grp;
  return grp;
}
/* darker shade of a roof color for fascia/ridge */
function shade(hex) { return ((hex >> 16 & 255) * 0.78 << 16) | ((hex >> 8 & 255) * 0.78 << 8) | (hex & 255) * 0.78; }

/* — Seven buildings along the main street: oldest inland → newest near the shore.
     Varied footprints, heights, pitches, rotations — no two stamped alike — */
/* cottage removed (unassigned) */ // plain cottage — unlabeled town flavor, top terrace
building({ id: 'gobattle',    x: 50.5, z: 3.8, w: 7.5, h: 5.2, d: 5.5, c: PALETTE.charc, c2: PALETTE.charcDk, rc: PALETTE.roofS, ry: -1.62, cols: 3, stories: 2 }); // arcade — top terrace, backed against the cut
building({ id: 'umich',       x: 40.5, z: 12,  w: 6.5, h: 3.6, d: 5,   c: PALETTE.terra, c2: PALETTE.terraDk, rc: PALETTE.roofS, flat: true, winW: 1.5, cols: 3, ry: -1.5 }); // lab — third terrace
building({ id: 'platepromos', x: 36.5, z: 27,  w: 7,   h: 3.6, d: 5.5, c: PALETTE.white, c2: PALETTE.whiteDk, rc: PALETTE.roofT, ry: -1.66, cols: 3,
           wing: { x: -4.2, z: -0.8, w: 3.4, h: 2.8, d: 4 } }); // restaurant — second terrace, beside the stream
/* (micheline pita house removed — unassigned) */
building({ id: 'mirai',       x: 33,   z: 43,  w: 6,   h: 3.4, d: 4.5, c: PALETTE.sage,  c2: PALETTE.sageDk, rc: PALETTE.roofS, flat: true, noDoor: true, cols: 3, ry: -1.6 }); // office — lowest terrace
building({ id: 'stanford',    x: 31,   z: 50.5,w: 7.5, h: 3.4, d: 5.5, c: PALETTE.white, c2: PALETTE.whiteDk, rc: PALETTE.roofS, flat: true, lines: 0xA8B49A, winW: 1.2, ry: -1.48, cols: 3 }); // clinic — sea edgec

/* greenery where the old cottage and pita house stood — no bald terrace patches */
for (const [gx, gz] of [[52, -6.5], [53.2, -4.4], [50.4, -8.4], [37, 34.5], [38.4, 33.0], [35.6, 36.2]]) {
  const s = 0.6 + hash2(gx, gz) * 0.5, gy = g0(gx, gz);
  add(scene, new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 1.1 * s, 5), 0x8A5A3C, gx, gy + 0.55 * s, gz);
  add(scene, new THREE.ConeGeometry(1.35 * s, 2.2 * s, 6), 0x5E8C4A, gx, gy + 1.9 * s, gz);
  add(scene, new THREE.ConeGeometry(0.95 * s, 1.7 * s, 6), 0x7FB069, gx, gy + 3.2 * s, gz);
  for (let i = 0; i < 3; i++)
    add(scene, new THREE.IcosahedronGeometry(0.12, 0), [0xE8543A, 0xF7F0DC, 0xFF9E5E][i], gx + 1.1 - i * 0.7, gy + 0.15, gz + 1.2);
}

/* — identity add-ons + unified hanging-board sign system — */
{
  const B = buildings;
  /* wooden sign board hung on a wall bracket, parallel to the facade — returns the z for symbol meshes */
  const signBoard = (grp, bx, by, zFace, boardHex, w = 1.6, h = 1.15) => {
    for (const s of [-1, 1])
      add(grp, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 4), 0x4A4038, bx + s * (w / 2 - 0.15), by + h / 2 + 0.22, zFace + 0.3);
    add(grp, new THREE.BoxGeometry(w + 0.3, 0.1, 0.14), 0x4A4038, bx, by + h / 2 + 0.46, zFace + 0.12);
    add(grp, new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.09), 0x5C4A38, bx, by, zFace + 0.26);
    add(grp, new THREE.BoxGeometry(w, h, 0.12), boardHex, bx, by, zFace + 0.29);
    return zFace + 0.38;
  };

  /* (top-terrace cottage is plain town flavor — no sign, no glow, not interactable) */

  /* Gobattle — dark marquee board, chunky invader, neon trim, balcony over the terrace below */
  {
    const gz = signBoard(B.gobattle, 0, 4.4, 2.75, 0x241F26, 2.8, 1.5);
    const INV = ['00100100', '00011000', '00111100', '01011010', '11111111', '10111101', '10100101', '00011000'];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (INV[r][c] === '1')
      add(B.gobattle, new THREE.BoxGeometry(0.15, 0.15, 0.08), 0xFF7E5F, (c - 3.5) * 0.16, 4.96 - r * 0.16, gz, 0, 0.5);
    add(B.gobattle, new THREE.BoxGeometry(2.9, 0.09, 0.1), 0xFF7E5F, 0, 5.2, gz - 0.05, 0, 0.6);
    add(B.gobattle, new THREE.BoxGeometry(2.9, 0.09, 0.1), 0xFF7E5F, 0, 3.6, gz - 0.05, 0, 0.6);
    /* balcony */
    add(B.gobattle, new THREE.BoxGeometry(2.6, 0.14, 1.1), 0x8A6A4E, -2.1, 3.02, 3.3);
    for (let i = 0; i <= 6; i++)
      add(B.gobattle, new THREE.BoxGeometry(0.07, 0.72, 0.07), 0x8A6A4E, -3.35 + i * 0.43, 3.42, 3.78);
    add(B.gobattle, new THREE.BoxGeometry(2.6, 0.09, 0.09), 0x6E5540, -2.1, 3.82, 3.78);
  }

  /* U-Mich — chunky gold block M on a navy board, rooftop vent + antenna */
  {
    const mz = signBoard(B.umich, 0, 2.95, 2.5, 0x1F3A5F, 1.7, 1.3);
    add(B.umich, new THREE.BoxGeometry(0.28, 0.95, 0.08), 0xF2C94C, -0.55, 2.95, mz);
    add(B.umich, new THREE.BoxGeometry(0.28, 0.95, 0.08), 0xF2C94C, 0.55, 2.95, mz);
    const d1 = add(B.umich, new THREE.BoxGeometry(0.26, 0.7, 0.08), 0xF2C94C, -0.24, 3.05, mz);
    d1.rotation.z = 0.6;
    const d2 = add(B.umich, new THREE.BoxGeometry(0.26, 0.7, 0.08), 0xF2C94C, 0.24, 3.05, mz);
    d2.rotation.z = -0.6;
    add(B.umich, new THREE.BoxGeometry(1.2, 0.8, 1.0), PALETTE.stone, -1.6, 4.35, 0.6);
    add(B.umich, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), 0x5A5A66, 1.8, 5.2, -0.8);
    add(B.umich, new THREE.SphereGeometry(0.14, 6, 5), 0xC9CDD6, 1.8, 6.5, -0.8);
  }

  /* PlatePromos — plate + fork on a cream board; awning, menu, café tables stay */
  {
    const pz = signBoard(B.platepromos, -1.3, 3.3, 2.75, 0xF2E8D4, 2.0, 1.3);
    const pl = add(B.platepromos, new THREE.CylinderGeometry(0.42, 0.42, 0.07, 12), 0xFFFDF5, -0.85, 3.3, pz);
    pl.rotation.x = Math.PI / 2;
    add(B.platepromos, new THREE.TorusGeometry(0.27, 0.06, 5, 12), 0xE8543A, -0.85, 3.3, pz + 0.05);
    add(B.platepromos, new THREE.BoxGeometry(0.09, 0.62, 0.07), 0xE8543A, -1.85, 3.14, pz);   // fork handle
    for (const fxo of [-0.1, 0, 0.1])
      add(B.platepromos, new THREE.BoxGeometry(0.05, 0.3, 0.07), 0xE8543A, -1.85 + fxo, 3.62, pz);
    for (let i = 0; i < 5; i++)
      add(B.platepromos, new THREE.BoxGeometry(0.56, 0.09, 1.2), (i % 2) ? PALETTE.trim : 0xC96B4A, -1.12 + i * 0.56, 2.28, 3.24).rotation.x = 0.3;
    add(B.platepromos, new THREE.BoxGeometry(2.9, 0.14, 0.14), PALETTE.trim, 0, 2.44, 2.82);
    add(B.platepromos, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), 0x5A5A66, 1.9, 2.5, 2.9);
    add(B.platepromos, new THREE.BoxGeometry(0.7, 0.9, 0.08), PALETTE.trim, 1.9, 1.9, 2.92);
    add(B.platepromos, new THREE.BoxGeometry(0.5, 0.08, 0.06), 0x7A5A42, 1.9, 2.1, 2.97);
    add(B.platepromos, new THREE.BoxGeometry(0.5, 0.08, 0.06), 0x7A5A42, 1.9, 1.9, 2.97);
    for (const [tx, tz] of [[-1.3, 4.3], [1.1, 4.6]]) {
      add(B.platepromos, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 8), PALETTE.trim, tx, 0.72, tz);
      add(B.platepromos, new THREE.CylinderGeometry(0.06, 0.08, 0.7, 5), 0x5A5A66, tx, 0.35, tz);
      add(B.platepromos, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), 0x8A6A4E, tx, 1.5, tz);
      add(B.platepromos, new THREE.ConeGeometry(0.85, 0.5, 8), 0xC96B4A, tx, 2.35, tz);
    }
  }

  /* Micheline's Pita House removed with the decorative buildings */

  /* Mirai — white compass spark on a sage board; glass front stays */
  {
    const mz2 = signBoard(B.mirai, 0, 3.15, 2.25, 0x6E7F63, 1.4, 1.3);
    add(B.mirai, new THREE.OctahedronGeometry(1, 0), 0xF7F0DC, 0, 3.15, mz2).scale.set(0.18, 0.6, 0.045);
    add(B.mirai, new THREE.OctahedronGeometry(1, 0), 0xF7F0DC, 0, 3.15, mz2).scale.set(0.6, 0.18, 0.045);
    add(B.mirai, new THREE.SphereGeometry(0.09, 6, 5), 0xFF7E5F, 0, 3.15, mz2 + 0.05);
    add(B.mirai, new THREE.BoxGeometry(4.6, 2.3, 0.1), glassMat, 0, 1.45, 2.36);   // storefront glass — clear of the wall face (was straddling it: z-fight ghosting)
    for (const mx of [-1.55, 0, 1.55])
      add(B.mirai, new THREE.BoxGeometry(0.1, 2.3, 0.14), PALETTE.trim, mx, 1.45, 2.44);
    add(B.mirai, new THREE.BoxGeometry(4.8, 0.12, 0.14), PALETTE.trim, 0, 2.62, 2.44);
  }

  /* Stanford — medical cross on a white board */
  {
    const stz = signBoard(B.stanford, 0.9, 2.95, 2.75, 0xF7F0DC, 1.3, 1.3);
    add(B.stanford, new THREE.BoxGeometry(0.78, 0.26, 0.08), 0x4E8F6A, 0.9, 2.95, stz);
    add(B.stanford, new THREE.BoxGeometry(0.26, 0.78, 0.08), 0x4E8F6A, 0.9, 2.95, stz);
  }
}

/* — Village watercourse: explicit open course from the top terrace to the sea.
     Spill points sit only in wall sections with no building near; the channel threads
     the gaps ≥2–3 units clear of every footprint (move the water, never the buildings). — */
const VSPILL = [
  { T: TERR[0], a: 2.75 },   // T4 west rim — clear of Kumon + Gobattle
  { T: TERR[1], a: 2.50 },   // T3 southwest rim — clear of U-Mich
  { T: TERR[3], a: 2.95 },   // T1 west rim — clear of Mirai + Stanford, faces the pier
].map(({ T, a }) => {
  const dx = Math.cos(a), dz = Math.sin(a), rw = T.r + 1.6;
  const x = T.x + dx * rw, z = T.z + dz * rw;
  const pool = { x: x + dx * 1.6, z: z + dz * 1.6 };
  return { T, a, x, z, dx, dz, pIn: { x: x - dx * 3.6, z: z - dz * 3.6 }, pool, base: g0(pool.x, pool.z) };
});
const VCREEK_SEGS = [
  [{ x: 42.6, z: -3.4 }, { x: 42.0, z: -1.2 }, VSPILL[0].pIn],
  [VSPILL[0].pool, { x: 34.8, z: 5.8 }, { x: 33.4, z: 8.6 }, { x: 32.4, z: 11.4 }, { x: 31.9, z: 14.2 }, VSPILL[1].pIn],
  [VSPILL[1].pool, { x: 26.3, z: 22.6 }, { x: 25.2, z: 25.4 }, { x: 24.4, z: 28.2 }, { x: 24.1, z: 31.2 },
   { x: 24.4, z: 34.3 }, { x: 24.9, z: 37 }, { x: 24.9, z: 39.8 }, { x: 24.2, z: 42.3 }, { x: 23.2, z: 44.6 },
   { x: 22.5, z: 46.4 }, VSPILL[2].pIn],
];
function nearVCreek(x, z, r) {
  for (const seg of VCREEK_SEGS) for (let i = 0; i < seg.length - 1; i++) {
    const a = seg[i], b = seg[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < r) return true;
  }
  return false;
}

/* — Terraced hardscape: retaining walls, stairways, walkway, stream, bridge — */
{
  const dummy = new THREE.Object3D();
  const blocks = { m: [], t: [] }, caps = { m: [], t: [] }, steps = { m: [], t: [] };
  /* street gates — the walk passes through the wall here (village entrance + shore exit) */
  const GATES = [{ T: TERR[0], x: 41.5, z: -11.5, pillars: true }, { T: TERR[3], x: 21.3, z: 53.9 }];
  const pushBlock = (x, y, z, ry, sy, arr, sx = 1.7, sz = 1.1) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix(); arr.m.push(dummy.matrix.clone());
    arr.t.push(0.9 + 0.2 * hash2(x * 3.7 + y * 1.3, z * 2.9));
  };
  /* (EXPERIMENT: terrace retaining walls removed — the terraces read as bare grass steps.
     Spill chutes, gate pillars and the village stream went with them; v22 has them all.) */
  /* stone stairways between terraces */
  const stairRun = (x0, z0, x1, z1) => {
    const y0 = terrainH(x0, z0), y1 = terrainH(x1, z1);
    const n = Math.max(4, Math.round(Math.abs(y1 - y0) / 0.34));
    const ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      pushBlock(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + 0.1, z0 + (z1 - z0) * f, ry, 0.34, steps, 2.3, 0.95);
    }
  };
  stairRun(43.5, 8.5, 46.5, 3.5);    // T3 → T4
  stairRun(35.2, 19.5, 37.8, 15.2);  // T2 → T3
  stairRun(31.8, 38.5, 32.8, 34.5);  // T1 → T2
  stairRun(25.2, 51.8, 28.2, 49.2);  // shore path → T1
  stairRun(55.8, 0.5, 60.2, 4.4);    // T4 → campus knoll
  const mkInst = (arr, hex) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 1 }), arr.m.length);
    const c = new THREE.Color();
    arr.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, c.setRGB(arr.t[i] * 1.03, arr.t[i], arr.t[i] * 0.94)); });
    scene.add(im);
  };
  mkInst(blocks, 0xC9B189);   // sun-bleached sandstone, per-block variation
  mkInst(caps, 0xDCC9A4);
  mkInst(steps, 0xB8AD98);

  /* flagstone walkway: gate → terrace by terrace → shore exit */
  ribbon([{x:40,z:-16},{x:43,z:-10},{x:45,z:-4},{x:45.5,z:2},{x:44,z:7},{x:42,z:10},{x:39.5,z:13},{x:37.5,z:16},{x:35.2,z:19.5},{x:33.8,z:23},{x:33,z:27},{x:32.6,z:31},{x:32.8,z:34.5},{x:31.8,z:38.5},{x:30,z:40},{x:27.5,z:43},{x:26,z:44.5},{x:24.5,z:47.5},{x:23,z:51},{x:20.5,z:55},{x:19.9,z:55.9}], 2.4, 0xC9BCA0, 0.15, 0.35);

  /* (EXPERIMENT: village stream + bank rocks + spring pool + plunge pools removed with the walls) */
}

/* — Enchanting layer: string lights, stair lamps, flower boxes, ivy, laundry — */
const stringMat = new THREE.MeshStandardMaterial({ color: 0xFFE8B0, emissive: 0xFFC97E, emissiveIntensity: 0.001, flatShading: true, roughness: 1 });
const laundry = [];
{
  const poleAt = (x, z) => {
    const y = g0(x, z);
    add(scene, new THREE.CylinderGeometry(0.06, 0.09, 2.9, 5), 0x4A4038, x, y + 1.45, z);
    add(scene, new THREE.SphereGeometry(0.09, 5, 4), 0x4A4038, x, y + 2.92, z);
    return { x, y: y + 2.82, z };
  };
  const bulbs = [], dummy = new THREE.Object3D();
  const strand = (a, b) => {
    const n = 9;
    for (let i = 1; i < n; i++) {
      const f = i / n, sag = Math.sin(Math.PI * f) * 0.55;
      dummy.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f - sag, a.z + (b.z - a.z) * f);
      dummy.updateMatrix(); bulbs.push(dummy.matrix.clone());
    }
  };
  const p1 = poleAt(44.8, -3.5), p2 = poleAt(45.3, 3.5);
  const p3 = poleAt(40.2, 12.5), p4 = poleAt(36.2, 18.2);
  const p5 = poleAt(33.6, 24.5), p6 = poleAt(32.4, 31);
  const p7 = poleAt(28.8, 41.8), p8 = poleAt(25.6, 46.2), p9 = poleAt(23.6, 50.8);
  strand(p1, p2); strand(p3, p4); strand(p5, p6); strand(p7, p8); strand(p8, p9);
  const bim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 5, 4), stringMat, bulbs.length);
  bulbs.forEach((m, i) => bim.setMatrixAt(i, m));
  scene.add(bim);

  /* wrought-iron lamps along the stairways */
  for (const [lx, lz] of [[42.8, 9.4], [38.6, 14.4], [33.2, 33.6], [30.6, 39.6], [27.4, 48.6]]) {
    const y = g0(lx, lz);
    add(scene, new THREE.CylinderGeometry(0.07, 0.11, 3.0, 6), 0x3A3540, lx, y + 1.5, lz);
    add(scene, new THREE.BoxGeometry(0.32, 0.38, 0.32), lampMat, lx, y + 3.12, lz);
    add(scene, new THREE.ConeGeometry(0.3, 0.28, 4), 0x3A3540, lx, y + 3.45, lz, Math.PI / 4);
  }

  /* flower boxes under front windows */
  const flowers = (grp, fx, fy, fz) => {
    add(grp, new THREE.BoxGeometry(1.1, 0.26, 0.3), 0x7A5A42, fx, fy, fz + 0.18);
    for (let i = 0; i < 4; i++)
      add(grp, new THREE.IcosahedronGeometry(0.11, 0), [0xE8543A, 0xF7F0DC, 0xFF9E5E, 0xE8788A][i % 4], fx - 0.4 + i * 0.27, fy + 0.19, fz + 0.2);
  };
  flowers(buildings.platepromos, -1.94, 0.95, 2.75); flowers(buildings.platepromos, 1.94, 0.95, 2.75);
  flowers(buildings.umich, -1.8, 0.95, 2.5); flowers(buildings.umich, 1.8, 0.95, 2.5);

  /* ivy clumps draping corners and terrace edges */
  for (const [ix, iz, s] of [[50.1, -8.4, 1.1], [48.2, 6.4, 1.3], [38.3, 14.3, 1.0], [34.1, 29.4, 1.2], [35.1, 36.4, 0.9], [28.5, 52.7, 1.1], [44.9, 6.9, 0.9], [30.9, 36.9, 1.0]]) {
    const y = g0(ix, iz);
    add(scene, new THREE.IcosahedronGeometry(0.8, 0), 0x4E7A4A, ix, y + 0.42, iz).scale.set(s, 0.55 * s, s);
    add(scene, new THREE.IcosahedronGeometry(0.55, 0), 0x5E8C4A, ix + 0.5 * s, y + 0.28, iz + 0.35).scale.set(1, 0.6, 1);
  }

  /* one laundry line between the restaurant and the pita house */
  {
    const ax = 37.6, az = 29.9, bx = 37.2, bz = 32.6;
    const ya = g0(ax, az) + 2.6, yb = g0(bx, bz) + 2.5;
    const mid = new THREE.Vector3((ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2);
    const len = Math.hypot(bx - ax, yb - ya, bz - az);
    const line = add(scene, new THREE.CylinderGeometry(0.02, 0.02, len, 4), 0xD9CDB8, mid.x, mid.y, mid.z);
    line.lookAt(bx, yb, bz); line.rotateX(Math.PI / 2);
    const clothCols = [0xF7F0DC, 0xA8C4D4, 0xE8B4A0];
    for (let i = 1; i <= 3; i++) {
      const f = i / 4;
      const geo = new THREE.PlaneGeometry(0.5, 0.6);
      geo.translate(0, -0.3, 0);
      const cl = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: clothCols[i - 1], flatShading: true, roughness: 1, side: THREE.DoubleSide }));
      cl.position.set(ax + (bx - ax) * f, ya + (yb - ya) * f - 0.05, az + (bz - az) * f);
      cl.rotation.y = Math.PI / 2 + 0.3;
      cl.userData.ph = i * 2.1;
      scene.add(cl);
      laundry.push(cl);
    }
  }
}

/* — UC Berkeley: campanile clock tower + hall on the hill above town — */

/* chimneys → smoke sources (with pots) */
const smokeEmitPts = [];
function chimney(grp, lx, ly, lz) {
  add(grp, new THREE.BoxGeometry(0.7, 1.6, 0.7), 0x9A8578, lx, ly, lz);
  add(grp, new THREE.BoxGeometry(0.82, 0.18, 0.82), shade(0x9A8578), lx, ly + 0.85, lz);
  add(grp, new THREE.CylinderGeometry(0.12, 0.14, 0.34, 6), 0x8A7568, lx - 0.16, ly + 1.05, lz);
  add(grp, new THREE.CylinderGeometry(0.12, 0.14, 0.34, 6), 0x8A7568, lx + 0.16, ly + 1.05, lz);
  grp.updateMatrixWorld(true);
  smokeEmitPts.push(grp.localToWorld(new THREE.Vector3(lx, ly + 1.25, lz)));
}
/* placeholder-chimneys-marker */
chimney(buildings.platepromos, -1.9, 4.5, -0.8);
for (const id of ['gobattle', 'umich', 'platepromos', 'mirai', 'stanford']) registerGlow(buildings[id], 3, false, id);

/* — UC Berkeley: campanile clock tower + hall on the hill above town — */
{
  const hall = building({ x: 71, z: 10, w: 9, h: 3.8, d: 6, c: PALETTE.white, c2: PALETTE.whiteDk, rc: PALETTE.roofT, ry: -1.55, cols: 4 });
  const tower = new THREE.Group();
  tower.position.set(66, dirtPad(66, 15, 2.6), 15);
  add(tower, new THREE.BoxGeometry(2.6, 15, 2.6), 0xEDE8DA, 0, 7.5, 0);                     // shaft (campanile proportions)
  for (const s of [-1, 1]) {                                                                 // corner pilasters
    add(tower, new THREE.BoxGeometry(0.34, 15, 0.34), 0xDFD8C6, s * 1.24, 7.5, 1.24);
    add(tower, new THREE.BoxGeometry(0.34, 15, 0.34), 0xDFD8C6, s * 1.24, 7.5, -1.24);
  }
  add(tower, new THREE.BoxGeometry(3.1, 0.4, 3.1), PALETTE.trim, 0, 13.1, 0);               // belfry cornice
  for (const [ox, oz, ry] of [[0, 1.32, 0], [0, -1.32, 0], [1.32, 0, Math.PI / 2], [-1.32, 0, Math.PI / 2]])
    add(tower, new THREE.BoxGeometry(1.1, 1.7, 0.14), 0x3A3A42, ox, 14.2, oz, ry);          // belfry openings, all 4 faces
  add(tower, new THREE.SphereGeometry(0.3, 6, 5), 0xE8C15A, 0, 14.0, 0.9);                  // bell
  for (const cz of [1.34, -1.34]) {                                                          // clock faces
    add(tower, new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12), PALETTE.trim, 0, 11.6, cz).rotation.x = Math.PI / 2;
    add(tower, new THREE.BoxGeometry(0.07, 0.4, 0.04), 0x3A3A42, 0, 11.7, cz + Math.sign(cz) * 0.07);
    add(tower, new THREE.BoxGeometry(0.28, 0.07, 0.04), 0x3A3A42, 0.1, 11.6, cz + Math.sign(cz) * 0.07);
  }
  add(tower, new THREE.BoxGeometry(3.3, 0.35, 3.3), PALETTE.trim, 0, 15.2, 0);              // top cornice
  add(tower, new THREE.ConeGeometry(2.05, 2.4, 4), 0xB04A3A, 0, 16.5, 0, Math.PI / 4);      // pyramidal cap
  add(tower, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4), 0x8A7568, 0, 18.1, 0);         // finial
  scene.add(tower);
  buildings.berkeley = tower;
  registerGlow(tower, 3, false, 'berkeley');
  registerGlow(hall, 3, false, 'berkeley-hall');
}

/* — Campsite (fire lit — a warm, lived-in camp) — */
const campsite = new THREE.Group();
{
  campsite.position.set(46, 0, -120);
  const at = (x, z) => g0(46 + x, -120 + z);

  /* props in a loose circle around the campfire at local (1,-1) — all separated, upright, clamped */
  const tentG = new THREE.Group();
  tentG.position.set(-5.6, at(-5.6, 2.3), 2.3);
  tentG.rotation.y = 2.03;                                                                          // door faces the fire
  add(tentG, new THREE.ConeGeometry(3.0, 3.2, 4), 0xF2E4C8, 0, 1.55, 0, Math.PI / 4);               // tent
  add(tentG, new THREE.BoxGeometry(0.9, 1.3, 0.08), 0x8A6A4E, 0, 0.65, 1.62);                       // tent door
  campsite.add(tentG);

  /* rock + surfboard leaning upright against it — bright coral, cream stripe */
  add(campsite, new THREE.DodecahedronGeometry(1.4, 0), 0xA89B85, 3.64, at(3.64, 2.77) + 0.9, 2.77);
  const surf = new THREE.Group();
  surf.position.set(3.05, at(3.05, 3.5) + 0.1, 3.5);
  surf.scale.setScalar(1.18);
  const deck = add(surf, new THREE.CapsuleGeometry(0.62, 2.6, 2, 7), 0xFF6B3D, 0, 1.9, 0);
  deck.scale.set(1, 1, 0.16);
  add(surf, new THREE.CapsuleGeometry(0.5, 2.3, 2, 7), 0xFFF4E0, 0, 1.9, 0.07).scale.set(0.75, 0.95, 0.1); // deck stripe
  add(surf, new THREE.CapsuleGeometry(0.5, 2.3, 2, 7), 0xFFF4E0, 0, 1.9, -0.07).scale.set(0.75, 0.95, 0.1); // …both faces
  const fin = add(surf, new THREE.ConeGeometry(0.3, 0.55, 4), 0xE8593A, 0.02, 0.42, -0.24);
  fin.rotation.x = -2.2;                                                                            // fin juts out near the tail
  surf.rotation.set(0, 0.9, -0.18);                                                                 // stands nearly upright on the rock
  campsite.add(surf);

  /* campfire — lit: ring, charred base, animated flames, ember glow */
  const fy = at(1, -1);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    add(campsite, new THREE.DodecahedronGeometry(0.36, 0), 0x8C8478, Math.cos(a) * 1.15 + 1, fy + 0.26, Math.sin(a) * 1.15 - 1);
  }
  add(campsite, new THREE.CylinderGeometry(0.2, 0.2, 1.8, 5), 0x4A3428, 0.8, fy + 0.38, -1).rotation.z = 1.4;
  add(campsite, new THREE.CylinderGeometry(0.2, 0.2, 1.8, 5), 0x4A3428, 1.2, fy + 0.38, -1).rotation.set(1.5, 0.5, 0);
  add(campsite, new THREE.CylinderGeometry(0.55, 0.68, 0.14, 8), 0x2E241C, 1, fy + 0.2, -1);        // charred bed
  campFire = { flames: [], light: new THREE.PointLight(0xFF9E5E, 1.2, 16, 2) };
  campFire.light.position.set(47, fy + 1.2, -121);
  scene.add(campFire.light);
  for (const [col, em, r, h, fx, fz, ph] of [
    [0xFF7A3C, 0.85, 0.4, 0.95, 1, -1, 0], [0xFFB25E, 1.0, 0.26, 0.7, 0.82, -0.88, 2.1],
    [0xFFE0A0, 1.2, 0.15, 0.48, 1.14, -1.1, 4.4],
  ]) {
    const m = add(campsite, new THREE.ConeGeometry(r, h, 5), col, fx, fy + 0.32 + h / 2, fz, 0, em);
    campFire.flames.push({ m, ph });
  }
  for (const [ex, ez] of [[0.6, -1.3], [1.35, -0.65], [1.1, -1.45]])                                // embers
    add(campsite, new THREE.DodecahedronGeometry(0.11, 0), 0xFF5E2E, ex, fy + 0.3, ez, 0, 0.9);
  smokeEmitPts.push(new THREE.Vector3(47, fy + 1.4, -121));

  /* soccer ball: white sphere with black pentagon patches */
  const ball = new THREE.Group();
  ball.position.set(-2.2, at(-2.2, -2.9) + 0.64, -2.9);
  add(ball, new THREE.SphereGeometry(0.62, 10, 8), 0xF5F2EA, 0, 0, 0);
  {
    const zAxis = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3();
    for (const [px, py, pz] of [[0.6, 0.55, 0.4], [-0.5, 0.7, -0.35], [0.15, -0.3, 0.85], [-0.75, -0.25, 0.5], [0.55, 0.2, -0.75], [-0.2, 0.9, 0.3], [0.05, -0.85, -0.4], [-0.8, 0.15, -0.45]]) {
      dir.set(px, py, pz).normalize();
      const patch = add(ball, new THREE.CircleGeometry(0.2, 5), 0x1E1E26, dir.x * 0.615, dir.y * 0.615, dir.z * 0.615);
      patch.quaternion.setFromUnitVectors(zAxis, dir);
    }
  }
  campsite.add(ball);

  /* trophy display: wooden stand, gold cup with handles (big) + silver star trophy (small) */
  const troph = new THREE.Group();
  troph.position.set(5.98, at(5.98, -0.56), -0.56);
  troph.rotation.y = -1.66;                                                                         // faces the fire
  add(troph, new THREE.BoxGeometry(2.1, 0.18, 1.0), 0x8A6A4E, 0, 0.55, 0);                          // stand top
  add(troph, new THREE.BoxGeometry(0.22, 0.55, 0.8), 0x6B4A3A, -0.8, 0.28, 0);                      // legs
  add(troph, new THREE.BoxGeometry(0.22, 0.55, 0.8), 0x6B4A3A, 0.8, 0.28, 0);
  const cup = new THREE.Group(); cup.position.set(-0.42, 0.64, 0);                                  // gold cup
  add(cup, new THREE.BoxGeometry(0.5, 0.12, 0.5), 0x8A6A4E, 0, 0.06, 0, 0.4);                       // plinth
  add(cup, new THREE.CylinderGeometry(0.09, 0.2, 0.3, 7), 0xE8C15A, 0, 0.3, 0);                     // stem
  add(cup, new THREE.CylinderGeometry(0.34, 0.14, 0.5, 8), 0xE8C15A, 0, 0.68, 0);                   // bowl
  const hL = add(cup, new THREE.TorusGeometry(0.17, 0.045, 5, 8, Math.PI * 1.2), 0xE8C15A, -0.36, 0.72, 0);
  hL.rotation.z = 0.5;
  const hR = add(cup, new THREE.TorusGeometry(0.17, 0.045, 5, 8, Math.PI * 1.2), 0xE8C15A, 0.36, 0.72, 0);
  hR.rotation.z = Math.PI - 0.5;
  troph.add(cup);
  const star = new THREE.Group(); star.position.set(0.5, 0.64, 0);                                  // silver star trophy
  add(star, new THREE.BoxGeometry(0.38, 0.1, 0.38), 0x5A5A66, 0, 0.05, 0, 0.4);
  add(star, new THREE.CylinderGeometry(0.05, 0.09, 0.42, 6), 0xC9CDD6, 0, 0.31, 0);
  const st = add(star, new THREE.OctahedronGeometry(0.24, 0), 0xC9CDD6, 0, 0.66, 0);
  st.scale.set(1, 1.25, 0.4); st.rotation.y = 0.3;                                                  // flattened = star-ish glint
  troph.add(star);
  campsite.add(troph);

  /* bench-press station: flat bench + barbell on stands with plates */
  const bench = new THREE.Group();
  /* bench-press station: low flat bench, two uprights, straight barbell + plates */
  bench.position.set(-1.9, at(-1.9, 4.8), 4.8);
  bench.rotation.y = 2.6;
  add(bench, new THREE.BoxGeometry(0.62, 0.14, 2.0), 0x2E2E36, 0, 0.66, -0.1);                      // flat pad
  add(bench, new THREE.BoxGeometry(0.5, 0.62, 0.14), 0x9A9AA5, 0, 0.31, -0.95);                     // legs
  add(bench, new THREE.BoxGeometry(0.5, 0.62, 0.14), 0x9A9AA5, 0, 0.31, 0.72);
  add(bench, new THREE.BoxGeometry(0.14, 1.52, 0.14), 0x9A9AA5, -0.98, 0.76, 0.85);                 // uprights
  add(bench, new THREE.BoxGeometry(0.14, 1.52, 0.14), 0x9A9AA5, 0.98, 0.76, 0.85);
  add(bench, new THREE.CylinderGeometry(0.045, 0.045, 3.3, 6), 0xC9CDD6, 0, 1.55, 0.85).rotation.z = Math.PI / 2; // barbell
  for (const s of [-1, 1]) {                                                                        // two dark plates per side
    add(bench, new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), 0x22222A, s * 1.22, 1.55, 0.85).rotation.z = Math.PI / 2;
    add(bench, new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), 0x33333D, s * 1.4, 1.55, 0.85).rotation.z = Math.PI / 2;
  }
  campsite.add(bench);

  /* running shoes: proper silhouettes — toe box, heel wedge, sole line, lace bands */
  const shoes = new THREE.Group();
  shoes.position.set(4.41, at(4.41, -4.66), -4.66);
  shoes.rotation.y = 2.5;                                                                   // toes angled toward the camera path
  const shoe = (body, lace) => {
    const s = new THREE.Group();
    add(s, new THREE.BoxGeometry(0.42, 0.12, 1.16), 0xEDE6D4, 0, 0.06, 0);                  // sole
    add(s, new THREE.BoxGeometry(0.44, 0.05, 1.18), 0xC9BEA4, 0, 0.13, 0);                  // sole line
    add(s, new THREE.BoxGeometry(0.4, 0.34, 0.6), body, 0, 0.32, -0.2);                     // body / heel counter
    add(s, new THREE.BoxGeometry(0.4, 0.14, 0.36), body, 0, 0.1, -0.38);                    // heel wedge
    const toe = add(s, new THREE.BoxGeometry(0.38, 0.2, 0.52), body, 0, 0.23, 0.3);         // toe box
    toe.rotation.x = 0.14;                                                                  // slopes down to the toe
    for (let i = 0; i < 3; i++) {                                                           // lace bands
      const lb = add(s, new THREE.BoxGeometry(0.34, 0.045, 0.08), lace, 0, 0.45 - i * 0.075, 0.02 + i * 0.13);
      lb.rotation.x = 0.42;
    }
    return s;
  };
  const shoeA = shoe(0xFF7E5F, 0xFFF4E0);                                                   // upright
  shoeA.position.set(-0.32, 0, 0.05);
  shoeA.rotation.y = 0.35;
  shoes.add(shoeA);
  const shoeB = shoe(0x8FA3B0, 0xFFF4E0);                                                   // tipped on its side
  shoeB.position.set(0.42, 0.22, -0.18);
  shoeB.rotation.set(0, -0.9, 1.42);
  shoes.add(shoeB);
  campsite.add(shoes);

  /* red Chinese lantern hanging from a post */
  const lant = new THREE.Group();
  lant.position.set(-3.53, at(-3.53, -1.8), -1.8);
  lant.rotation.y = -0.17;                                                                          // arm reaches toward the fire
  add(lant, new THREE.CylinderGeometry(0.09, 0.12, 2.6, 6), 0x6B4A3A, 0, 1.3, 0);                   // post
  add(lant, new THREE.CylinderGeometry(0.07, 0.07, 1.0, 5), 0x6B4A3A, 0.45, 2.5, 0).rotation.z = Math.PI / 2; // arm
  const lantHang = new THREE.Group();
  lantHang.position.set(0.85, 1.85, 0);
  add(lantHang, new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), 0x3A3A42, 0, 0.43, 0);            // string
  const lb = add(lantHang, new THREE.SphereGeometry(0.42, 8, 6), 0xC93B2E, 0, 0, 0);                // lantern body
  lb.scale.set(1, 0.82, 1);
  add(lantHang, new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), 0xE8C15A, 0, 0.33, 0);              // gold caps
  add(lantHang, new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), 0xE8C15A, 0, -0.33, 0);
  add(lantHang, new THREE.CylinderGeometry(0.05, 0.02, 0.35, 4), 0xE8C15A, 0, -0.55, 0);            // tassel
  lant.add(lantHang);
  campsite.add(lant);

  registerGlow(tentG, 1, false, 'campsite', { noShell: true, noMarker: true }); registerGlow(surf, 1, false, 'surf'); registerGlow(bench, 1, false, 'bench');
  registerGlow(ball, 1, true, 'ball'); registerGlow(cup, 1, true, 'cupGold'); registerGlow(star, 1, true, 'cupSilver');
  registerGlow(lantHang, 1, true, 'lantern'); registerGlow(shoes, 1, true, 'shoes');

  scene.add(campsite);
}

/* — Welcome signpost on the bluff (hero left foreground) — */
{
  const textTex = (text, w, fs) => {
    const c = document.createElement('canvas'); c.width = w; c.height = 160;
    const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#43301F';
    do { x.font = `bold ${fs}px 'Comic Sans MS','Chalkboard SE','Segoe Print',cursive`; fs -= 4; }
    while (x.measureText(text).width > w - 44);
    x.save(); x.translate(w / 2, 84); x.rotate(-0.015); x.fillText(text, 0, 0); x.restore();
    return new THREE.CanvasTexture(c);
  };
  const sp = new THREE.Group();
  sp.position.set(114.2, g0(114.2, -195.5), -195.5);
  sp.rotation.y = 3.05;                                                                  // angled toward the hero camera
  sp.scale.setScalar(1.5);
  add(sp, new THREE.CylinderGeometry(0.18, 0.26, 5.6, 6), 0x8A6A4E, 0, 2.8, 0);          // post
  const plank = (txt, y, rz, wln) => {
    const p = new THREE.Group(); p.position.set(0, y, 0.16); p.rotation.z = rz;
    add(p, new THREE.BoxGeometry(wln, 1.05, 0.14), 0xB08050, 0, 0, 0);
    add(p, new THREE.BoxGeometry(wln + 0.18, 0.13, 0.15), 0x9A6E40, 0, -0.52, 0);        // weathered lower edge
    const face = new THREE.Mesh(new THREE.PlaneGeometry(wln - 0.2, 0.95),
      new THREE.MeshBasicMaterial({ map: textTex(txt, 640, 96), transparent: true }));
    face.position.set(0, 0, 0.09);
    p.add(face);
    sp.add(p);
  };
  plank('Welcome to', 4.65, 0.05, 3.7);
  plank("Gary's website", 3.45, -0.04, 4.7);
  /* small arrow plank pointing down the trail */
  const ar = new THREE.Group(); ar.position.set(-0.15, 2.35, 0.16); ar.rotation.z = -0.45;
  add(ar, new THREE.BoxGeometry(1.8, 0.6, 0.12), 0x9A6E40, 0, 0, 0);
  const ac = document.createElement('canvas'); ac.width = 256; ac.height = 84;
  const g2 = ac.getContext('2d');
  g2.strokeStyle = '#43301F'; g2.lineWidth = 13; g2.lineCap = 'round'; g2.lineJoin = 'round';
  g2.beginPath(); g2.moveTo(44, 42); g2.lineTo(192, 42); g2.stroke();
  g2.beginPath(); g2.moveTo(158, 14); g2.lineTo(196, 42); g2.lineTo(158, 70); g2.stroke();
  const af = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ac), transparent: true }));
  af.position.set(0, 0, 0.08);
  ar.add(af);
  sp.add(ar);
  scene.add(sp);
}

/* — Hero hillside dressing: trail from the sign, wildflower drifts, grazing sheep — */
const sheep = [], deer = [], clouds = [];
let balloon = null;
{
  /* thin dirt trail: sign → valley → campsite direction (follows the camera corridor) */
  ribbon([{x:112,z:-203},{x:104,z:-196},{x:95,z:-192},{x:86,z:-186},{x:76,z:-174},{x:67,z:-160},{x:59,z:-144},{x:53,z:-130}], 1.5, 0xC0A375, 0.12);

  /* wildflower drifts — low, calm, clustered */
  const drifts = [
    { x: 96, z: -196, r: 9 }, { x: 82, z: -180, r: 11 }, { x: 100, z: -178, r: 8 },
    { x: 70, z: -190, r: 10 }, { x: 62, z: -168, r: 8 }, { x: 88, z: -206, r: 7 },
    { x: 74, z: -206, r: 9 }, { x: 58, z: -186, r: 9 }, { x: 50, z: -158, r: 8 },
    { x: 46, z: -196, r: 9 }, { x: 38, z: -178, r: 8 }, { x: 42, z: -212, r: 7 }, { x: 31, z: -192, r: 8 },
    { x: 22, z: -204, r: 8 }, { x: 14, z: -180, r: 9 }, { x: 4,  z: -190, r: 7 }, { x: 28, z: -160, r: 8 },
    { x: 118, z: -125, r: 10 }, { x: 136, z: -34, r: 9 }, { x: 124, z: 22, r: 9 }, { x: 108, z: -155, r: 9 },
    { x: 142, z: 78, r: 9 }, { x: 160, z: -110, r: 10 },
  ];
  const cols = [0xF7F4EC, 0xF2D06B, 0xFF9E80];
  const spots = [[], [], []];
  drifts.forEach((d, di) => {
    for (let i = 0; i < 26; i++) {
      const a = hash2(d.x + i * 11.3, d.z + i * 5.9) * Math.PI * 2;
      const rr = Math.sqrt(hash2(i * 2.7 + d.z, d.x + i * 6.1)) * d.r;
      const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
      const h = terrainH(x, z);
      if (h < 2.5) continue;
      spots[(di + i) % 3].push({ x, y: h, z, s: 0.55 + hash2(x, z) * 0.5 });
    }
  });
  const dummy = new THREE.Object3D();
  spots.forEach((list, ci) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), matSway(cols[ci], 0.05, 1.3), list.length);
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.34 * p.s, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(0, hash2(p.z, p.x) * Math.PI, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    scene.add(im);
  });

  /* exposed rock outcrops — low, part-buried, calm */
  for (const [ox, oz, os] of [[86, -214, 2.2], [76, -199, 1.6], [95, -222, 2.6], [66, -182, 1.8], [56, -166, 1.5], [104, -208, 1.9], [20, -212, 2.0], [8, -174, 1.7], [30, -168, 1.5], [-2, -206, 1.8], [132, -92, 2.3], [154, -44, 2.5], [126, 60, 2.0], [166, -132, 2.7], [140, 10, 1.8]]) {
    const y = g0(ox, oz);
    for (let i = 0; i < 3; i++) {
      const m = add(scene, new THREE.DodecahedronGeometry(1, 0), i ? 0x9A9284 : 0xA39A87,
        ox + (hash2(ox + i, oz) - 0.5) * os * 1.6, y + os * 0.12, oz + (hash2(oz, ox + i * 3) - 0.5) * os * 1.6);
      const s = os * (0.5 + hash2(i + ox, i + oz) * 0.6);
      m.scale.set(s, s * 0.45, s * 0.8);
      m.rotation.y = hash2(ox * i, oz) * Math.PI;
    }
  }

  /* grazing sheep — slow wander, head-down nibbles */
  for (const [sx, sz, ph] of [[90, -188, 0], [85, -183, 2.1], [93, -181, 4.4], [74, -178, 5.6], [25, -184, 1.3], [29, -188, 4.9], [18, -196, 3.2], [122, -66, 0.7], [126, -61, 3.3], [119, -72, 5.4]]) {
    const s = new THREE.Group();
    const body = add(s, new THREE.IcosahedronGeometry(0.62, 0), 0xF2EEE2, 0, 0.62, 0);
    body.scale.set(1.25, 0.95, 0.9);
    const head = add(s, new THREE.BoxGeometry(0.34, 0.34, 0.44), 0x4A4038, 0.82, 0.62, 0);
    add(s, new THREE.BoxGeometry(0.3, 0.26, 0.3), 0xF2EEE2, 0.62, 0.82, 0);               // wool cap
    for (const [lx, lz] of [[-0.36, -0.22], [-0.36, 0.22], [0.38, -0.22], [0.38, 0.22]])
      add(s, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5), 0x4A4038, lx, 0.25, lz);
    s.position.set(sx, g0(sx, sz), sz);
    s.rotation.y = ph;
    scene.add(s);
    sheep.push({ s, head, x0: sx, z0: sz, ph });
  }

  /* two deer at the forest edge — mostly still, occasional head-lift, tiny wander */
  for (const [dx, dz, ph] of [[56, -152, 0.8], [61.5, -157.5, 3.6], [134, -110, 2.2], [148, -142, 5.1]]) {
    const g = new THREE.Group();
    const body = add(g, new THREE.BoxGeometry(1.15, 0.6, 0.5), 0xB98A62, 0, 0.8, 0);
    add(g, new THREE.BoxGeometry(0.18, 0.2, 0.2), 0xF2EEE2, -0.64, 0.9, 0);                 // tail patch
    for (const [lx, lz] of [[-0.4, -0.16], [-0.4, 0.16], [0.42, -0.16], [0.42, 0.16]])
      add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.62, 5), 0x8A6A4E, lx, 0.31, lz);
    const head = new THREE.Group();
    head.position.set(0.52, 0.98, 0);
    add(head, new THREE.CylinderGeometry(0.08, 0.11, 0.6, 5), 0xB98A62, 0.14, 0.24, 0).rotation.z = -0.45; // neck
    add(head, new THREE.BoxGeometry(0.4, 0.22, 0.2), 0xA87850, 0.34, 0.5, 0);               // head
    for (const s of [-1, 1]) {                                                               // small antlers
      const an = add(head, new THREE.BoxGeometry(0.04, 0.3, 0.04), 0x8A6A4E, 0.26, 0.72, s * 0.08);
      an.rotation.set(s * 0.35, 0, 0.25);
      add(head, new THREE.BoxGeometry(0.03, 0.14, 0.03), 0x8A6A4E, 0.31, 0.78, s * 0.13).rotation.set(s * 0.5, 0, 0.9);
    }
    g.add(head);
    clampTo(g, dx, dz);
    g.rotation.y = ph;
    scene.add(g);
    deer.push({ g, head, x0: dx, z0: dz, ph });
  }
}

/* — Sky life: drifting low-poly clouds + a far hot-air balloon — */
{
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xF7F5EE, emissive: 0xFFF6E8, emissiveIntensity: 0.32, flatShading: true, roughness: 1 });
  const defs = [
    { x: -40, y: 68, z: -40,  s: 1.5, sp: 0.55, range: 130 }, { x: 100, y: 86, z: -150, s: 1.8, sp: 0.4,  range: 110 },
    { x: 130, y: 78, z: -90,  s: 1.2, sp: 0.6,  range: 90  }, { x: -10, y: 88, z: 120,  s: 1.7, sp: 0.35, range: 120 },
    { x: 90,  y: 74, z: 40,   s: 1.3, sp: 0.5,  range: 100 }, { x: -70, y: 66, z: 60,   s: 1.1, sp: 0.65, range: 90  },
    { x: -40, y: 80, z: -5,   s: 1.6, sp: 0.42, range: 120 }, { x: -90, y: 70, z: -120, s: 1.4, sp: 0.5,  range: 100 },
    { x: 60,  y: 92, z: 150,  s: 1.5, sp: 0.38, range: 110 },
  ];
  for (const d of defs) {
    const g = new THREE.Group();
    for (const [ox, oy, oz, ls] of [[0, 0, 0, 1], [3.4, 0.5, 0.8, 0.72], [-3.2, 0.3, -0.6, 0.66], [1.2, 1.3, -1.1, 0.55]]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0), cloudMat);
      m.position.set(ox * d.s, oy * d.s, oz * d.s);
      m.scale.set(1.6 * ls * d.s, 0.55 * ls * d.s, 1.05 * ls * d.s);
      m.rotation.y = hash2(d.x + ox, d.z + oz) * Math.PI;
      g.add(m);
    }
    g.position.set(d.x, d.y, d.z);
    scene.add(g);
    clouds.push({ g, x0: d.x, sp: d.sp, range: d.range, off: hash2(d.x, d.z) * 200 });
  }

  /* hot-air balloon over the far inland valley — background scenery */
  const b = new THREE.Group();
  const canopy = add(b, new THREE.SphereGeometry(3, 9, 7), 0xE08A5A, 0, 7.4, 0);
  canopy.scale.set(1, 1.12, 1);
  add(b, new THREE.TorusGeometry(2.92, 0.3, 5, 12), 0xF5EDD8, 0, 7.6, 0).rotation.x = Math.PI / 2;   // stripes
  add(b, new THREE.TorusGeometry(2.35, 0.26, 5, 12), 0xF5EDD8, 0, 5.8, 0).rotation.x = Math.PI / 2;
  add(b, new THREE.CylinderGeometry(1.1, 2.2, 1.2, 8), 0xC9764C, 0, 4.3, 0);                          // throat
  add(b, new THREE.BoxGeometry(1.1, 0.85, 1.1), 0x8A6A4E, 0, 1.2, 0);                                 // basket
  for (const [rx, rz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]])
    add(b, new THREE.CylinderGeometry(0.025, 0.025, 2.6, 3), 0x6E5540, rx, 2.85, rz);
  /* basket rim + a small hanging lantern — the ride's diegetic cockpit (visible at frame edges when aboard) */
  for (const [ox, oz, w, d] of [[0, -0.57, 1.26, 0.1], [0, 0.57, 1.26, 0.1], [-0.57, 0, 0.1, 1.26], [0.57, 0, 0.1, 1.26]])
    add(b, new THREE.BoxGeometry(w, 0.12, d), 0x6E5540, ox, 1.68, oz);
  add(b, new THREE.CylinderGeometry(0.022, 0.022, 0.42, 3), 0x4A3A2C, -0.34, 2.6, 0.42);   // lantern cord
  add(b, new THREE.BoxGeometry(0.15, 0.19, 0.15), lampMat, -0.34, 2.3, 0.42);              // little lantern, front-left of the eye
  add(b, new THREE.ConeGeometry(0.13, 0.1, 4), 0x3A3540, -0.34, 2.44, 0.42, Math.PI / 4);  // lantern cap
  /* burner: small flame under the throat + a warm light — flares every ~6.4s so the balloon reads alive (and boardable) from across the valley */
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xFFC97E, emissive: 0xFF9E4A, emissiveIntensity: 0.15, flatShading: true, roughness: 1, transparent: true, opacity: 0.25 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 5), flameMat);
  flame.position.set(0, 3.62, 0);
  b.add(flame);
  const burnerLight = new THREE.PointLight(0xFFB066, 0, 17, 1.8);
  burnerLight.position.set(0, 3.95, 0);
  b.add(burnerLight);
  const bx = 98, bz = -88, by = g0(98, -88) + 27;
  b.position.set(bx, by, bz);
  scene.add(b);
  balloon = { g: b, x0: bx, y0: by, z0: bz, flame, flameMat, burnerLight };
}

/* — Sea life: RARE scheduled events, one at a time — a far-offshore porpoising pod (~every 30–45s)
   and a distant humpback spout + back-and-fluke roll (~every 75–105s). Never during a content dwell.
   Keyframed transforms on shared geometry; the only added material is the white splash sprite. — */
const seaLife = { pod: [], podSplash: [], whale: null, evt: null, next: 14 + Math.random() * 10, lastWhale: -1e9, forceKind: null };
const POD_ZONES = [
  { x: -60, z: 95, hd: 3.4 },    /* mid-bay — small from the hero and harbor transits */
  { x: -75, z: 148, hd: -0.6 },  /* outer harbor water — finale + farewell approach */
  { x: -50, z: 45, hd: 2.0 },    /* south bay — hero + village sea-gate glimpses */
];
{
  const dCol = 0x7A9DB0;
  const bodyG = new THREE.SphereGeometry(1, 7, 5), dorsG = new THREE.ConeGeometry(0.17, 0.5, 4),
        flukG = new THREE.ConeGeometry(0.34, 0.55, 3), splashG = new THREE.CircleGeometry(0.9, 8);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.rotation.order = 'YZX';
    const body = add(g, bodyG, dCol, 0, 0, 0);
    body.scale.set(1.6, 0.4, 0.36);
    add(g, dorsG, dCol, -0.1, 0.46, 0).rotation.z = 0.45;
    const fluke = add(g, flukG, dCol, -1.68, 0.04, 0);
    fluke.rotation.z = Math.PI / 2 + 0.25; fluke.scale.z = 0.45;
    const splash = new THREE.Mesh(splashG, new THREE.MeshBasicMaterial({ color: 0xF0F7F5, transparent: true, opacity: 0, depthWrite: false }));
    splash.rotation.x = -Math.PI / 2; splash.visible = false;
    g.position.y = -1.6; g.visible = false;
    scene.add(splash); scene.add(g);
    seaLife.pod.push(g); seaLife.podSplash.push(splash);
  }
  const w = new THREE.Group();
  const wb = add(w, new THREE.SphereGeometry(1, 8, 6), 0x50646F, 0, 0, 0);
  wb.scale.set(4.8, 1.55, 2.0);
  add(w, new THREE.ConeGeometry(0.4, 0.8, 4), 0x46575F, -1.1, 1.42, 0).rotation.z = 0.4;   // stubby humpback dorsal
  const flukeG = new THREE.Group();
  flukeG.position.set(-4.5, 0.2, 0);
  for (const s of [-1, 1]) {
    const fp = add(flukeG, new THREE.BoxGeometry(1.5, 0.12, 0.7), 0x46575F, -0.55, 0, s * 0.55);
    fp.rotation.y = s * 0.6;
  }
  w.add(flukeG);
  const spoutMat = new THREE.MeshBasicMaterial({ color: 0xEFF6F8, transparent: true, opacity: 0, depthWrite: false });
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 5), spoutMat);
  spout.position.set(1.9, 2.1, 0);
  w.add(spout);
  w.position.set(-120, -5.6, 60);   /* genuinely distant — a spout and a dark back, never a close-up */
  w.rotation.y = 0.7;
  w.visible = false;
  scene.add(w);
  seaLife.whale = { g: w, flukeG, spout, spoutMat };
}
function atContentDwell() {   /* reader is parked at a card — wildlife waits for a wide view */
  if (sail || ride) return false;
  for (const i of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12]) if (Math.abs(camU - SNAP_STOPS[i]) < 0.02) return true;
  return false;
}
window.__seaDebug = { seaLife, force(kind) { seaLife.forceKind = kind || 'pod'; seaLife.next = -1e9; } };

/* boats + floating things that bob on the water */
const bobbers = [];

/* — Boathouse on the creek mouth: a builder's workshop — */
{
  const grp = new THREE.Group();
  grp.position.set(23, dirtPad(23, -57, 5.2), -57);
  grp.rotation.y = 2.3;
  const padY = grp.position.y;                       // world water level y=0 → local -padY
  add(grp, new THREE.BoxGeometry(7, 3.8, 5.6), 0xB08050, 0, 1.9, 0);
  add(grp, new THREE.BoxGeometry(7.08, 0.75, 5.68), 0xA06E42, 0, 0.38, 0);                 // plinth band
  const roof = new THREE.Mesh(prism(8.2, 2.0, 6.4), mat(0x8A5A3C)); roof.position.y = 3.8; grp.add(roof);

  /* large double doors facing the creek — hinged pivots that swing open on the skills approach */
  add(grp, new THREE.BoxGeometry(3.4, 3.05, 0.08), 0x2E241C, 0, 1.55, 2.78);               // dark doorway interior backdrop
  {
    const doorL = new THREE.Group(); doorL.position.set(-1.58, 1.45, 2.96); grp.add(doorL);
    add(doorL, new THREE.BoxGeometry(1.5, 2.9, 0.16), 0x5E4030, 0.75, 0, 0);
    add(doorL, new THREE.BoxGeometry(0.16, 2.8, 0.06), 0x7A5A42, 0.75, 0, 0.12).rotation.z = 0.72;
    const doorR = new THREE.Group(); doorR.position.set(1.58, 1.45, 2.96); grp.add(doorR);
    add(doorR, new THREE.BoxGeometry(1.5, 2.9, 0.16), 0x5E4030, -0.75, 0, 0);
    add(doorR, new THREE.BoxGeometry(0.16, 2.8, 0.06), 0x7A5A42, -0.75, 0, 0.12).rotation.z = 0.72;
    boathouseDoors = { L: doorL, R: doorR };
  }
  add(grp, new THREE.BoxGeometry(1.06, 1.06, 0.08), 0xF7F0DC, -2.4, 2.7, 2.88);            // frame proud of the wall
  add(grp, new THREE.BoxGeometry(0.9, 0.9, 0.1), glassMat, -2.4, 2.7, 2.99);               // workshop window pane, proud of the frame

  /* wooden dock: from the west corner down to the creek (world-space, follows the slope) */
  {
    const dir = { x: -0.79, z: -0.62 };
    for (let i = 0; i < 4; i++) {
      const px = 21.6 + dir.x * i * 1.5, pz = -58.2 + dir.z * i * 1.5;
      add(scene, new THREE.BoxGeometry(2.2, 0.16, 1.45), i % 2 ? 0xC49A6C : 0xB98F60, px, g0(px, pz) + 0.34, pz, Math.atan2(dir.x, dir.z));
      for (const s of [-0.85, 0.85]) {
        const ox = px + dir.z * s, oz = pz - dir.x * s;
        add(scene, new THREE.CylinderGeometry(0.13, 0.17, 1.3, 5), 0x8A5A3C, ox, g0(ox, oz) - 0.2, oz);
      }
    }
    /* rowboat pulled up on the creek beside the dock end, tied to a pile */
    const row = new THREE.Group();
    const rh = new THREE.CylinderGeometry(0.62, 0.4, 3.4, 5, 1);
    rh.rotateZ(Math.PI / 2); rh.scale(1, 0.45, 1);
    add(row, rh, 0x9A4A38, 0, 0.14, 0);
    add(row, new THREE.BoxGeometry(0.2, 0.1, 1.0), 0xC49A6C, -0.5, 0.34, 0);               // thwarts
    add(row, new THREE.BoxGeometry(0.2, 0.1, 1.0), 0xC49A6C, 0.6, 0.34, 0);
    const oar1 = add(row, new THREE.CylinderGeometry(0.045, 0.045, 2.6, 4), 0xC49A6C, 0, 0.4, 0.15);
    oar1.rotation.set(0.12, 0, Math.PI / 2);
    add(row, new THREE.BoxGeometry(0.5, 0.02, 0.16), 0xC49A6C, -1.35, 0.42, 0.19);         // oar blade
    row.position.set(18.4, g0(18.4, -61.6) + 0.22, -61.6);
    row.rotation.y = -2.21;                                                                 // aligned with the creek
    scene.add(row);
    const tie = add(scene, new THREE.CylinderGeometry(0.025, 0.025, 1.4, 4), 0x6E5540, 19.2, g0(19.2, -60.9) + 0.5, -60.9);
    tie.rotation.z = 1.15; tie.rotation.x = 0.35;
  }

  /* wall dressing: tool racks, oars, nets, buoys */
  const wallZ = -2.86;                                                                      // back wall (visible on approach)
  const sideX = 3.54;                                                                       // creek-side wall
  /* tool racks moved to the back wall as the three interactable skill racks (below) */
  /* long oars leaning by the doors */
  for (const [ox, tilt] of [[1.9, 0.16], [2.15, 0.24]]) {
    const oar = add(grp, new THREE.CylinderGeometry(0.05, 0.05, 3.2, 4), 0xC49A6C, ox, 1.6, 2.9);
    oar.rotation.z = tilt;
    add(grp, new THREE.BoxGeometry(0.2, 0.6, 0.06), 0xC49A6C, ox + tilt * 1.7, 2.95, 2.9);
  }
  /* fishing net removed — back wall now carries the three skill racks */
  /* buoys hanging on the back wall */
  for (const [bx, bc] of [[0.9, 0xFF7E5F], [1.5, 0xF5F2EA], [2.1, 0x5E8C4A]]) {
    add(grp, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), 0x6E5540, bx, 2.7, wallZ - 0.08);
    const by = add(grp, new THREE.SphereGeometry(0.26, 7, 6), bc, bx, 2.35, wallZ - 0.1);
    by.scale.y = 1.25;
  }
  /* crab-trap crate + coiled rope by the door */
  add(grp, new THREE.BoxGeometry(0.7, 0.5, 0.7), 0x8A6A4E, -2.6, 0.95, 2.5, 0.3);
  add(grp, new THREE.TorusGeometry(0.3, 0.09, 5, 10), 0xD9CBA8, -1.9, 0.78, 2.9).rotation.x = Math.PI / 2;

  /* three interactable tool racks set in the doorway — hidden by the closed doors, revealed as they swing open.
     every surface sits at a distinct z (no coplanar faces) so nothing z-fights through the doorway */
  const buildRack = (cx, col) => {
    const rg = new THREE.Group();
    add(rg, new THREE.BoxGeometry(0.82, 2.34, 0.06), 0x3C2E22, 0, 0, 0.00);         // backing board
    add(rg, new THREE.BoxGeometry(0.9, 0.32, 0.04), col, 0, 1.0, 0.06);             // colored header
    add(rg, new THREE.BoxGeometry(0.76, 0.08, 0.04), 0x8A6A4E, 0, 0.5, 0.11);       // rail
    add(rg, new THREE.BoxGeometry(0.12, 0.58, 0.05), 0xC49A6C, -0.24, 0.08, 0.15);  // tool: plane blade
    add(rg, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), 0x9A9284, 0.03, 0.06, 0.13); // tool: mallet
    add(rg, new THREE.BoxGeometry(0.1, 0.46, 0.05), col, 0.25, 0.1, 0.15);          // tool: colored square
    rg.position.set(cx, 1.55, 2.82);
    grp.add(rg);
    return rg;
  };
  const skillRacks = [ buildRack(-1.05, 0xE8543A), buildRack(0, 0x3E8FA0), buildRack(1.05, 0xC9982E) ];

  scene.add(grp);
  buildings.boathouse = grp;
  registerGlow(skillRacks[0], 2, false, 'skill-build');
  registerGlow(skillRacks[1], 2, false, 'skill-ship');
  registerGlow(skillRacks[2], 2, false, 'skill-scale');
  registerGlow(grp, 2, false, 'boathouse', { noShell: true, noMarker: true });   // whole boathouse = click-to-fly to the Skills stop; nested racks keep their own ids
}

/* — Pier — */
const pier = new THREE.Group();
{
  pier.position.set(22, 0, 104);       // starts ON the beach sand
  pier.rotation.y = Math.PI + 0.097;   // heads west with slight drift south
  add(pier, new THREE.BoxGeometry(7, 0.4, 5), 0xB08050, -3, 2.95, 0).rotation.z = 0.13;  // ramp off the sand
  add(pier, new THREE.BoxGeometry(88, 0.5, 5), 0xB08050, 44, 3.4, 0);               // deck
  add(pier, new THREE.BoxGeometry(88, 0.16, 0.16), 0x8A5A3C, 44, 4.55, 2.3);        // rails
  add(pier, new THREE.BoxGeometry(88, 0.16, 0.16), 0x8A5A3C, 44, 4.55, -2.3);
  add(pier, new THREE.BoxGeometry(10, 0.5, 9), 0xB08050, 90, 3.4, 0);               // end platform
  const pileGeo = new THREE.CylinderGeometry(0.32, 0.38, 5.5, 5);
  const piles = new THREE.InstancedMesh(pileGeo, mat(0x8A5A3C), 26);
  const dummy = new THREE.Object3D();
  let pi = 0;
  for (let i = 0; i <= 11; i++) for (const side of [-2.1, 2.1]) {
    dummy.position.set(4 + i * 8, 0.55, side); dummy.updateMatrix();
    piles.setMatrixAt(pi++, dummy.matrix);
  }
  for (const side of [-3.8, 3.8]) { dummy.position.set(90, 0.55, side); dummy.updateMatrix(); piles.setMatrixAt(pi++, dummy.matrix); }
  piles.count = pi;
  pier.add(piles);
  scene.add(pier);
  registerFly(pier, 'pier');   // click the pier from anywhere → fly to the harbor walk
}

/* — Boats: a dwell-quality fleet, same material language as the finale boat —
   Sail cloth is OPAQUE (no transparency, no alphaHash/alphaTest) and smooth-shaded; each raised
   sail is one clean triangle (the old deformed quads had a degenerate flipped facet → static). */
const sailMat = new THREE.MeshStandardMaterial({ color: 0xF5F2EA, flatShading: false, roughness: 1, side: THREE.DoubleSide });
function sailTri(foot, luff) {   // one triangle: tack → head (up) → clew (aft along +x)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, luff, 0, foot, 0, 0]), 3));
  g.computeVertexNormals();
  return g;
}
function boat(x, z, len, hullC, accC, kind) {   // 'dinghy' | 'daysailer' | 'trawler' | 'flagship'
  const grp = new THREE.Group();
  const beam = len * (kind === 'trawler' ? 0.32 : 0.27);
  const hullH = 0.55 + len * 0.055;
  const hullY = 0.2 + hullH / 2;                   // hull centre
  const deckY = 0.2 + hullH;                       // deck surface
  const dk1 = 0x6B4C36, dk2 = 0x8A6748;            // finale-boat timber tones

  /* hull: box + pointed triangular bow (finale-boat construction), bow at -x */
  add(grp, new THREE.BoxGeometry(len * 0.72, hullH, beam), hullC, len * 0.08, hullY, 0);
  const bow = add(grp, new THREE.CylinderGeometry(beam * 0.62, beam * 0.62, hullH, 3), hullC, -len * 0.31, hullY, 0);
  bow.rotation.y = Math.PI;
  add(grp, new THREE.BoxGeometry(len * 0.74, 0.16, beam + 0.1), shade(hullC), len * 0.08, deckY - 0.02, 0); // rubbing strake

  /* raised gunwale line + deck planks */
  for (const s of [-1, 1]) {
    add(grp, new THREE.BoxGeometry(len * 0.72, 0.16, 0.1), dk1, len * 0.08, deckY + 0.1, s * (beam / 2 - 0.05));
    add(grp, new THREE.BoxGeometry(0.42, 0.15, 0.1), dk1, -len * 0.33, deckY + 0.09, s * beam * 0.17).rotation.y = -s * 0.5; // bow gunwale taper
  }
  add(grp, new THREE.BoxGeometry(0.1, 0.16, beam - 0.08), dk1, len * 0.44 - 0.05, deckY + 0.1, 0);       // transom cap
  const planks = Math.max(3, Math.round(beam / 0.55));
  for (let i = 0; i < planks; i++)
    add(grp, new THREE.BoxGeometry(len * 0.7, 0.05, (beam / planks) * 0.86), i % 2 ? 0xA8815C : 0x9B7452, len * 0.08, deckY + 0.02, (i - (planks - 1) / 2) * (beam / planks));

  /* rigging line helper */
  const line = (x1, y1, z1, x2, y2, z2) => {
    const L = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 3), mat(0x4A4038));
    c.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1).normalize());
    grp.add(c);
  };
  /* mast + boom + furled sail + stays; stores the (hidden) raised sail for the cast-off */
  const rigSail = (mx, mastH, boomL) => {
    add(grp, new THREE.CylinderGeometry(0.055, 0.08, mastH, 5), 0x8A5A3C, mx, deckY + mastH / 2, 0);
    add(grp, new THREE.CylinderGeometry(0.04, 0.04, boomL, 4), 0x8A5A3C, mx + boomL / 2, deckY + 0.6, 0).rotation.z = Math.PI / 2;
    const furl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, boomL * 0.92, 5), sailMat);       // sail furled on the boom
    furl.rotation.z = Math.PI / 2;
    furl.position.set(mx + boomL / 2, deckY + 0.74, 0);
    grp.add(furl);
    line(mx, deckY + mastH - 0.05, 0, -len * 0.43, deckY + 0.12, 0);                                    // forestay
    line(mx, deckY + mastH - 0.05, 0, len * 0.43, deckY + 0.12, 0);                                     // backstay
    const up = new THREE.Mesh(sailTri(boomL * 0.92, mastH * 0.8), sailMat);                             // raised main, hidden until cast-off
    up.position.set(mx + 0.06, deckY + 0.72, 0);
    up.scale.y = 0.001;
    up.visible = false;
    grp.add(up);
    grp.userData.sailUp = up;
    grp.userData.furl = furl;
    return mx;
  };
  const tiller = () => {
    add(grp, new THREE.CylinderGeometry(0.035, 0.05, len * 0.16, 4), dk2, len * 0.36, deckY + 0.32, 0).rotation.z = 1.25;
  };

  if (kind === 'dinghy') {
    /* open cockpit: bench thwarts, cat rig well forward, oar shipped */
    for (const bx2 of [-len * 0.08, len * 0.16])
      add(grp, new THREE.BoxGeometry(0.3, 0.08, beam - 0.3), dk2, bx2, deckY + 0.22, 0);
    rigSail(-len * 0.18, len * 0.58, len * 0.42);
    tiller();
    add(grp, new THREE.CylinderGeometry(0.035, 0.035, len * 0.5, 4), 0xC49A6C, len * 0.05, deckY + 0.12, beam * 0.28).rotation.z = Math.PI / 2; // oar
  } else if (kind === 'daysailer') {
    /* small cuddy forward + open cockpit aft */
    add(grp, new THREE.BoxGeometry(len * 0.24, len * 0.1, beam * 0.78), accC, -len * 0.14, deckY + len * 0.05, 0);
    add(grp, new THREE.BoxGeometry(len * 0.26, 0.06, beam * 0.82), dk1, -len * 0.14, deckY + len * 0.1 + 0.04, 0); // cuddy top
    for (const s of [-1, 1])                                                                            // cockpit coaming
      add(grp, new THREE.BoxGeometry(len * 0.34, 0.12, 0.06), dk2, len * 0.2, deckY + 0.2, s * beam * 0.3);
    rigSail(-len * 0.02, len * 0.68, len * 0.4);
    tiller();
  } else if (kind === 'trawler') {
    /* wheelhouse forward, striped awning over the working deck aft — the restaurant nod */
    add(grp, new THREE.BoxGeometry(len * 0.26, len * 0.17, beam * 0.8), accC, -len * 0.12, deckY + len * 0.085, 0);
    add(grp, new THREE.BoxGeometry(len * 0.28, 0.07, beam * 0.86), dk1, -len * 0.12, deckY + len * 0.17 + 0.05, 0);
    add(grp, new THREE.BoxGeometry(len * 0.02, len * 0.09, beam * 0.62), 0xBFD4DC, -len * 0.245, deckY + len * 0.1, 0).rotation.z = -0.18; // wheelhouse glass
    add(grp, new THREE.CylinderGeometry(0.09, 0.11, len * 0.1, 6), 0x4A4550, -len * 0.05, deckY + len * 0.22, beam * 0.14); // stack
    /* awning: cream canopy with hull-colour stripes on slim posts */
    const awY = deckY + len * 0.13;
    for (const [sx, sz] of [[len * 0.1, beam * 0.32], [len * 0.1, -beam * 0.32], [len * 0.38, beam * 0.32], [len * 0.38, -beam * 0.32]])
      add(grp, new THREE.CylinderGeometry(0.03, 0.03, awY - deckY, 4), dk2, sx, (deckY + awY) / 2, sz);
    add(grp, new THREE.BoxGeometry(len * 0.34, 0.05, beam * 0.78), 0xF5F2EA, len * 0.24, awY, 0).rotation.z = 0.05;
    for (let i = 0; i < 3; i++)
      add(grp, new THREE.BoxGeometry(len * 0.34 * 0.2, 0.06, beam * 0.8), accC === 0xC96B4A ? 0xC96B4A : accC, len * 0.115 + (i + 0.5) * (len * 0.34 / 3.4), awY + 0.005, 0).rotation.z = 0.05;
    add(grp, new THREE.CylinderGeometry(0.05, 0.06, len * 0.34, 5), 0x8A5A3C, len * 0.02, deckY + len * 0.17, 0).rotation.x = 0.5; // derrick
    /* ship's wheel aft of the wheelhouse */
    const tw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 5, 9), mat(dk2));
    tw.rotation.y = Math.PI / 2; tw.position.set(len * 0.03, deckY + 0.55, 0);
    grp.add(tw);
  } else {   /* flagship */
    /* long cabin with portholes + trim, wheel aft, pennant at the masthead */
    add(grp, new THREE.BoxGeometry(len * 0.34, len * 0.1, beam * 0.76), accC, -len * 0.1, deckY + len * 0.05, 0);
    add(grp, new THREE.BoxGeometry(len * 0.36, 0.08, beam * 0.82), dk1, -len * 0.1, deckY + len * 0.1 + 0.06, 0); // cabin top
    add(grp, new THREE.BoxGeometry(len * 0.36, 0.07, beam * 0.8), 0xF5F2EA, -len * 0.1, deckY + len * 0.05, 0);   // trim band
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {                                               // portholes
      const px2 = -len * 0.1 - len * 0.12 + i * len * 0.08;
      const ring = add(grp, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8), 0xF5F2EA, px2, deckY + len * 0.055, s * (beam * 0.38 + 0.02));
      ring.rotation.x = Math.PI / 2;
      const gl = add(grp, new THREE.CylinderGeometry(0.06, 0.06, 0.07, 8), glassMat, px2, deckY + len * 0.055, s * (beam * 0.38 + 0.03));
      gl.rotation.x = Math.PI / 2;
    }
    const mx = rigSail(len * 0.06, len * 0.62, len * 0.36);
    /* pennant flag at the masthead */
    const pen = new THREE.Mesh(sailTri(0.9, 0.34), mat(0xFF7E5F, 0.25));
    pen.position.set(mx, deckY + len * 0.62 - 0.4, 0);
    grp.add(pen);
    const fw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 5, 10), mat(dk2));                    // wheel
    fw.rotation.y = Math.PI / 2; fw.position.set(len * 0.3, deckY + 0.62, 0);
    grp.add(fw);
    add(grp, new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5), dk2, len * 0.3, deckY + 0.28, 0);
  }

  grp.position.set(x, 0.3, z);
  grp.rotation.y = Math.PI + 0.097;
  scene.add(grp);
  bobbers.push({ g: grp, y0: 0.3, ph: x * 0.7, sp: 0.8 + hash2(x, z) * 0.5, amp: 0.13, sail: null });
  return grp;
}
/* — the docked harbor: shore → pier end, smallest to flagship: 2048 · MeetWise · PlatePromos · Gobattle — */
const boatMeshes = {
  solver2048:  boat(-12, 113.2, 8,    0x5E8C4A, 0xF5F2EA, 'dinghy'),
  meetwise:    boat(-31, 114.8, 10,   0x8FA3B0, 0x5A6B75, 'daysailer'),
  platepromos: boat(-50, 116.6, 11.5, 0xF0D9B0, 0xC96B4A, 'trawler'),
  gobattle:    boat(-69, 119.4, 16,   0xFF7E5F, 0x7A6BAA, 'flagship'),   // flagship at the pier end — larger than the finale boat
};
/* each hull sits at its own slight angle so the row doesn't look stamped */
boatMeshes.solver2048.rotation.y  = Math.PI + 0.16;
boatMeshes.meetwise.rotation.y    = Math.PI + 0.03;
boatMeshes.platepromos.rotation.y = Math.PI + 0.19;
boatMeshes.gobattle.rotation.y    = Math.PI + 0.01;
for (const k in boatMeshes) registerGlow(boatMeshes[k], 4, false, 'boat-' + k);

/* — moorings: bow + stern lines to pier cleats, fenders against the pilings — */
const MOOR_LINES = {};   /* boat key → rope meshes (let go when the fleet casts off) */
{
  const zPier = (x) => 104 + (22 - x) * 0.0974;   // pier centerline
  const lineMat = mat(0x4A4038);
  const seg = (x1, y1, z1, x2, y2, z2, r = 0.028) => {
    const L = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 4), lineMat);
    c.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1).normalize());
    scene.add(c);
    return c;
  };
  const moor = ([key, bx, bz, len]) => {
    const ropes = MOOR_LINES[key] = [];
    const zc = zPier(bx) + 2.4;                     // pier south edge
    for (const s of [-1, 1]) {
      const ax = bx + s * len * 0.36, az = bz - 1.0;                 // boat gunwale end
      const cx = bx + s * (len * 0.36 + 1.6);                        // cleat, led slightly fore/aft
      add(scene, new THREE.BoxGeometry(0.4, 0.11, 0.13), 0x3A3540, cx, 3.76, zc);   // cleat bar
      add(scene, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 5), 0x3A3540, cx, 3.66, zc);
      const mx = (ax + cx) / 2, mz = (az + zc) / 2;                  // sagging line: two segments
      ropes.push(seg(cx, 3.7, zc, mx, 2.2, mz));
      ropes.push(seg(mx, 2.2, mz, ax, 1.35, az));
    }
    for (const fo of [-len * 0.2, len * 0.22]) {                     // fenders on the pilings
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.75, 7), mat(0x3B3742));
      f.position.set(bx + fo, 0.75, zPier(bx + fo) + 2.55);
      scene.add(f);
      seg(bx + fo, 3.6, zPier(bx + fo) + 2.5, bx + fo, 1.12, zPier(bx + fo) + 2.55, 0.02);
    }
  };
  [['solver2048', -12, 113.2, 8], ['meetwise', -31, 114.8, 10], ['platepromos', -50, 116.6, 11.5], ['gobattle', -69, 119.4, 16]].forEach(moor);
}

/* — the cast-off: after the flagship dwell the fleet sails out in formation (u 0.869→0.94),
     staggered, sails raising, then anchors in the moonlit bay for the finale — */
const FLEET = [
  { k: 'solver2048',  dock: { x: -12, z: 113.2, ry: Math.PI + 0.16 }, out: { x: -46, z: 166 } },
  { k: 'meetwise',    dock: { x: -31, z: 114.8, ry: Math.PI + 0.03 }, out: { x: -60, z: 158 } },
  { k: 'platepromos', dock: { x: -50, z: 116.6, ry: Math.PI + 0.19 }, out: { x: -76, z: 166 } },
  { k: 'gobattle',    dock: { x: -69, z: 119.4, ry: Math.PI + 0.01 }, out: { x: -92, z: 156 } },
];
function fleetCastOff(u) {
  FLEET.forEach((f, i) => {
    const g = boatMeshes[f.k];
    const s0 = 0.869 + i * 0.005, e0 = 0.935 + i * 0.005;
    const p = smooth01((u - s0) / (e0 - s0));
    if (p <= 0) {
      g.position.x = f.dock.x; g.position.z = f.dock.z; g.rotation.y = f.dock.ry;
    } else {
      /* quadratic bezier: swing off the berth, then run south into the open bay */
      const cx = f.dock.x - 14, cz = f.dock.z + 20;
      const a = 1 - p;
      g.position.x = a * a * f.dock.x + 2 * a * p * cx + p * p * f.out.x;
      g.position.z = a * a * f.dock.z + 2 * a * p * cz + p * p * f.out.z;
      const tx = 2 * a * (cx - f.dock.x) + 2 * p * (f.out.x - cx);
      const tz = 2 * a * (cz - f.dock.z) + 2 * p * (f.out.z - cz);
      const tRy = Math.atan2(tz, -tx);
      g.rotation.y += ((tRy - g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, p * 4);
    }
    /* sails raise as she gathers way; mooring lines let go */
    if (g.userData.sailUp) {
      g.userData.sailUp.visible = p > 0.01;
      g.userData.sailUp.scale.y = Math.max(0.001, smooth01(p / 0.3));
      if (g.userData.furl) g.userData.furl.visible = p < 0.15;
    }
    if (MOOR_LINES[f.k]) for (const r of MOOR_LINES[f.k]) r.visible = p < 0.02;
  });
}

/* — Finale boat: the journey ends aboard, anchored just off the beach — */
let beachFire = null, bottleG = null, helmG = null, helmWheel = null;
{
  const grp = new THREE.Group();
  grp.position.set(-1.5, 0.25, 154.5);   /* rest height: deck planks clear the damped wave peak with margin */

  /* hull — rides half a plank above the swell, bow pointing out to sea */
  add(grp, new THREE.BoxGeometry(11.6, 1.5, 4.6), 0x7E5C42, 0, 0.42, 0);
  const bow = add(grp, new THREE.CylinderGeometry(2.32, 2.32, 1.5, 3), 0x7E5C42, -6.4, 0.42, 0);
  bow.rotation.y = Math.PI;
  /* deck planks — fill the bottom of the finale frame */
  for (let i = 0; i < 7; i++)
    add(grp, new THREE.BoxGeometry(11.4, 0.08, 0.6), i % 2 ? 0xA8815C : 0x9B7452, 0, 1.16, (i - 3) * 0.64);
  /* gunwales, posts, rails */
  for (const s of [-1, 1]) {
    add(grp, new THREE.BoxGeometry(11.8, 0.22, 0.24), 0x6B4C36, 0, 1.3, s * 2.32);
    add(grp, new THREE.BoxGeometry(11.4, 0.09, 0.12), 0x8A6748, 0, 2.18, s * 2.26);
    for (let i = 0; i < 6; i++)
      add(grp, new THREE.BoxGeometry(0.1, 0.9, 0.1), 0x8A6748, -5.2 + i * 2.1, 1.72, s * 2.26);
  }
  add(grp, new THREE.BoxGeometry(0.12, 0.09, 4.4), 0x8A6748, -5.9, 2.18, 0);                // bow rail
  add(grp, new THREE.BoxGeometry(0.1, 0.9, 0.1), 0x8A6748, -5.9, 1.72, -1.5);
  add(grp, new THREE.BoxGeometry(0.1, 0.9, 0.1), 0x8A6748, -5.9, 1.72, 1.5);

  /* mast base to starboard with a hung lantern — kept low so the camera clears it */
  add(grp, new THREE.CylinderGeometry(0.14, 0.2, 3.0, 7), 0x8A6748, -1.0, 2.66, -1.55);
  add(grp, new THREE.BoxGeometry(0.12, 0.12, 1.0), 0x8A6748, -1.0, 3.25, -1.05);            // lantern arm
  add(grp, new THREE.CylinderGeometry(0.02, 0.02, 0.34, 4), 0x4A4440, -1.0, 3.06, -0.62);   // cord
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0xFFE0A0, emissive: 0xFFC97E, emissiveIntensity: 0, flatShading: true, roughness: 1 }));
  lamp.position.set(-1.0, 2.72, -0.62); grp.add(lamp);
  const lampLight = new THREE.PointLight(0xFFC97E, 0, 9, 2);
  lampLight.position.set(-1.0, 2.72, -0.62); grp.add(lampLight);

  /* — ship's wheel: the post-finale "Take the helm" offer. Hidden until the story fully ends — */
  helmG = new THREE.Group();
  helmG.position.set(-0.6, 1.16, -1.15);
  add(helmG, new THREE.BoxGeometry(0.56, 0.16, 0.44), 0x6B4C36, 0, 0.08, 0);                 // base block
  add(helmG, new THREE.CylinderGeometry(0.07, 0.1, 0.9, 6), 0x8A6748, 0, 0.55, 0);          // pedestal
  helmWheel = new THREE.Group();
  helmWheel.position.set(0, 1.12, 0);
  const helmRim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 14), mat(0xA8815C));
  helmRim.rotation.y = Math.PI / 2;
  helmWheel.add(helmRim);
  for (let i = 0; i < 4; i++)
    add(helmWheel, new THREE.CylinderGeometry(0.028, 0.028, 1.0, 4), 0x8A6748, 0, 0, 0).rotation.x = i * Math.PI / 4;
  for (let i = 0; i < 8; i++) {
    const ha = i * Math.PI / 4;
    add(helmWheel, new THREE.CylinderGeometry(0.026, 0.034, 0.2, 4), 0x6B4C36, 0, Math.cos(ha) * 0.55, Math.sin(ha) * 0.55).rotation.x = ha;
  }
  add(helmWheel, new THREE.CylinderGeometry(0.075, 0.075, 0.14, 6), 0x5C4434, 0, 0, 0).rotation.z = Math.PI / 2; // hub
  helmG.add(helmWheel);
  helmG.visible = false;
  grp.add(helmG);
  registerGlow(helmG, 5, true, 'helm');

  /* fire brazier amidships — warm light pooling across the planks */
  const fireG = new THREE.Group();
  fireG.position.set(-1.8, 1.16, 0.9);
  grp.add(fireG);
  add(fireG, new THREE.CylinderGeometry(0.62, 0.34, 0.42, 8), 0x4A4440, 0, 0.42, 0);        // bowl
  const rim = add(fireG, new THREE.TorusGeometry(0.62, 0.05, 5, 8), 0x5C544E, 0, 0.63, 0);
  rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const leg = add(fireG, new THREE.CylinderGeometry(0.04, 0.05, 0.34, 5), 0x4A4440, Math.cos(a) * 0.38, 0.12, Math.sin(a) * 0.38);
    leg.rotation.z = Math.cos(a) * 0.35; leg.rotation.x = -Math.sin(a) * 0.35;
  }
  add(fireG, new THREE.DodecahedronGeometry(0.16, 0), 0x2A1E16, 0.1, 0.56, 0.05);           // coals
  add(fireG, new THREE.DodecahedronGeometry(0.13, 0), 0x2A1E16, -0.14, 0.58, -0.08);

  beachFire = { grp, boat: grp, gy: 0.25, flames: [], embers: [],
    light: new THREE.PointLight(0xFF8E4E, 0, 26, 2), rock: { rl: 0, pt: 0, hv: 0 },
    lamp: { mat: lamp.material, light: lampLight } };
  beachFire.light.position.set(0, 1.3, 0);
  fireG.add(beachFire.light);
  for (const [col, em, r, h, fx, fz, ph] of [
    [0xFF7A3C, 0.85, 0.3, 0.95, 0, 0, 0], [0xFFB25E, 1.0, 0.2, 0.72, -0.09, 0.07, 2.1],
    [0xFFE0A0, 1.25, 0.11, 0.46, 0.06, -0.06, 4.3],
  ]) {
    const m = add(fireG, new THREE.ConeGeometry(r, h, 5), col, fx, 0.55 + h / 2, fz, 0, em);
    beachFire.flames.push({ m, ph, h });
  }
  for (let i = 0; i < 10; i++) {                                                            // rising embers
    const m = add(fireG, new THREE.OctahedronGeometry(0.05, 0), 0xFFB25E, 0, 0.8, 0, 0, 1.1);
    beachFire.embers.push({ m, x0: (hash2(i, i * 3.3) - 0.5) * 0.7, z0: (hash2(i * 7.1, i) - 0.5) * 0.7,
      off: hash2(i * 2.9, i * 5.7), sp: 0.14 + hash2(i, i * 9.1) * 0.1, ph: i * 1.9, s: 0.5 + hash2(i * 4.3, i) * 0.4 });
  }

  /* set dressing — coiled rope, surfboard callback, bedroll */
  for (let i = 0; i < 3; i++) {
    const c = add(grp, new THREE.TorusGeometry(0.42 - i * 0.05, 0.09, 5, 10), 0xC9AA7C, 3.6, 1.24 + i * 0.13, 1.5);
    c.rotation.x = Math.PI / 2;
  }
  const sb = new THREE.Group();                                                             // the campsite surfboard, along for the ride
  add(sb, new THREE.BoxGeometry(0.55, 2.5, 0.14), 0xFF7E5F, 0, 0, 0);
  add(sb, new THREE.BoxGeometry(0.16, 2.52, 0.15), 0xFFF2DC, 0, 0, 0.006);
  sb.position.set(0.8, 2.2, 2.05);
  sb.rotation.set(-0.24, 0.15, 0.08);
  grp.add(sb);
  const br = add(grp, new THREE.CylinderGeometry(0.3, 0.3, 1.3, 7), 0xB0563E, -0.2, 1.5, -1.95); // bedroll
  br.rotation.z = Math.PI / 2;

  scene.add(grp);
  buildings.beachfire = grp;
  registerFly(grp, 'finale-boat');   // click the finale deck → fly to the finale (helm mesh keeps its own id)
}

/* — floating paper lanterns adrift where the fire once sat — */
const seaLanterns = [];
for (const [lx, lz, ph, drift] of [[-13, 149, 0.5, 0], [-17, 158, 2.4, 0], [-10, 161, 4.1, 0], [-21, 152, 1.3, 0], [-14, 154.5, 5.3, 1]]) {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.5, 0.08, 0.5), 0xC9B08A, 0, 0.04, 0);                      // little raft
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0xE8543A, emissive: 0xFF7E45, emissiveIntensity: 0, flatShading: true, roughness: 1 }));
  body.position.y = 0.26; g.add(body);
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42),
    new THREE.MeshBasicMaterial({ color: 0xFF8E4E, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.rotation.x = -Math.PI / 2; streak.position.y = 0.02; g.add(streak);                // soft reflection on the swell
  g.position.set(lx, 0.1, lz);
  scene.add(g);
  seaLanterns.push({ g, mat: body.material, sk: streak.material, x0: lx, z0: lz, ph, drift });
}

/* — Message in a bottle at the shoreline — */
{
  const b = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x9FD4C4, transparent: true, opacity: 0.6, flatShading: true, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 1.05, 8), glass);
  body.position.y = 0.52; b.add(body);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.3, 0.3, 8), glass);
  sh.position.y = 1.2; b.add(sh);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 8), glass);
  nk.position.y = 1.5; b.add(nk);
  add(b, new THREE.CylinderGeometry(0.105, 0.13, 0.18, 7), 0xB98A62, 0, 1.72, 0);           // cork
  add(b, new THREE.CylinderGeometry(0.15, 0.15, 0.72, 6), 0xF2E8D0, 0, 0.52, 0, 0.4);       // the note
  b.rotation.set(0.1, 0.6, 1.22);                                                            // adrift on its side
  b.scale.setScalar(2.0);
  b.position.set(-7.6, 0.16, 146.5);
  const bl = new THREE.PointLight(0xFFD9A0, 0, 8, 2);                                        // moonlit-glass warmth
  bl.position.set(0, 0.9, 0);
  b.add(bl);
  b.userData.light = bl;
  scene.add(b);
  bottleG = b;
  registerGlow(b, 5, true, 'bottle');
  glowById.bottle.emIdle = 0.5;                                                              // noticeable moonlit pulse
}

/* — Night sky: star field + constellation contact links — */
const starUnis = { uTime: { value: 0 }, uFade: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) } };
const CONSTELLATIONS = [];
let constArmed = false, constClock = 0, lastWorldT = 0;
const _lblV = new THREE.Vector3();
let moonLabelEl = null, moonLabelA = 0;
{
  const starVert = `
    uniform float uTime, uFade, uPR;
    attribute float aSize, aPhase;
    varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPR * (420.0 / -mv.z);
      float tw = 0.72 + 0.28 * sin(uTime * (1.2 + aPhase * 2.0) + aPhase * 41.0);
      vA = uFade * tw;
      gl_Position = projectionMatrix * mv;
    }`;
  const starFrag = `
    varying float vA;
    void main() {
      float a = smoothstep(0.5, 0.1, length(gl_PointCoord - vec2(0.5))) * vA;
      gl_FragColor = vec4(uCol, a);
    }`;
  const mkStarMat = (unis) => new THREE.ShaderMaterial({ uniforms: { ...unis, uCol: { value: new THREE.Color(1.0, 0.96, 0.85) } }, vertexShader: starVert, fragmentShader: 'uniform vec3 uCol;\n' + starFrag, transparent: true, depthWrite: false });

  const BC = new THREE.Vector3(30, 7, 153);          // the beach viewpoint the sky is staged around
  /* field: 650 stars on a dome, denser toward the zenith */
  {
    const N = 650, pos = new Float32Array(N * 3), sz = new Float32Array(N), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const az = hash2(i * 3.7, i * 1.3) * Math.PI * 2;
      const el = Math.asin(0.06 + 0.94 * Math.pow(hash2(i * 7.1, i * 9.7), 0.62));
      pos[i * 3] = BC.x + Math.cos(az) * Math.cos(el) * 700;
      pos[i * 3 + 1] = BC.y + Math.sin(el) * 700;
      pos[i * 3 + 2] = BC.z + Math.sin(az) * Math.cos(el) * 700;
      sz[i] = 2.6 + hash2(i * 1.9, i * 5.3) * 4.2;
      ph[i] = hash2(i * 8.3, i * 2.7);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    scene.add(new THREE.Points(g, mkStarMat(starUnis)));
  }

  /* connect-the-dots shapes (unit coords) */
  const SHAPES = {
    cat: { pts: [[-0.75, 0.45], [-0.55, 0.78], [-0.30, 0.52], [0.30, 0.52], [0.55, 0.78], [0.75, 0.45], [0.88, 0.0], [0.52, -0.55], [0, -0.78], [-0.52, -0.55], [-0.88, 0.0], [-0.30, 0.06], [0.30, 0.06]],
           lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0]] },
    bird: { pts: [[0.95, 0.05], [0.60, 0.30], [0.05, 0.25], [0.25, 0.80], [-0.35, 0.30], [-0.80, 0.10], [-1.05, -0.20], [-0.30, -0.30], [0.40, -0.20]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0]] },
    envelope: { pts: [[-0.9, 0.55], [0.9, 0.55], [0.9, -0.55], [-0.9, -0.55], [0, -0.05]],
                lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]] },
    doc: { pts: [[-0.6, 0.8], [0.35, 0.8], [0.6, 0.55], [0.6, -0.8], [-0.6, -0.8], [0.35, 0.55], [-0.35, 0.35], [0.3, 0.35], [-0.35, 0.0], [0.3, 0.0], [-0.35, -0.35], [0.1, -0.35]],
           lines: [[0, 1], [1, 5], [5, 2], [1, 2], [2, 3], [3, 4], [4, 0], [6, 7], [8, 9], [10, 11]] },
  };
  const defs = [
    { id: 'c-github',  azo: -0.44, el: 0.36, S: 32, shape: 'cat', label: 'GitHub' },
    { id: 'c-linkedin', azo: -0.15, el: 0.46, S: 30, shape: 'bird', label: 'LinkedIn' },
    { id: 'c-email',   azo: 0.15,  el: 0.40, S: 27, shape: 'envelope', label: 'Email' },
    { id: 'c-resume',  azo: 0.44,  el: 0.37, S: 27, shape: 'doc', label: 'Resume' },
  ];
  const labWrap = document.createElement('div');
  labWrap.id = 'constLabels';
  document.body.appendChild(labWrap);
  moonLabelEl = document.createElement('div');
  moonLabelEl.className = 'clabel';
  moonLabelEl.textContent = 'Take to the sky ✦';
  labWrap.appendChild(moonLabelEl);
  for (const d of defs) {
    const az = 3.22 + d.azo, R = 520;
    const C = new THREE.Vector3(Math.cos(az) * Math.cos(d.el), Math.sin(d.el), Math.sin(az) * Math.cos(d.el));
    const center = BC.clone().addScaledVector(C, R);
    const right = new THREE.Vector3().crossVectors(C, new THREE.Vector3(0, 1, 0)).normalize();
    const upv = new THREE.Vector3().crossVectors(right, C).normalize();
    const sh = SHAPES[d.shape];
    const p3 = sh.pts.map(([px, py]) => center.clone().addScaledVector(right, px * d.S).addScaledVector(upv, py * d.S));

    const n = p3.length, pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
    p3.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); sz[i] = d.id === 'c-linkedin' ? 15 : 11; ph[i] = hash2(i * 3.1, az * 7); });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    pg.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const fadeU = { value: 0 };
    const starPtsMat = mkStarMat({ uTime: starUnis.uTime, uFade: fadeU, uPR: starUnis.uPR });
    scene.add(new THREE.Points(pg, starPtsMat));

    const lpos = [];
    let maxSeg = 0, totLen = 0;
    for (const [a, b] of sh.lines) {
      lpos.push(p3[a].x, p3[a].y, p3[a].z, p3[b].x, p3[b].y, p3[b].z);
      const L = p3[a].distanceTo(p3[b]);
      maxSeg = Math.max(maxSeg, L);
      totLen += L;
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lpos), 3));
    const line = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: 0xD8E4F2, transparent: true, opacity: 0, dashSize: 0.001, gapSize: 1e6, depthWrite: false }));
    line.computeLineDistances();
    scene.add(line);

    const entry = { id: d.id, ptsU: fadeU, line, maxSeg, totLen, fade: 0 };
    if (d.id === 'c-linkedin') {
      /* the LinkedIn bird POPS: gold↔white star shimmer, doubled (thicker) lines, sparkle on the brightest star */
      entry.colU = starPtsMat.uniforms.uCol;
      const line2 = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: 0xF2D98A, transparent: true, opacity: 0, dashSize: 0.001, gapSize: 1e6, depthWrite: false }));
      line2.computeLineDistances();
      line2.position.y += 0.7;
      scene.add(line2);
      entry.line2 = line2;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.7, 0),
        new THREE.MeshBasicMaterial({ color: 0xFFDf8A, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      spark.scale.set(1, 1.6, 0.4);
      spark.position.copy(p3[3]);   // the high wing-tip star
      scene.add(spark);
      entry.spark = spark;
    }

    const hit = new THREE.Mesh(new THREE.SphereGeometry(d.S * 1.35, 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.copy(center);
    hit.scale.setScalar(0.0001);
    hit.userData.hid = d.id;
    scene.add(hit);
    hoverMeshes.push(hit);
    glowById[d.id] = { obj: hit, top: d.S * 0.72, hover: false };

    entry.hit = hit;
    const lab = document.createElement('div');
    lab.className = 'clabel';
    lab.textContent = d.label;
    labWrap.appendChild(lab);
    entry.labelEl = lab;
    entry.labelPos = center.clone().addScaledVector(upv, -d.S * 1.12);
    entry.labelA = 0;
    CONSTELLATIONS.push(entry);
  }
}

/* — Scatter: clustered groves + rocks + bushes + driftwood (instanced, ground-clamped) — */
{
  const TOWN = [[52,-6.5],[50.5,3.8],[40.5,12],[36.5,27],[37,34.5],[33,43],[31,50.5],[71,10],[66,15]];
  const keepOut = (x, z) => {
    if (Math.hypot(x - 46, z + 120) < 11) return true;                  // campsite clearing
    if (Math.hypot(x - 23, z + 57) < 11) return true;                   // boathouse
    if (Math.hypot(x - 14, z - 147) < 9) return true;                   // beach fire
    for (const b of TOWN) if (Math.hypot(x - b[0], z - b[1]) < 9.5) return true;
    for (const pn of PATH_NODES) if (Math.hypot(x - pn.x, z - pn.z) < 11) return true;  // camera corridor
    for (let i = 0; i < PATH_NODES.length - 1; i++) {                   // corridor between nodes too
      const mx = (PATH_NODES[i].x + PATH_NODES[i + 1].x) / 2, mz = (PATH_NODES[i].z + PATH_NODES[i + 1].z) / 2;
      if (Math.hypot(x - mx, z - mz) < 10) return true;
    }
    if (nearCreek(x, z, 4.2)) return true;                              // creek corridor
    if (nearVCreek(x, z, 3.0)) return true;                             // village stream corridor
    if (Math.hypot((x - 38) * 0.9, (z - 24) * 0.8) < 26) return true;   // village terraces stay clear
    if (Math.hypot(x - 68, z - 13) < 13) return true;                   // campus knoll
    return false;
  };
  const dummy = new THREE.Object3D();
  const instance = (geo, matOrHex, spots, place) => {
    if (!spots.length) return;
    const im = new THREE.InstancedMesh(geo, matOrHex.isMaterial ? matOrHex : mat(matOrHex), spots.length);
    spots.forEach((p, i) => { place(p); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    scene.add(im);
  };

  /* trees in clustered groves (gaussian-ish falloff, not even spacing) */
  const groves = [
    { x: 70,  z: -152, r: 16, n: 26 }, { x: 52,  z: -128, r: 10, n: 14 }, { x: 88, z: -118, r: 14, n: 20 },
    { x: 38,  z: -88,  r: 9,  n: 12 }, { x: 62,  z: -70,  r: 12, n: 16 }, { x: 84, z: -42,  r: 14, n: 18 },
    { x: 96,  z: -78,  r: 14, n: 16 }, { x: 60,  z: -2,   r: 11, n: 14 }, { x: 84, z: 32,   r: 13, n: 18 },
    { x: 52,  z: 24,   r: 9,  n: 12 }, { x: 46,  z: 50,   r: 9,  n: 10 }, { x: 30, z: -28,  r: 8,  n: 10 },
    { x: 108, z: -160, r: 18, n: 20 }, { x: 112, z: -30,  r: 16, n: 14 },
    { x: 24,  z: -192, r: 11, n: 14 }, { x: 10,  z: -162, r: 13, n: 16 }, { x: 34, z: -226, r: 9, n: 10 },
    { x: -2,  z: -196, r: 10, n: 12 }, { x: 16,  z: -222, r: 8,  n: 9  },
    { x: 142, z: -128, r: 16, n: 18 }, { x: 128, z: -55,  r: 12, n: 14 }, { x: 152, z: -12,  r: 15, n: 16 },
    { x: 134, z: 42,   r: 13, n: 14 }, { x: 158, z: -168, r: 14, n: 14 }, { x: 120, z: 100,  r: 14, n: 14 },
    { x: 146, z: 132,  r: 12, n: 12 }, { x: 172, z: -80,  r: 15, n: 14 },
  ];
  const trees = [];
  groves.forEach((gv, gi) => {
    for (let i = 0; i < gv.n; i++) {
      const a = hash2(gv.x + i * 13.1, gv.z + i * 7.7 + gi) * Math.PI * 2;
      const rr = Math.sqrt(hash2(i * 3.3 + gv.z, gv.x + i * 9.1 + gi)) * gv.r;
      const x = gv.x + Math.cos(a) * rr, z = gv.z + Math.sin(a) * rr;
      const h = terrainH(x, z);
      if (h < 2.5 || keepOut(x, z)) continue;
      trees.push({ x, y: h, z, s: 0.7 + hash2(x, z) * 0.9 });
    }
  });
  const treePlace = (yOff) => (p) => {
    dummy.position.set(p.x, p.y + yOff * p.s, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(0, hash2(p.z, p.x) * Math.PI, 0);
  };
  instance(new THREE.CylinderGeometry(0.22, 0.34, 1.4, 5), 0x8A5A3C, trees, treePlace(0.7));
  instance(new THREE.ConeGeometry(1.7, 2.6, 6), matSway(0x5E8C4A, 0.09, 0.8), trees, treePlace(2.4));
  instance(new THREE.ConeGeometry(1.15, 2.0, 6), matSway(0x7FB069, 0.09, 0.92), trees, treePlace(4.0));

  /* rocks + bushes on grass */
  const rocks = [], bushesA = [], bushesB = [], drift = [];
  for (let i = 0; i < 340; i++) {
    const x = -24 + hash2(i * 1.7, i * 9.3) * 148;
    const z = -235 + hash2(i * 5.1, i * 2.9) * 405;
    const h = terrainH(x, z);
    if (keepOut(x, z)) continue;
    const s = 0.4 + hash2(x * 2.1, z * 1.3) * 0.8;
    if (h > 2.4) {
      const pick = hash2(x * 3.1, z * 3.7);
      if (pick < 0.34) rocks.push({ x, y: h, z, s });
      else if (pick < 0.67) bushesA.push({ x, y: h, z, s });
      else bushesB.push({ x, y: h, z, s });
    }
  }
  /* inland plateau scatter (screen-left of the hero view) */
  for (let i = 0; i < 150; i++) {
    const x = 105 + hash2(i * 3.1, i * 7.7) * 80;
    const z = -200 + hash2(i * 6.3, i * 1.9) * 345;
    const h = terrainH(x, z);
    if (keepOut(x, z)) continue;
    const s = 0.4 + hash2(x * 2.1, z * 1.3) * 0.8;
    if (h > 2.4) {
      const pick = hash2(x * 3.1, z * 3.7);
      if (pick < 0.34) rocks.push({ x, y: h, z, s });
      else if (pick < 0.67) bushesA.push({ x, y: h, z, s });
      else bushesB.push({ x, y: h, z, s });
    }
  }

  /* driftwood + pebbles along the sand band */
  for (let i = 0; i < 46; i++) {
    const z = -205 + i * 8.3 + hash2(i, i * 3.1) * 5;
    const x = shoreX(z) + 2.5 + hash2(i * 7.7, z) * 7;
    const h = terrainH(x, z);
    if (h < 0.4 || h > 2.4 || keepOut(x, z)) continue;
    const s = 0.5 + hash2(x, z * 1.7) * 0.9;
    if (hash2(x * 1.9, z * 2.3) < 0.55) drift.push({ x, y: h, z, s });
    else rocks.push({ x, y: h, z, s: s * 0.7 });
  }
  instance(new THREE.DodecahedronGeometry(1, 0), 0xA89B85, rocks, (p) => {
    dummy.position.set(p.x, p.y + p.s * 0.28, p.z);
    dummy.scale.set(p.s, p.s * 0.7, p.s * 0.85);
    dummy.rotation.set(0, hash2(p.x, p.z) * Math.PI, 0);
  });
  const bushPlace = (p) => {
    dummy.position.set(p.x, p.y + p.s * 0.42, p.z);
    dummy.scale.set(p.s, p.s * 0.62, p.s);
    dummy.rotation.set(0, hash2(p.z, p.x) * Math.PI, 0);
  };
  instance(new THREE.IcosahedronGeometry(1, 0), matSway(0x7FB069, 0.05, 1.15), bushesA, bushPlace);
  instance(new THREE.IcosahedronGeometry(1, 0), matSway(0x5E8C4A, 0.05, 1.0), bushesB, bushPlace);
  instance(new THREE.CylinderGeometry(0.13, 0.2, 2.4, 5), 0xBCA98C, drift, (p) => {
    dummy.position.set(p.x, p.y + 0.18, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(Math.PI / 2, 0, hash2(p.x, p.z) * Math.PI);
  });

  /* grass tufts — dense at chapter dwells, breathing between */
  const grass = [];
  const grassPatches = [
    { x: 46, z: -120, r: 12, n: 60 },  // campsite
    { x: 26, z: -60,  r: 10, n: 36 },  // boathouse
    { x: 32, z: 24,   r: 14, n: 50 },  // town
    { x: 20, z: 140,  r: 16, n: 40 },  // beach dunes
    { x: 98, z: -218, r: 14, n: 44 },  // bluff
    { x: 60, z: -90,  r: 30, n: 30 },  // valley, sparse
  ];
  for (const gp of grassPatches) for (let i = 0; i < gp.n; i++) {
    const a = hash2(gp.x + i * 11.3, gp.z + i * 5.9) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i * 2.7 + gp.x, i * 8.9 + gp.z)) * gp.r;
    const x = gp.x + Math.cos(a) * rr, z = gp.z + Math.sin(a) * rr;
    const h = terrainH(x, z);
    if (h < 0.6 || nearCreek(x, z, 2.4) || nearVCreek(x, z, 2.2)) continue;
    if (Math.hypot((x - 38) * 0.9, (z - 24) * 0.8) < 26 || Math.hypot(x - 68, z - 13) < 13) continue; // village stays clear
    let hit = false;
    for (const b of TOWN) if (Math.hypot(x - b[0], z - b[1]) < 6) { hit = true; break; }
    if (hit || Math.hypot(x - 14, z - 147) < 3) continue;               // pads + fire ring clear
    grass.push({ x, y: h, z, s: 0.5 + hash2(x * 3, z * 3) * 0.8 });
  }
  instance(new THREE.ConeGeometry(0.3, 1.1, 4), matSway(0x8FBF7A, 0.16, 1.7), grass, (p) => {
    dummy.position.set(p.x, p.y + 0.35 * p.s, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(0, hash2(p.x, p.z) * Math.PI, 0);
  });
}

/* ═══════════════════════ LIFE PASS ═══════════════════════ */
const flocks = [], smokePuffs = [], leaves = [], creekSparks = [], farBoats = [], mists = [];
let windmillBlades = null, lighthouseMat = null, butterfly = null;
const waterfallUnis = { uTime: { value: 0 } };

/* — Gull flocks: bluff, creek mouth, pier — */
{
  const wgL = new THREE.BoxGeometry(1.05, 0.05, 0.32); wgL.translate(0.52, 0, 0);
  const wgR = new THREE.BoxGeometry(1.05, 0.05, 0.32); wgR.translate(-0.52, 0, 0);
  const mkFlock = (cx, cy, cz, r, n, speed) => {
    const grp = new THREE.Group();
    grp.position.set(cx, cy, cz);
    const members = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const wL = add(g, wgL, 0xF7F4EC, 0, 0, 0);
      const wR = add(g, wgR, 0xF7F4EC, 0, 0, 0);
      add(g, new THREE.BoxGeometry(0.22, 0.1, 0.6), 0xEDE8DA, 0, -0.02, 0);
      g.scale.setScalar(0.5);
      grp.add(g);
      members.push({ g, wL, wR, ph: i * 2.3, off: i * (Math.PI * 2 / n) });
    }
    scene.add(grp);
    flocks.push({ grp, members, r, speed, t0: hash2(cx, cz) * 20 });
  };
  mkFlock(100, g0(100, -218) + 15, -218, 17, 3, 0.05);
  mkFlock(5, g0(5, -48) + 11, -48, 12, 2, 0.065);
  mkFlock(-30, 15, 100, 15, 3, 0.045);
}

/* — Chimney smoke puffs — */
{
  const sMat = new THREE.MeshStandardMaterial({ color: 0xF2EFE8, transparent: true, opacity: 0.22, flatShading: true, roughness: 1, depthWrite: false });
  const sGeo = new THREE.IcosahedronGeometry(0.3, 0);
  smokeEmitPts.forEach((e, ei) => {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(sGeo, sMat);
      scene.add(m);
      smokePuffs.push({ m, e, off: i / 5, ph: ei * 2.3 + i });
    }
  });
}

/* — Waterfall off the bluff cliff, feeding the creek — */
{
  const wfMat = new THREE.ShaderMaterial({
    uniforms: waterfallUnis, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){
        float col = 0.5 + 0.5 * sin(vUv.x * 30.0 + 2.2 * sin(vUv.x * 7.0 + 1.7));
        float run = 0.5 + 0.5 * sin((vUv.y * 2.6 + uTime * 0.55) * 6.2831 + col * 2.4);
        vec3 c = mix(vec3(0.70, 0.82, 0.88), vec3(0.97, 0.99, 1.0), 0.3 + 0.5 * col * run);
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float foam = smoothstep(0.30, 0.02, vUv.y) * 0.45;
        float a = (0.20 + 0.26 * col * run + foam) * edge * smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.985, vUv.y);
        gl_FragColor = vec4(c, a);
      }`,
  });
  for (const [rx, rz, rs, ry] of [
    [69.2, -118.3, 4.6, 1.8], [68.4, -115.4, 3.0, 1.2], [68.6, -121.2, 3.2, 1.3],
    [68.0, -118.2, 2.8, 5.2], [67.2, -115.9, 2.2, 4.6],  [67.4, -120.6, 2.3, 4.7],
  ]) {
    const m = add(scene, new THREE.DodecahedronGeometry(1, 0), 0x8F7350, rx, g0(66, -118) + ry, rz);
    m.scale.set(rs, rs * 0.85, rs * 0.9);
    m.rotation.y = hash2(rx, rz) * Math.PI;
  }
  /* plunge pool where the creek begins */
  add(scene, new THREE.CylinderGeometry(2.0, 2.4, 0.5, 9), 0x3E9BB8, 65.6, g0(66, -118) + 0.05, -118).scale.set(1, 1, 0.75);
  const topY = g0(65, -118) + 6.2, botY = g0(65, -120);
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, topY - botY + 1.2), wfMat);
  wf.position.set(66.4, (topY + botY) / 2 + 0.3, -118.2);
  wf.rotation.y = -1.17;   // faces west toward the creek + camera corridor
  wf.rotateX(-0.13);       // lean: top edge tucks ~0.5 east INTO the crest rocks, base kicks west into the plunge pool
  scene.add(wf);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xEFF5F1, flatShading: true, roughness: 1 });
  const bf = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.16, 9), foamMat);
  bf.position.set(65.9, g0(66, -118) + 0.32, -118.05);
  bf.scale.set(1.35, 1, 0.9); bf.rotation.y = -1.17;   // foam pool straddles the fall's bottom edge — no daylight at the landing
  scene.add(bf);
  add(scene, new THREE.BoxGeometry(2.1, 2.6, 0.05), 0x7A6650, 66.74, g0(66, -118) + 4.9, -118.34, -1.17);   // dark water stain on the crest rocks behind the fall
  const mMat = new THREE.MeshStandardMaterial({ color: 0xF2F5F2, transparent: true, opacity: 0.3, flatShading: true, roughness: 1, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mMat);
    m.position.set(64.2 + i * 1.1, botY + 0.55, -119.4 + (i % 2) * 1.5);
    scene.add(m);
    mists.push({ m, ph: i * 2.1, s0: 0.8 + i * 0.25 });
  }
  /* (EXPERIMENT: village cascade falls removed with the stream — the bluff fall by the campsite creek stays) */
}

/* — Creek flow sparkles — */
{
  const sMat = new THREE.MeshBasicMaterial({ color: 0xEAF6F8, transparent: true, opacity: 0.5 });
  const sGeo = new THREE.PlaneGeometry(0.55, 0.16); sGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(sGeo, sMat);
    scene.add(m);
    creekSparks.push({ m, off: i / 8, jx: hash2(i, 3) * 1.2 - 0.6, jz: hash2(7, i) * 1.2 - 0.6 });
  }
}

/* — Butterfly by the campsite — */
{
  const wMat = new THREE.MeshBasicMaterial({ color: 0xFF8E4A, side: THREE.DoubleSide });
  const gL = new THREE.PlaneGeometry(0.3, 0.2); gL.rotateX(-Math.PI / 2); gL.translate(0.16, 0, 0);
  const gR = new THREE.PlaneGeometry(0.3, 0.2); gR.rotateX(-Math.PI / 2); gR.translate(-0.16, 0, 0);
  const grp = new THREE.Group();
  const wL = new THREE.Mesh(gL, wMat), wR = new THREE.Mesh(gR, wMat);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0x4A3A30 }));
  grp.add(wL); grp.add(wR); grp.add(body);
  scene.add(grp);
  butterfly = { grp, wL, wR, baseY: g0(43, -117) + 1.3 };
}

/* — Occasional falling leaves in groves near the path — */
{
  const lMat = new THREE.MeshBasicMaterial({ color: 0x9BA55E, side: THREE.DoubleSide });
  const lGeo = new THREE.PlaneGeometry(0.15, 0.15);
  [[52, -128], [62, -70], [46, 50]].forEach(([gx, gz], si) => {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(lGeo, lMat);
      scene.add(m);
      const x = gx + hash2(gx + i, gz) * 6 - 3, z = gz + hash2(gz, gx + i) * 6 - 3;
      leaves.push({ m, x, z, y0: g0(x, z) + 1.0, drop: 5.5, off: (si * 3 + i) / 9, ph: i * 2.7 });
    }
  });
}

/* — Distant wheat farm on the far inland hillside (silhouette scenery) — */
{
  ribbon([{x:110,z:-100},{x:117,z:-95},{x:124,z:-90}], 9, 0xDDB95C, 0.25);
  ribbon([{x:114,z:-82},{x:121,z:-78},{x:128,z:-74}], 7, 0xE8C878, 0.25);
  building({ x: 122, z: -86, w: 3.2, h: 2.4, d: 2.6, c: 0xE8D9C0, rc: 0xA85F4A, ry: -1.2, cols: 1 });
  const wm = new THREE.Group();
  wm.position.set(113, dirtPad(113, -90, 2.4), -90);
  add(wm, new THREE.CylinderGeometry(0.9, 1.5, 7.5, 6), 0xEDE8DA, 0, 3.75, 0);
  add(wm, new THREE.ConeGeometry(1.35, 1.6, 6), 0xA85F4A, 0, 8.3, 0);
  windmillBlades = new THREE.Group();
  windmillBlades.position.set(-1.2, 7.4, 0);
  windmillBlades.rotation.y = -Math.PI / 2;
  add(windmillBlades, new THREE.BoxGeometry(0.3, 7.0, 0.1), 0xD9CDB4, 0, 0, 0);
  add(windmillBlades, new THREE.BoxGeometry(7.0, 0.3, 0.1), 0xD9CDB4, 0, 0, 0);
  wm.add(windmillBlades);
  scene.add(wm);
}

/* — Far offshore: drifting sails + blinking lighthouse — */
{
  for (const [bx, bz] of [[-240, 20], [-175, -125]]) {
    const g = new THREE.Group();
    const hull = new THREE.CylinderGeometry(0.9, 0.55, 5, 5, 1);
    hull.rotateZ(Math.PI / 2); hull.scale(1, 0.5, 1);
    add(g, hull, 0xF0EBE0, 0, 0.3, 0);
    const sm = new THREE.Mesh(sailTri(1.9, 2.9), sailMat);   // clean single-triangle sail
    sm.position.set(-0.7, 0.55, 0);
    g.add(sm);
    g.position.set(bx, 0.4, bz);
    g.rotation.y = hash2(bx, bz) * Math.PI * 2;
    scene.add(g);
    farBoats.push({ g, x: bx, ph: bx * 0.1 });
  }
  const isl = add(scene, new THREE.DodecahedronGeometry(1, 0), 0xB0A184, -150, 0.2, -175);
  isl.scale.set(7, 2.6, 5.5);
  add(scene, new THREE.CylinderGeometry(1.0, 1.5, 8, 7), 0xF5F2EA, -150, 5, -175);
  add(scene, new THREE.CylinderGeometry(1.1, 1.1, 1.1, 7), 0xC93B2E, -150, 9.4, -175);
  lighthouseMat = new THREE.MeshStandardMaterial({ color: 0xFFF4D6, emissive: 0xFFF4D6, emissiveIntensity: 0.4, flatShading: true });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lighthouseMat);
  lamp.position.set(-150, 10.3, -175);
  scene.add(lamp);
  add(scene, new THREE.ConeGeometry(1.2, 1.0, 7), 0x8A5A3C, -150, 11.2, -175);
}

/* — One heartbeat for all ambient life — */
function animateWorld(t) {
  for (const u of swayUnis) u.value = t;
  waterfallUnis.uTime.value = t;
  /* windows + lamps warm up through golden hour into night */
  const glow = 0.75 * smooth01((camU - 0.52) / 0.25);
  glassMat.emissiveIntensity = 0.001 + glow;
  lampMat.emissiveIntensity = 0.001 + glow * 1.4;
  stringMat.emissiveIntensity = 0.001 + glow * 2.4;                       // string lights glow from golden hour onward
  for (const c of laundry) c.rotation.z = 0.16 * Math.sin(lastWorldT * 1.35 + c.userData.ph);
  const dtw = Math.max(0, Math.min(t - lastWorldT, 0.05));   /* world-time delta — hoisted: sheep/deer need it before the finale block */
  lastWorldT = t;
  /* sheep idle life: discrete graze dips, held; a tiny waddling step to a nearby spot; rare head flick.
     Randomized per sheep — never synced, never gliding. */
  for (const sh of sheep) {
    if (sh.tN === undefined) { sh.tN = t + 0.5 + Math.random() * 2; sh.hd = 0; sh.hdT = 1; sh.mode = 0;
      sh.px = sh.x0; sh.pz = sh.z0; sh.yaw = sh.ph; sh.yawT = sh.ph; sh.flick = -9; }
    if (t >= sh.tN) {
      const r = Math.random();
      if (sh.mode === 1) { sh.mode = 0; sh.hdT = 1; sh.tN = t + 0.75 + Math.random() * 1.5; }
      else if (r < 0.47) { sh.hdT = sh.hdT ? 0 : 1; sh.tN = t + 1.25 + Math.random() * 2.5; }   /* dip to grass / lift, hold */
      else if (r < 0.955 && !sh.hdT) {                                                        /* head-up moment → small step (≈1.75× the original walk rate) */
        const ang = Math.random() * Math.PI * 2, dst = 1 + Math.random();
        sh.sx = sh.px; sh.sz = sh.pz;
        sh.txp = sh.x0 + Math.max(-3, Math.min(3, sh.px - sh.x0 + Math.sin(ang) * dst));
        sh.tzp = sh.z0 + Math.max(-3, Math.min(3, sh.pz - sh.z0 + Math.cos(ang) * dst));
        sh.t0 = t; sh.dur = 1.5 + Math.random() * 0.9; sh.mode = 1; sh.tN = t + sh.dur;
        sh.yawT = Math.atan2(sh.txp - sh.px, sh.tzp - sh.pz);
      } else { sh.flick = t; sh.tN = t + 0.75 + Math.random() * 1.75; }                        /* ear flick */
    }
    if (sh.mode === 1) {
      const k = smooth01(Math.min(1, (t - sh.t0) / sh.dur));
      sh.px = sh.sx + (sh.txp - sh.sx) * k; sh.pz = sh.sz + (sh.tzp - sh.sz) * k;
      sh.s.rotation.z = Math.sin(k * Math.PI * 5) * 0.05;                                    /* waddle */
    } else sh.s.rotation.z *= 0.9;
    let dy = sh.yawT - sh.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    sh.yaw += dy * Math.min(1, dtw * 3);
    sh.hd += ((sh.hdT ? 0 : 1) - sh.hd) * Math.min(1, dtw * 2.2);
    const fk = t - sh.flick;
    sh.head.rotation.z = fk < 0.5 ? Math.sin(fk * 24) * 0.12 * (1 - fk * 2) : 0;
    sh.head.position.y = 0.62 - 0.24 * sh.hd;
    sh.s.position.set(sh.px, g0(sh.px, sh.pz), sh.pz);
    sh.s.rotation.y = sh.yaw;
  }
  /* interactable affordance: white rim outline — faint slow breathing at idle (strongest
     near the chapter dwell), bright on hover — plus a soft scale pop. No spin, no bob. */
  for (const g of glowables) {
    const c = CHAPTERS[g.chapter], mid = (c.u0 + c.u1) / 2, hw = (c.u1 - c.u0) / 2 + 0.06;
    const w = smooth01(Math.max(0, 1 - Math.abs(camU - mid) / hw));
    if (g.shellMat) {
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.8 + g.ph);
      const target = (g.id === 'balloon' && ride) ? 0 : (g.hover ? 0.95 : w * (0.26 + 0.3 * breathe));   /* ~5× idle presence: a first-time visitor spots it at a glance; never glow around the rider */
      g.shellMat.opacity += (target - g.shellMat.opacity) * 0.22;
      const vis = g.shellMat.opacity > 0.02;
      if (vis !== g.shellVis) { g.shellVis = vis; for (const s of g.shells) s.visible = vis; }
    }
    if (g.marker) {
      if (g.hover && !g.seen) { g.seen = true; markSeen(g.id); }   /* fades for good once discovered */
      const mo = (g.seen || (g.id === 'balloon' && ride)) ? 0 : 0.3 + 0.7 * w;
      const op = g.marker.material.opacity + (mo - g.marker.material.opacity) * 0.06;
      g.marker.material.opacity = op;
      g.marker.visible = op > 0.02;
      if (g.marker.visible) g.marker.position.y = g.markY + Math.sin(t * 1.3 + g.ph) * 0.16;
    }
    const emT = g.hover ? 0.15 : Math.max(g.emIdle || 0, g.id && !g.seen ? 0.05 * w : 0) * (0.55 + 0.45 * Math.sin(t * 2.1 + g.ph)); // warmth on hover + idle pulse
    if (Math.abs(g.em - emT) > 0.003) {
      g.em += (emT - g.em) * 0.2;
      for (const mt of g.mats) mt.emissiveIntensity = g.em;
    }
    const sT = g.s0 * (g.hover ? (g.small ? 1.08 : 1.02) : 1);            // soft hover pop
    if (Math.abs(g.obj.scale.x - sT) > 0.0005) g.obj.scale.setScalar(g.obj.scale.x + (sT - g.obj.scale.x) * 0.16);
  }
  if (campFire) {
    for (const f of campFire.flames) {
      f.m.scale.set(1 + 0.16 * Math.sin(t * 6.3 + f.ph), 0.8 + 0.28 * (0.5 + 0.5 * Math.sin(t * 9.1 + f.ph * 2.1)), 1 + 0.16 * Math.cos(t * 7.7 + f.ph));
      f.m.rotation.y = t * 1.1 + f.ph;
    }
    campFire.light.intensity = 1.15 + 0.35 * Math.sin(t * 8.7) * Math.sin(t * 5.3 + 1.7);
  }

  /* — the finale: payoff fire, stars, constellations — */
  const nightW = smooth01((camU - 0.855) / 0.06);
  if (beachFire) {
    const lit = nightW > 0.02;
    for (const f of beachFire.flames) {
      f.m.visible = lit;
      f.m.scale.set(1 + 0.2 * Math.sin(t * 5.9 + f.ph), 0.82 + 0.34 * (0.5 + 0.5 * Math.sin(t * 8.3 + f.ph * 2.1)) + 0.08 * Math.sin(t * 14.1 + f.ph), 1 + 0.2 * Math.cos(t * 7.1 + f.ph));
      f.m.rotation.y = t * 0.9 + f.ph;
    }
    beachFire.light.intensity = nightW * (1.7 + 0.4 * Math.sin(t * 9.2) * Math.sin(t * 6.1 + 1.3) + 0.22 * Math.sin(t * 15.7));
    for (const e of beachFire.embers) {
      e.m.visible = lit;
      const k = (t * e.sp + e.off) % 1;
      e.m.position.set(e.x0 * (0.4 + k) + Math.sin(t * 1.3 + e.ph) * (0.08 + k * 0.3), 0.62 + k * 2.3, e.z0 * (0.4 + k) + Math.cos(t * 1.1 + e.ph) * (0.08 + k * 0.25));
      e.m.scale.setScalar(Math.max(0.001, (1 - k) * e.s));
    }
    /* the whole boat rocks very gently on the swell; camera inherits it at the dwell */
    const rl = 0.014 * Math.sin(t * 0.55), pt = 0.009 * Math.sin(t * 0.42 + 1.7), hv = 0.05 * Math.sin(t * 0.5 + 0.7);
    if (sail) {   /* free-sail: yaw from the wheel; heel/pitch about the boat's true local axes */
      beachFire.boat.rotation.set(0, sail.ry, 0);
      beachFire.boat.rotateOnAxis(_axisX, rl + sailHeel);
      beachFire.boat.rotateOnAxis(_axisZ, pt);
    } else { beachFire.boat.rotation.z = rl; beachFire.boat.rotation.x = pt; }
    beachFire.boat.position.y = beachFire.gy + hv;
    beachFire.rock.rl = rl; beachFire.rock.pt = pt; beachFire.rock.hv = hv;
    beachFire.lamp.mat.emissiveIntensity = nightW * (0.8 + 0.15 * Math.sin(t * 3.1));
    beachFire.lamp.light.intensity = nightW * (0.9 + 0.2 * Math.sin(t * 2.7));
  }
  if (bottleG) {
    bottleG.position.y = 0.16 + Math.sin(t * 1.15 + 2.2) * 0.09;
    bottleG.rotation.z = 1.22 + Math.sin(t * 0.9) * 0.06;
    bottleG.rotation.x = 0.1 + Math.cos(t * 0.75) * 0.05;
    bottleG.userData.light.intensity = nightW * (1.0 + 0.45 * Math.sin(t * 2.1));
  }
  for (const L of seaLanterns) {
    const dz = L.drift ? ((t * 0.45 + 18) % 34) - 17 : 0;                                   // one crosses the frame over ~60s
    L.g.position.z = L.z0 + dz + Math.sin(t * 0.5 + L.ph) * 0.6;
    L.g.position.x = L.x0 + Math.sin(t * 0.33 + L.ph * 2) * 0.5;
    L.g.position.y = 0.1 + Math.sin(t * 1.05 + L.ph) * 0.08;
    L.g.rotation.z = Math.sin(t * 0.8 + L.ph) * 0.08;
    L.mat.emissiveIntensity = nightW * (0.85 + 0.25 * Math.sin(t * 2.3 + L.ph));
    L.sk.opacity = nightW * (0.16 + 0.05 * Math.sin(t * 1.7 + L.ph));
  }
  starUnis.uTime.value = t;
  starUnis.uFade.value += (nightW * 0.95 - starUnis.uFade.value) * Math.min(1, dtw * 2.2);   // eased star fade
  if (camU > 0.9 && !constArmed) { constArmed = true; constClock = 0; }
  else if (camU < 0.85 && constArmed) constArmed = false;
  if (constArmed) constClock += dtw;
  if (camU > 0.82) camera.updateMatrixWorld();   // labels project with this frame's final pose
  CONSTELLATIONS.forEach((c, i) => {
    const lt = constClock - i * 0.4;
    c.fade = constArmed ? smooth01(lt / 0.9) : Math.max(0, c.fade - dtw * 1.6);
    const dK = constArmed ? smooth01((lt - 0.3) / 1.6) : c.fade;
    c.ptsU.value = c.fade * Math.max(nightW, 0.001);
    const hov = glowById[c.id].hover;
    const lm = c.line.material;
    lm.dashSize = Math.max(0.001, dK * c.totLen);      // sequential connect-the-dots sweep
    lm.opacity += (c.fade * nightW * (hov ? 0.95 : (c.colU ? 0.62 : 0.42)) - lm.opacity) * 0.18;
    lm.color.lerp(_cTmp.setHex(hov ? 0xFFEFC2 : (c.colU ? 0xF2D98A : 0xD8E4F2)), 0.15);
    if (c.colU) {   /* slow gold ↔ warm-white shimmer, kept inside the night palette */
      const k = 0.5 + 0.5 * Math.sin(t * 0.7);
      c.colU.value.setRGB(1.0, 0.85 + 0.12 * k, 0.52 + 0.38 * k);
    }
    if (c.line2) { c.line2.material.dashSize = lm.dashSize; c.line2.material.opacity = lm.opacity * 0.55; }
    if (c.spark) {
      const pw = 0.5 + 0.5 * Math.sin(t * 2.6);
      c.spark.material.opacity = c.fade * nightW * (0.3 + 0.65 * pw);
      c.spark.scale.set(1, 1.6, 0.4).multiplyScalar(0.85 + 0.5 * pw);
      c.spark.rotation.z = t * 0.35;
    }
    const hs = camU > 0.87 ? 1 : 0.0001;
    if (c.hit.scale.x !== hs) c.hit.scale.setScalar(hs);
    /* each constellation sounds its note the moment its dash-draw completes */
    if (constArmed && lt > 1.9 && !c.chimed) { c.chimed = true; sndConstNote(i, 1); }
    else if (!constArmed && c.fade <= 0 && c.chimed) c.chimed = false;
    /* name label: fades in as its lines finish drawing, holds ~4s past the last formation, then hover-only */
    const inA = constArmed ? smooth01((lt - 1.9) / 0.55) * (1 - smooth01((constClock - 7.3) / 1.1)) : 0;
    c.labelA += (Math.max(inA, hov ? 1 : 0) - c.labelA) * Math.min(1, dtw * 6);
    const lo = c.labelA * c.fade;
    if (lo > 0.004) {
      _lblV.copy(c.labelPos).project(camera);
      const behind = _lblV.z > 1;
      c.labelEl.style.visibility = behind ? 'hidden' : 'visible';
      if (!behind) {
        c.labelEl.style.left = ((_lblV.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px';
        c.labelEl.style.top = ((-_lblV.y * 0.5 + 0.5) * innerHeight).toFixed(1) + 'px';
        c.labelEl.style.opacity = lo.toFixed(3);
      }
    } else if (c.labelEl.style.visibility !== 'hidden') {
      c.labelEl.style.opacity = '0';
      c.labelEl.style.visibility = 'hidden';
    }
  });
  /* the moon is the fifth invitation — its label lands with its siblings, then goes hover-only */
  if (moonLabelEl) {
    const inA = (constArmed && !REDUCED) ? smooth01((constClock - 3.1) / 0.55) * (1 - smooth01((constClock - 7.3) / 1.1)) : 0;
    moonLabelA += (Math.max(inA, hoverId === 'moon' ? 1 : 0) - moonLabelA) * Math.min(1, dtw * 6);
    const lo = moonLabelA * nightW;
    if (lo > 0.004 && moonDisc.visible) {
      _lblV.copy(moonDisc.position).project(camera);
      const behind = _lblV.z > 1;
      moonLabelEl.style.visibility = behind ? 'hidden' : 'visible';
      if (!behind) {
        moonLabelEl.style.left = ((_lblV.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px';
        moonLabelEl.style.top = (((-_lblV.y * 0.5 + 0.5) * innerHeight) + 92).toFixed(1) + 'px';
        moonLabelEl.style.opacity = lo.toFixed(3);
      }
    } else if (moonLabelEl.style.visibility !== 'hidden') {
      moonLabelEl.style.opacity = '0';
      moonLabelEl.style.visibility = 'hidden';
    }
  }
  /* deer idle life: same machine, statelier — long grazes, rare single steps, slow head lifts */
  for (const d of deer) {
    if (d.tN === undefined) { d.tN = t + 2 + Math.random() * 5; d.hd = 1; d.hdT = 1; d.mode = 0;
      d.px = d.x0; d.pz = d.z0; d.yaw = d.ph; d.yawT = d.ph; }
    if (t >= d.tN) {
      const r = Math.random();
      if (d.mode === 1) { d.mode = 0; d.hdT = 1; d.tN = t + 2 + Math.random() * 4; }
      else if (r < 0.6) { d.hdT = d.hdT ? 0 : 1; d.tN = t + 4 + Math.random() * 7; }
      else if (r < 0.78 && !d.hdT) {
        const ang = Math.random() * Math.PI * 2, dst = 0.8 + Math.random() * 0.9;
        d.sx = d.px; d.sz = d.pz;
        d.txp = d.x0 + Math.max(-2.5, Math.min(2.5, d.px - d.x0 + Math.sin(ang) * dst));
        d.tzp = d.z0 + Math.max(-2.5, Math.min(2.5, d.pz - d.z0 + Math.cos(ang) * dst));
        d.t0 = t; d.dur = 2 + Math.random(); d.mode = 1; d.tN = t + d.dur;
        d.yawT = Math.atan2(d.txp - d.px, d.tzp - d.pz);
      } else d.tN = t + 3 + Math.random() * 4;
    }
    if (d.mode === 1) {
      const k = smooth01(Math.min(1, (t - d.t0) / d.dur));
      d.px = d.sx + (d.txp - d.sx) * k; d.pz = d.sz + (d.tzp - d.sz) * k;
    }
    let dy2 = d.yawT - d.yaw; dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2));
    d.yaw += dy2 * Math.min(1, dtw * 2);
    d.hd += ((d.hdT ? 0 : 1) - d.hd) * Math.min(1, dtw * 1.6);
    d.head.rotation.z = -0.85 + 0.75 * (1 - d.hd);
    d.g.position.set(d.px, g0(d.px, d.pz), d.pz);
    d.g.rotation.y = d.yaw;
  }
  /* clouds drift very slowly, wrapping across the sky */
  for (const c of clouds)
    c.g.position.x = c.x0 + ((t * c.sp + c.off) % c.range) - c.range / 2;
  if (balloon) {   /* burner flare — rise, a flickering sustain, die down; pilot ember in between */
    const c = t % 6.4;
    const fl = smoothstep(0.0, 0.35, c) * (1 - smoothstep(1.25, 1.85, c));
    const flick = fl * (0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 17.3));
    balloon.flame.scale.set(0.4 + flick * 0.9, 0.25 + flick * 1.15, 0.4 + flick * 0.9);
    balloon.flameMat.emissiveIntensity = 0.15 + flick * 2.2;
    balloon.flameMat.opacity = 0.25 + flick * 0.7;
    balloon.burnerLight.intensity = flick * 3.2;
  }
  if (balloon && !ride) {
    const ix = balloon.x0 + Math.sin(t * 0.045) * 7,
          iy = balloon.y0 + Math.sin(t * 0.35) * 0.9,
          iz = balloon.z0 + Math.cos(t * 0.038) * 5;
    if (rideHome) {   /* after a ride: the empty balloon glides back to its idle station */
      if (rideHome.t0 === null) { rideHome.t0 = t; rideHome.dur = Math.max(6, Math.hypot(rideHome.p.x - ix, rideHome.p.z - iz) / 14); }
      const k = smooth01((t - rideHome.t0) / rideHome.dur);
      balloon.g.position.set(rideHome.p.x + (ix - rideHome.p.x) * k, rideHome.p.y + (iy - rideHome.p.y) * k, rideHome.p.z + (iz - rideHome.p.z) * k);
      if (k >= 1) rideHome = null;
    } else balloon.g.position.set(ix, iy, iz);
  }
  /* sea life — rare is magical: scheduler + keyframed events, one at a time */
  if (!REDUCED) {
    const SL = seaLife;
    if (!SL.evt && t > SL.next) {
      if (!SL.forceKind && atContentDwell()) SL.next = t + 6;
      else {
        const kind = SL.forceKind || ((t - SL.lastWhale > 75 && Math.random() < 0.5) ? 'whale' : 'pod');
        SL.forceKind = null;
        if (kind === 'whale') { SL.evt = { kind, t0: t }; SL.lastWhale = t; SL.whale.g.visible = true; }
        else {
          const Z = POD_ZONES[(Math.random() * POD_ZONES.length) | 0];
          const hd = Z.hd + (Math.random() - 0.5) * 0.6;
          SL.evt = { kind, t0: t, x: Z.x, z: Z.z, hd, c: Math.cos(hd), s: Math.sin(hd) };
          for (const g of SL.pod) { g.visible = true; g.rotation.y = -hd; }
        }
      }
    }
    if (SL.evt && SL.evt.kind === 'pod') {
      const E = SL.evt, ARC = 1.7, GAP = 0.9, SPD = 2.6;
      let done = true;
      for (let i = 0; i < 3; i++) {
        const g = SL.pod[i], s = SL.podSplash[i];
        const lt = t - E.t0 - i * 0.85;
        const span = (2 + (i & 1)) * (ARC + GAP);          /* 2–3 gentle arcs each */
        const dist = SPD * Math.max(0, lt), dLat = (i - 1) * 2.1;
        const px = E.x + E.c * dist - E.s * dLat, pz = E.z + E.s * dist + E.c * dLat;
        g.position.x = px; g.position.z = pz;
        if (lt < span) done = false;
        const ph = lt % (ARC + GAP);
        if (lt >= 0 && lt < span && ph < ARC) {
          const k = ph / ARC;
          g.position.y = -1.5 + 2.9 * Math.sin(Math.PI * k);
          g.rotation.z = 0.7 * Math.cos(Math.PI * k);
          const sp = k < 0.18 ? 1 - k / 0.18 : (k > 0.82 ? (k - 0.82) / 0.18 : 0);   /* small soft splash at entry + exit */
          s.visible = sp > 0.01;
          s.material.opacity = sp * 0.45;
          s.position.set(px, 0.14, pz);
          s.scale.setScalar(0.7 + (1 - sp) * 0.9);
        } else {
          g.position.y = -1.6; g.rotation.z = 0;
          s.visible = false; s.material.opacity = 0;
        }
      }
      if (done) {
        for (const g of SL.pod) g.visible = false;
        for (const s of SL.podSplash) s.visible = false;
        SL.evt = null; SL.next = t + 30 + Math.random() * 15;
      }
    } else if (SL.evt && SL.evt.kind === 'whale') {
      const w = SL.whale, k = (t - SL.evt.t0) / 9;     /* one slow spout + back-and-fluke roll — no breach */
      if (k >= 1) {
        w.g.visible = false; w.spoutMat.opacity = 0; w.flukeG.rotation.z = 0;
        SL.evt = null; SL.next = t + 30 + Math.random() * 15;
      } else {
        w.g.position.y = -5.6 + 5.0 * Math.sin(Math.PI * Math.pow(k, 0.9));
        w.g.rotation.z = 0.14 * (k * 2 - 1);
        w.flukeG.rotation.z = -1.0 * smoothstep(0.78, 0.95, k);
        const sp = smoothstep(0.2, 0.3, k) * (1 - smoothstep(0.38, 0.52, k));
        w.spoutMat.opacity = sp * 0.4;
        w.spout.scale.set(0.5 + sp, 0.3 + sp * 1.3, 0.5 + sp);
      }
    }
  }
  fleetCastOff(camU);
  for (const b of bobbers) {
    b.g.position.y = b.y0 + Math.sin(t * b.sp + b.ph) * b.amp;
    b.g.rotation.z = Math.sin(t * b.sp * 0.7 + b.ph) * 0.035;
    b.g.rotation.x = Math.cos(t * b.sp * 0.55 + b.ph * 1.3) * 0.025;
    if (b.sail) b.sail.rotation.y = Math.sin(t * 1.4 + b.ph) * 0.07;
  }
  for (const f of flocks) {
    for (const m of f.members) {
      const a = (t + f.t0) * f.speed * Math.PI * 2 + m.off;
      m.g.position.set(Math.cos(a) * f.r, Math.sin(t * 0.4 + m.ph) * 1.4, Math.sin(a) * f.r * 0.82);
      m.g.rotation.y = Math.atan2(-Math.sin(a), 0.82 * Math.cos(a));
      const flap = Math.sin(t * 4.5 + m.ph * 3) * 0.45;
      m.wL.rotation.z = flap; m.wR.rotation.z = -flap;
    }
  }
  for (const p of smokePuffs) {
    const k = (t * 0.09 + p.off + p.ph * 0.13) % 1;
    p.m.position.set(p.e.x + k * 1.6 + Math.sin(t * 0.7 + p.ph) * 0.25, p.e.y + k * 4.2, p.e.z + k * 0.9);
    p.m.scale.setScalar(Math.max(Math.sin(k * Math.PI) * (0.4 + k * 0.9), 0.001));
  }
  if (butterfly) {
    butterfly.grp.position.set(43 + Math.sin(t * 0.31) * 2.6,
      butterfly.baseY + Math.sin(t * 0.9) * 0.5 + Math.sin(t * 3.7) * 0.12,
      -117 + Math.cos(t * 0.23) * 2.2);
    butterfly.grp.rotation.y = t * 0.31;
    const bf = 0.5 + Math.sin(t * 9) * 0.55;
    butterfly.wL.rotation.z = bf; butterfly.wR.rotation.z = -bf;
  }
  for (const lf of leaves) {
    const k = (t * 0.055 + lf.off) % 1;
    lf.m.position.set(lf.x + Math.sin(k * 9 + lf.ph) * 1.1, lf.y0 + (1 - k) * lf.drop, lf.z + Math.cos(k * 7 + lf.ph) * 1.1);
    lf.m.rotation.set(k * 8 + lf.ph, k * 5, lf.ph);
    lf.m.visible = k < 0.96;
  }
  for (const sp of creekSparks) {
    const k = (t * 0.06 + sp.off) % 1;
    const fi = k * (creekPts.length - 1), i0 = Math.floor(fi), fr = fi - i0;
    const p0 = creekPts[i0], p1 = creekPts[Math.min(i0 + 1, creekPts.length - 1)];
    const x = p0.x + (p1.x - p0.x) * fr, z = p0.z + (p1.z - p0.z) * fr;
    sp.m.position.set(x + sp.jx, g0(x + sp.jx, z + sp.jz) + 0.34, z + sp.jz);
    sp.m.scale.setScalar(0.6 + 0.4 * Math.sin(t * 3 + sp.off * 20));
  }
  if (windmillBlades) windmillBlades.rotation.z = t * 0.3;
  if (lighthouseMat) lighthouseMat.emissiveIntensity = Math.pow(Math.max(Math.sin(t * 1.2), 0), 6) * 2.5 + 0.15;
  for (const fb of farBoats) {
    fb.g.position.x = fb.x + Math.sin(t * 0.03 + fb.ph) * 10;
    fb.g.position.y = 0.4 + Math.sin(t * 0.7 + fb.ph) * 0.15;
    fb.g.rotation.z = Math.sin(t * 0.5 + fb.ph) * 0.04;
  }
  for (const ms of mists) ms.m.scale.setScalar((0.8 + 0.35 * Math.sin(t * 1.1 + ms.ph)) * ms.s0);
}

/* ═══════════════════════ CAMERA PATH ═══════════════════════ */
const camPoints = PATH_NODES.map(n => new THREE.Vector3(n.x, Math.max(terrainH(n.x, n.z), 0) + n.up, n.z));
const lookPoints = PATH_NODES.map(n => new THREE.Vector3(n.look.x, Math.max(terrainH(n.look.x, n.look.z), 0) + n.look.up, n.look.z));
const camCurve = new THREE.CatmullRomCurve3(camPoints, false, 'centripetal', 0.5);
const lookCurve = new THREE.CatmullRomCurve3(lookPoints, false, 'centripetal', 0.5);
const NSEG = PATH_NODES.length - 1;

/* Map scroll u → curve param s with dwell easing */
function warp(u) {
  u = clamp01(u);
  const D = STOPS;
  for (let i = 0; i < D.length; i++) {
    const d = D[i], p = d.node / NSEG, w = d.drift / NSEG;
    const s0 = Math.max(0, i === 0 ? p : p - w);
    const s1 = Math.min(1, i === D.length - 1 ? p : p + w);
    if (u >= d.u0 && u <= d.u1) return lerp(s0, s1, (u - d.u0) / (d.u1 - d.u0));
    if (i < D.length - 1) {
      const nd = D[i + 1], np = nd.node / NSEG, nw = nd.drift / NSEG;
      const ns0 = Math.max(0, np - nw);
      if (u > d.u1 && u < nd.u0) return lerp(s1, ns0, smooth01((u - d.u1) / (nd.u0 - d.u1)));
    }
  }
  return 1;
}

/* ═══════════════════════ TAKE THE HELM — free-sail mode ═══════════════════════ */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
let helmReady = false, sail = null, sailHeel = 0;
const sailKeys = { l: 0, r: 0, u: 0, d: 0 };
const _axisX = new THREE.Vector3(1, 0, 0), _axisZ = new THREE.Vector3(0, 0, 1);
const returnShoreBtn = document.getElementById('returnShore');
const sailHintEl = document.getElementById('sailHint');
const sailCapEl = document.getElementById('sailCap');
const sailPadEl = document.getElementById('sailPad');

/* — project islands: tiny lantern-lit monuments in the bay. Dessert, not information — */
const SAIL_ISLES = [];
{
  const isle = (x, z, r, cap, build) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    add(g, new THREE.CylinderGeometry(r * 0.62, r * 1.05, 3.2, 9), 0x8F8474, 0, -0.2, 0);   // rock, top ~1.4
    add(g, new THREE.CylinderGeometry(r * 0.5, r * 0.64, 0.5, 9), 0xC9B08A, 0, 1.55, 0);    // sand cap, top 1.8
    add(g, new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), 0x3A3540, -r * 0.34, 2.5, r * 0.2); // lantern post
    add(g, new THREE.BoxGeometry(0.26, 0.3, 0.26), lampMat, -r * 0.34, 3.35, r * 0.2);
    build(g);
    scene.add(g);
    SAIL_ISLES.push({ x, z, r: r * 1.05, cap });
  };
  isle(-70, 192, 3.0, "gobattle.io — 50,000 sailors and counting", (g) => {          // arcade cabinet
    add(g, new THREE.BoxGeometry(1.0, 1.7, 0.75), 0x4A4550, 0, 2.65, 0);
    add(g, new THREE.BoxGeometry(1.0, 0.3, 0.85), 0xFF7E5F, 0, 3.6, 0.02);
    add(g, new THREE.BoxGeometry(0.72, 0.56, 0.06), 0x2A2530, 0, 2.95, 0.4);
    add(g, new THREE.BoxGeometry(0.6, 0.44, 0.05), 0x7A6BAA, 0, 2.95, 0.45, 0, 0.5);  // glowing screen
    add(g, new THREE.BoxGeometry(0.8, 0.2, 0.3), 0x3B3742, 0, 2.42, 0.52).rotation.x = 0.5;
  });
  isle(-98, 138, 2.8, "PlatePromos — 500 students ate cheaper tonight", (g) => {      // table for two
    add(g, new THREE.CylinderGeometry(0.06, 0.08, 0.85, 5), 0x6B4C36, 0, 2.2, 0);
    add(g, new THREE.CylinderGeometry(0.78, 0.78, 0.09, 9), 0xF2EDE3, 0, 2.65, 0);
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 7), 0xFFFFFF, -0.3, 2.72, 0.15);
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 7), 0xFFFFFF, 0.32, 2.72, -0.12);
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), 0x8A6748, 0, 3.3, 0);
    add(g, new THREE.ConeGeometry(1.15, 0.55, 7), 0xC96B4A, 0, 4.2, 0);               // umbrella
    for (const s2 of [-1, 1])
      add(g, new THREE.CylinderGeometry(0.22, 0.26, 0.5, 6), 0x8A6748, s2 * 1.1, 2.05, s2 * 0.3);
  });
  isle(-38, 214, 2.6, "MeetWise — scheduling in under a minute", (g) => {             // calendar obelisk
    add(g, new THREE.BoxGeometry(1.0, 2.3, 0.55), 0x8FA3B0, 0, 2.9, 0);
    add(g, new THREE.BoxGeometry(1.0, 0.42, 0.57), 0xC4593F, 0, 3.85, 0);
    for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 3; c2++)
      add(g, new THREE.BoxGeometry(0.2, 0.2, 0.06), 0xF2EDE3, (c2 - 1) * 0.3, 3.32 - r2 * 0.3, 0.28);
    add(g, new THREE.BoxGeometry(0.2, 0.2, 0.1), 0xFFC97E, 0, 3.02, 0.3, 0, 0.4);     // today, lit
  });
  isle(-112, 176, 2.6, "2048 AI — wins 98% of 10,000 runs", (g) => {                  // tile cairn
    for (const [s2, c2, y2] of [[1.5, 0xEEE4DA, 2.1], [1.15, 0xF2B179, 2.9], [0.85, 0xF59563, 3.55], [0.6, 0xEDC22E, 4.05]])
      add(g, new THREE.BoxGeometry(s2, 0.55, s2), c2, (y2 * 7 % 1 - 0.5) * 0.14, y2, (y2 * 13 % 1 - 0.5) * 0.14);
  });
}

/* colliders: islands + pier capsule + the moored fleet — bump-and-slide, never stuck */
const SAIL_COLS = [
  ...SAIL_ISLES.map((i) => ({ x: i.x, z: i.z, r: i.r + 1.2 })),
  /* the fleet at its finale anchorage (free-sail only unlocks after the cast-off completes) */
  { x: -46, z: 166, r: 5.2 }, { x: -60, z: 158, r: 5.6 },
  { x: -76, z: 166, r: 6.3 }, { x: -92, z: 156, r: 8.5 },
];
const PIER_A = { x: 22, z: 104 }, PIER_B = { x: -73.5, z: 113.3 }, PIER_R = 4.6;
const pierZat = (x) => 104 + (22 - x) / 95.5 * 9.3;

/* wake foam pool — flat quads that grow and fade */
const wakePool = [];
{
  const wg = new THREE.CircleGeometry(0.55, 7);
  wg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0xBFD6D2, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    m.position.y = 0.16 + i * 0.002;
    scene.add(m);
    wakePool.push({ m, life: 0, dur: 1.3, s0: 1, o0: 0 });
  }
}
let wakeIdx = 0, wakeAcc = 0;
function spawnWake(x, z, s0, o0) {
  const p = wakePool[wakeIdx++ % wakePool.length];
  p.life = p.dur; p.s0 = s0; p.o0 = o0;
  p.m.visible = true;
  p.m.position.x = x; p.m.position.z = z;
  p.m.rotation.y = (x * 7.13 + z * 3.71) % 3.14;
}

const angDelta = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function enterSail() {
  const b = beachFire.grp;
  sail = { phase: 'enter', k: 0,
    x: b.position.x, z: b.position.z, ry: b.rotation.y,
    vx: 0, vz: 0, spT: 0, rud: 0, stun: 0, capIdx: -1,
    p0: camera.position.clone(), q0: camera.quaternion.clone(),
    dock: { x: b.position.x, z: b.position.z, ry: b.rotation.y } };
  document.body.classList.add('sailing');
  returnShoreBtn.style.display = 'block';
  if (COARSE) sailPadEl.style.display = 'flex';
  sailHintEl.style.opacity = 1;
  clearTimeout(enterSail._t);
  enterSail._t = setTimeout(() => { sailHintEl.style.opacity = 0; }, 5000);
  setHover(null);
}
function exitSail() {
  if (!sail || sail.phase === 'exit' || sail.phase === 'blend') return;
  const S = sail;
  /* glide home along a polyline; round the pier end if we're south of it */
  const pts = [{ x: S.x, z: S.z }];
  if (S.z < pierZat(S.x) + 7 && S.x > -85 && S.x < 26) pts.push({ x: -88, z: 127 });
  pts.push({ x: S.dock.x - 15, z: S.dock.z + 2 });
  pts.push({ x: S.dock.x, z: S.dock.z });
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  S.path = { pts, total };
  S.exDur = Math.min(4.5, Math.max(1.6, total / 13));
  S.phase = 'exit'; S.k = 0;
  returnShoreBtn.style.display = 'none';
  sailPadEl.style.display = 'none';
  sailCapEl.style.opacity = 0;
  sailHintEl.style.opacity = 0;
}
function endSail() {
  sail = null; sailHeel = 0;
  for (const k in sailKeys) sailKeys[k] = 0;
  for (const p of wakePool) { p.life = 0; p.m.visible = false; p.m.material.opacity = 0; }
}
returnShoreBtn.addEventListener('click', exitSail);
for (const btn of sailPadEl.querySelectorAll('button')) {
  const k = btn.dataset.k;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); sailKeys[k] = 1; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { sailKeys[k] = 0; });
}
const SAILMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
addEventListener('keydown', (e) => {
  if (!sail) return;
  if (e.key === 'Escape') { exitSail(); return; }
  const k = SAILMAP[e.key];
  if (k) { sailKeys[k] = 1; e.preventDefault(); }
});
addEventListener('keyup', (e) => { const k = SAILMAP[e.key]; if (k) sailKeys[k] = 0; });
window.__sailDebug = { get sail() { return sail; }, enterSail: () => enterSail(), exitSail: () => exitSail(), keys: sailKeys };

/* ═══════════════════════ BOARD THE BALLOON — passive aerial ride ═══════════════════════
   Click the balloon (any distance) → camera glides into the basket and the balloon flies one
   slow preset loop over everything already toured: up the valley past the wheat farm, over the
   village + campanile, along the pier and harbor fleet, a pass over the bay, back inland.
   Arrow keys/AD only NUDGE the drift — the loop reasserts. Exit = button / Esc / any scroll;
   the journey's scroll state is never touched. Not offered under prefers-reduced-motion. */
let ride = null, rideHome = null;
const rideKeys = { l: 0, r: 0 };
const RIDE_DUR = 90;                     /* seconds per full loop */
const returnGroundBtn = document.getElementById('returnGround');
const rideHintEl = document.getElementById('rideHint');
const rideCurve = (() => {
  /* waypoints ride the terrain: y = ground + 26 (≥ 40) clears every roof, tree and the
     campanile (ground + ~19) with margin; wp[0] = the balloon's own idle station */
  const wp = [
    [98, -88], [114, -96], [96, -52], [70, -14], [44, 16], [22, 52],
    [4, 96], [-42, 118], [-92, 148], [-72, 198], [-18, 172], [36, 96], [66, 34], [92, -34],
  ].map(([x, z]) => new THREE.Vector3(x, Math.max(g0(x, z) + 26, 40), z));
  wp[0].y = g0(98, -88) + 27;
  return new THREE.CatmullRomCurve3(wp, true, 'centripetal', 0.5);
})();
const rideLen = rideCurve.getLength();
const _bP = new THREE.Vector3(), _bT = new THREE.Vector3(), _bN = new THREE.Vector3(), _bL = new THREE.Vector3(), _bC = new THREE.Vector3(), _bM = new THREE.Matrix4(), _bQ = new THREE.Quaternion();
let _bH = 0;
function ridePose(f, off, pos, look) {   /* balloon-origin position + camera look target */
  f = ((f % 1) + 1) % 1;
  rideCurve.getPointAt(f, pos);
  rideCurve.getTangentAt(f, _bT);
  _bH = Math.atan2(_bT.x, _bT.z);                 /* travel heading — basket faces the drift, ropes frame the view */
  _bN.set(-_bT.z, 0, _bT.x).normalize();          /* horizontal right-of-travel */
  pos.addScaledVector(_bN, off);
  rideCurve.getPointAt((f + 14 / rideLen) % 1, look);
  look.addScaledVector(_bN, off * 0.7);
  look.y = pos.y + 2.35 - 6.5;                    /* gentle fixed downtilt from the basket eye */
}
function enterBalloon() {
  if (REDUCED || sail || ride || !balloon) return;
  cancelTour();
  ride = { phase: 'enter', k: 0, f: 0, off: 0,
    p0: camera.position.clone(), q0: camera.quaternion.clone(),
    b0: balloon.g.position.clone() };
  ridePose(0, 0, _bP, _bL);
  ride.enDur = Math.min(3.4, Math.max(1.7, camera.position.distanceTo(_bP) / 55));
  rideHome = null;
  document.body.classList.add('ballooning');
  returnGroundBtn.style.display = 'block';
  rideHintEl.style.opacity = 1;
  clearTimeout(enterBalloon._t);
  enterBalloon._t = setTimeout(() => { rideHintEl.style.opacity = 0; }, 6000);
  setHover(null);
}
function exitRide() {
  if (!ride || ride.phase === 'exit') return;
  ride.phase = 'exit'; ride.k = 0;
  ride.p0.copy(camera.position); ride.q0.copy(camera.quaternion);
  ride.exDur = Math.min(3.2, Math.max(1.5, camera.position.distanceTo(camCurve.getPoint(warp(camU))) / 60));
  returnGroundBtn.style.display = 'none';
  rideHintEl.style.opacity = 0;
}
function endRide() {
  rideHome = { p: balloon.g.position.clone(), t0: null };   /* the empty balloon drifts itself home */
  balloon.g.rotation.set(0, 0, 0);
  ride = null;
  rideKeys.l = rideKeys.r = 0;
  document.body.classList.remove('ballooning');
}
returnGroundBtn.addEventListener('click', exitRide);
addEventListener('keydown', (e) => {
  if (!ride) return;
  if (e.key === 'Escape') { exitRide(); return; }
  const k = SAILMAP[e.key];
  if (k === 'l' || k === 'r') rideKeys[k] = 1;
  if (k) e.preventDefault();
});
addEventListener('keyup', (e) => { if (SAILMAP[e.key] === 'l') rideKeys.l = 0; if (SAILMAP[e.key] === 'r') rideKeys.r = 0; });
if (!REDUCED && balloon) {   /* not offered to reduced-motion visitors — the balloon stays scenery */
  registerGlow(balloon.g, 0, false, 'balloon');
  const g = glowById.balloon;
  g.markY = 12.4; if (g.marker) g.marker.position.y = 12.4;   /* beacon floats above the canopy, not inside it */
  /* the moon boards the same ride — clickable only once the finale dwell is reached */
  const mb = moonDisc.userData.base;
  mb.userData.hid = 'moon'; hoverMeshes.push(mb);
  glowById.moon = { obj: mb, hover: false };
}
function rideTick(now, dt) {
  const R = ride;
  /* light steering — influence, not control: offset eases toward ±10 and the loop reasserts */
  const want = (rideKeys.r - rideKeys.l) * 10;
  R.off += (want - R.off) * Math.min(1, dt * (want ? 0.9 : 0.35));
  if (R.phase !== 'exit') {
    if (R.phase === 'fly') R.f = (R.f + dt / RIDE_DUR) % 1;
    ridePose(R.f, R.off, _bP, _bL);
    if (R.phase === 'enter') {
      R.k += dt / R.enDur;
      const e = smooth01(Math.min(1, R.k));
      balloon.g.position.lerpVectors(R.b0, _bP, e);
      balloon.g.rotation.y = angDelta(0, _bH) * e;
      _bC.set(_bP.x + Math.sin(_bH) * 0.18, _bP.y + 2.35, _bP.z + Math.cos(_bH) * 0.18);   /* eye leans at the basket's front wall */
      _bM.lookAt(_bC, _bL, camera.up); _bQ.setFromRotationMatrix(_bM);
      camera.position.lerpVectors(R.p0, _bC, e);
      camera.quaternion.slerpQuaternions(R.q0, _bQ, e);
      if (R.k >= 1) { R.phase = 'fly'; R.look = _bL.clone(); }
    } else {
      balloon.g.position.copy(_bP);
      balloon.g.rotation.y += angDelta(balloon.g.rotation.y, _bH) * Math.min(1, dt * 3.0);
      camera.position.set(_bP.x + Math.sin(_bH) * 0.18, _bP.y + 2.35, _bP.z + Math.cos(_bH) * 0.18);
      if (!R.look) R.look = _bL.clone();
      R.look.lerp(_bL, 1 - Math.exp(-dt * 4));    /* smoothed gaze — curves read as slow head-turns */
      camera.lookAt(R.look);
      const t = now / 1000;                        /* the basket breathes with the wind */
      balloon.g.rotation.z = Math.sin(t * 0.42) * 0.016 - R.off * 0.004;
      balloon.g.rotation.x = Math.sin(t * 0.33 + 1.2) * 0.012;
      camera.rotateZ(balloon.g.rotation.z * 0.6);
    }
  } else {
    R.k += dt / R.exDur;
    const e = smooth01(Math.min(1, R.k));
    const sw = warp(camU);
    const pT = camCurve.getPoint(sw);
    _bM.lookAt(pT, lookCurve.getPoint(sw), camera.up); _bQ.setFromRotationMatrix(_bM);
    camera.position.lerpVectors(R.p0, pT, e);
    camera.quaternion.slerpQuaternions(R.q0, _bQ, e);
    if (R.k >= 1) endRide();
  }
}
window.__rideDebug = { get ride() { return ride; }, enterBalloon, exitRide, curve: rideCurve, get len() { return rideLen; },
  probe(n = 240) {   /* route-clearance audit: downward raycast at n loop samples, ignoring the balloon itself */
    const rc = new THREE.Raycaster(), p = new THREE.Vector3(), skip = new Set();
    balloon.g.traverse((m) => skip.add(m));
    let worst = { clr: 1e9 };
    for (let i = 0; i < n; i++) {
      rideCurve.getPointAt(i / n, p);
      rc.set(new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(0, -1, 0));
      const hit = rc.intersectObjects(scene.children, true).find((h) => !skip.has(h.object) && h.object.visible);
      if (hit) { const clr = p.y - hit.point.y; if (clr < worst.clr) worst = { clr, x: p.x, y: p.y, z: p.z, hitY: hit.point.y, f: i / n }; }
    }
    return worst;
  } };

function pathPoint(path, f, out) {
  let d = f * path.total;
  for (let i = 0; i < path.pts.length - 1; i++) {
    const a = path.pts[i], b = path.pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= seg || i === path.pts.length - 2) {
      const t = seg > 1e-4 ? Math.min(1, d / seg) : 1;
      out.x = a.x + (b.x - a.x) * t;
      out.z = a.z + (b.z - a.z) * t;
      out.tx = (b.x - a.x) / (seg || 1); out.tz = (b.z - a.z) / (seg || 1);
      return;
    }
    d -= seg;
  }
}

const _sV = new THREE.Vector3(), _sV2 = new THREE.Vector3(), _sM = new THREE.Matrix4(), _sQ = new THREE.Quaternion(), _pp = {};
function sailTick(now, rawDt) {
  const S = sail, b = beachFire.grp;
  /* browsers coalesce rAF timestamps under load (dt alternates 0 ↔ 2×frame) — integrate with a
     smoothed step so boat + camera motion stays even instead of double-step/hold judder */
  S.sdt = S.sdt === undefined ? rawDt : S.sdt + (rawDt - S.sdt) * 0.25;
  const dt = Math.min(S.sdt, 0.05);
  const drivable = S.phase === 'drive' || S.phase === 'enter';

  /* — controls → rudder + sail power — */
  const steer = drivable ? (sailKeys.r - sailKeys.l) : 0;
  S.rud += (steer - S.rud) * Math.min(1, dt * 4.5);
  if (drivable) {
    if (sailKeys.u) S.spT = Math.min(11, S.spT + dt * 6);
    if (sailKeys.d) S.spT = Math.max(0, S.spT - dt * 9);
    if (!sailKeys.u && !sailKeys.d) S.spT *= Math.pow(0.55, dt);   // sail luffs when untended
  } else S.spT = 0;
  if (S.stun > 0) S.stun -= dt;

  /* — boat physics: momentum and drift, not car steering — */
  let bx = -Math.cos(S.ry), bz = Math.sin(S.ry);                   // bow direction
  const spd = Math.hypot(S.vx, S.vz);
  S.ry -= S.rud * dt * (0.05 + 0.92 * Math.min(1, spd / 6.5));     // turn authority needs way on — no pivoting in place
  bx = -Math.cos(S.ry); bz = Math.sin(S.ry);
  const fwd = S.vx * bx + S.vz * bz;
  let lx = S.vx - bx * fwd, lz = S.vz - bz * fwd;                  // lateral slip
  const grip = Math.pow(0.22, dt);                                 // water grip bleeds slip slowly → drift
  lx *= grip; lz *= grip;
  const nf = fwd + (S.spT - fwd) * Math.min(1, dt * (S.stun > 0 ? 0.15 : 0.85));
  S.vx = bx * nf + lx; S.vz = bz * nf + lz;

  if (drivable) {
    /* — soft bay boundary: a gentle turn toward open water, no walls — */
    let px = 0, pz = 0;
    const m = 16;
    if (S.x > 6 - m) px -= smooth01((S.x - (6 - m)) / m);
    if (S.x < -134 + m) px += smooth01(((-134 + m) - S.x) / m);
    if (S.z < 82 + m) pz += smooth01(((82 + m) - S.z) / m);
    if (S.z > 228 - m) pz -= smooth01((S.z - (228 - m)) / m);
    if (g0(S.x + bx * 15, S.z + bz * 15) > -1.6) { px -= bx * 0.8; pz -= bz * 0.8; }   // shallows ahead
    const pm = Math.hypot(px, pz);
    if (pm > 0.001) {
      S.ry += Math.sign(px * Math.sin(S.ry) + pz * Math.cos(S.ry)) * Math.min(1, pm) * dt * 0.55;
      S.vx += px * dt * 3.2; S.vz += pz * dt * 3.2;
    }

    /* integrate + collide (bump, slide, soft hit-stop) */
    S.x += S.vx * dt; S.z += S.vz * dt;
    const rb = 5.4;
    const resolve = (cx, cz, cr) => {
      let dx = S.x - cx, dz = S.z - cz;
      const d = Math.hypot(dx, dz), rr = cr + rb;
      if (d < rr && d > 1e-4) {
        dx /= d; dz /= d;
        S.x = cx + dx * rr; S.z = cz + dz * rr;
        const vn = S.vx * dx + S.vz * dz;
        if (vn < 0) {
          S.vx -= dx * vn * 1.12; S.vz -= dz * vn * 1.12;
          if (vn < -2.5 && S.stun <= 0) { S.stun = 0.32; S.spT *= 0.5; }
        }
      }
    };
    for (const c of SAIL_COLS) resolve(c.x, c.z, c.r);
    {
      const abx = PIER_B.x - PIER_A.x, abz = PIER_B.z - PIER_A.z;
      const t = clamp01(((S.x - PIER_A.x) * abx + (S.z - PIER_A.z) * abz) / (abx * abx + abz * abz));
      resolve(PIER_A.x + abx * t, PIER_A.z + abz * t, PIER_R);
    }
  }

  if (S.phase === 'exit') {
    S.k += dt / S.exDur;
    const e = smooth01(Math.min(1, S.k));
    pathPoint(S.path, e, _pp);
    S.x = _pp.x; S.z = _pp.z;
    S.vx = S.vz = 0;
    const tRy = e < 0.78 ? Math.atan2(_pp.tz, -_pp.tx) : S.dock.ry;
    S.ry += angDelta(S.ry, tRy) * Math.min(1, dt * 2.8);
    if (S.k >= 1) {
      S.x = S.dock.x; S.z = S.dock.z; S.ry = S.dock.ry;
      S.phase = 'blend'; S.k = 0;
      S.p0.copy(camera.position); S.q0.copy(camera.quaternion);
    }
  }

  /* — apply boat pose (y + roll/pitch come from animateWorld) — */
  b.position.x = S.x; b.position.z = S.z;
  const spd2 = Math.hypot(S.vx, S.vz);
  sailHeel += ((-S.rud * Math.min(1, spd2 / 8) * 0.1) - sailHeel) * Math.min(1, dt * 2.5);   /* heel INTO the turn */
  if (helmWheel) helmWheel.rotation.x = -S.rud * 1.8;

  /* — wake foam scales with speed — */
  if (drivable && spd2 > 0.8) {
    wakeAcc += dt * Math.min(26, 2 + spd2 * 3.2);
    while (wakeAcc > 1) {
      wakeAcc -= 1;
      spawnWake(S.x - bx * 5.8 + (Math.random() - 0.5) * 2.4, S.z - bz * 5.8 + (Math.random() - 0.5) * 2.4,
        0.6 + Math.random() * 0.6, Math.min(0.3, 0.06 + spd2 * 0.028));
      if (spd2 > 5 && Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? 1 : -1;
        spawnWake(S.x + bx * 4.8 - bz * side * 1.7, S.z + bz * 4.8 + bx * side * 1.7, 0.4 + Math.random() * 0.3, 0.22);
      }
    }
  } else wakeAcc = 0;
  for (const p of wakePool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; p.m.material.opacity = 0; continue; }
    const k2 = 1 - p.life / p.dur;
    p.m.scale.setScalar(p.s0 * (0.6 + 1.9 * k2));
    p.m.material.opacity = p.o0 * (1 - k2);
  }

  /* — island captions: one line, nothing more — */
  if (S.phase === 'drive') {
    let cap = -1;
    for (let i = 0; i < SAIL_ISLES.length; i++)
      if (Math.hypot(S.x - SAIL_ISLES[i].x, S.z - SAIL_ISLES[i].z) < SAIL_ISLES[i].r + 16) { cap = i; break; }
    if (cap !== S.capIdx) {
      S.capIdx = cap;
      if (cap >= 0) { sailCapEl.textContent = SAIL_ISLES[cap].cap; sailCapEl.style.opacity = 1; }
      else sailCapEl.style.opacity = 0;
    }
  }

  /* — chase camera — anchored behind the stern; a touch of velocity blend so drift reads on-screen */
  {
    const vv = Math.hypot(S.vx, S.vz);
    let ax = bx, az = bz;
    if (vv > 0.5) {
      ax = bx * 0.75 + (S.vx / vv) * 0.25; az = bz * 0.75 + (S.vz / vv) * 0.25;
      const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
    }
    _sV.set(S.x - ax * 11, 4.8, S.z - az * 11);
    _sV2.set(S.x + ax * 9, 1.6, S.z + az * 9);
  }
  if (S.phase === 'enter') {
    S.k += dt / 1.7;
    const e = smooth01(Math.min(1, S.k));
    _sM.lookAt(_sV, _sV2, camera.up); _sQ.setFromRotationMatrix(_sM);
    camera.position.lerpVectors(S.p0, _sV, e);
    camera.quaternion.slerpQuaternions(S.q0, _sQ, e);
    if (S.k >= 1) S.phase = 'drive';
  } else if (S.phase === 'blend') {
    S.k += dt / 1.1;
    const e = smooth01(Math.min(1, S.k));
    const sw = warp(camU);
    const pT = camCurve.getPoint(sw);
    _sM.lookAt(pT, lookCurve.getPoint(sw), camera.up); _sQ.setFromRotationMatrix(_sM);
    camera.position.lerpVectors(S.p0, pT, e);
    camera.quaternion.slerpQuaternions(S.q0, _sQ, e);
    if (S.k >= 1) { endSail(); document.body.classList.remove('sailing'); }
  } else {
    camera.position.lerp(_sV, 1 - Math.exp(-dt * 3.2));
    if (!S.look) S.look = _sV2.clone();
    S.look.lerp(_sV2, 1 - Math.exp(-dt * 5));       /* smoothed look target: turns stay buttery */
    camera.lookAt(S.look);
  }
}

/* ═══════════════════════ SCROLL INPUT ═══════════════════════ */
let target = 0, current = 0, fling = 0;
/* rest-coast state: after USER input goes idle, glide to the next canonical stop, starting at the camera's live speed */
let uVel = 0;  /* measured camera speed (u/sec) — feeds the velocity-matched rest-coast */
let lastInputT = -1e9, lastDir = 0, snap = null, commandActive = false, snapArmed = false;
/* arrival glide — ONE primitive for every automated move (settle, dot-nav flight, tour hop,
   arrest capture): a quintic curve, velocity-matched at entry, ZERO velocity and ZERO
   acceleration at both ends (pure smootherstep when starting from rest), duration scaled
   to the distance it covers. */
function glide(to, v0, now, dur) {
  to = clamp01(to);
  const c1 = v0 * dur, D = to - current - c1;
  return { phase: 'glide', from: current, to, t0: now, dur,
           c1, c3: 4 * c1 + 10 * D, c4: -7 * c1 - 15 * D, c5: 3 * c1 + 6 * D };
}
/* Stage 2 — camera follower: the ONLY thing that moves the camera along the path.
   Every system above (budgets, gearing, arrest, rest-snap, commands) writes the DRIVER
   (`current`); the camera position (`camU`) chases it through a critically-damped spring
   with a hard acceleration cap — speed can never change abruptly no matter what the
   driver does, so every zone boundary becomes an invisible curve. ~0.18s lag. */
const FOLLOW_W = 11, FOLLOW_ACC = 1.6;   /* rad/s; u/s² ceiling */
let camU = 0, camV = 0;
function followTick(dt) {
  let rem = Math.min(dt, 0.1);
  while (rem > 0) {                       /* fixed-step — frame-rate safe */
    const h = Math.min(rem, 1 / 240); rem -= h;
    let a = FOLLOW_W * FOLLOW_W * (current - camU) - 2 * FOLLOW_W * camV;
    a = Math.max(-FOLLOW_ACC, Math.min(FOLLOW_ACC, a));
    camV += a * h; camU += camV * h;
  }
  camU = clamp01(camU);
  if (Math.abs(current - camU) < 8e-7 && Math.abs(camV) < 5e-5) { camU = current; camV = 0; }   /* park only once the residual is sub-perceptual — no measurable step */
}
let camSpeed = CONFIG.maxScrollSpeed;   /* current programmatic-flight speed cap (u/s) */
function markInput(dir, tNow) {
  if (gateLock) return;
  sndOnInput();
  const now = tNow ?? performance.now();
  /* B: a FRESH gesture (≥250ms of input silence — not a trackpad momentum tail) releases an
     arrest latch: deliberately leaving a just-arrested stop is what marks it visited */
  if (now - lastInputT > 250 && arrestLatch >= 0) { visited[arrestLatch] = true; arrestLatch = -1; }
  lastInputT = now;
  if (dir) lastDir = Math.sign(dir);
  snap = null; commandActive = false; snapArmed = true;
  camSpeed = CONFIG.maxScrollSpeed;
  cancelTour();                 /* ANY user input hands control back where they are */
}
function command(u, speed, keepTour, tNow) {   /* programmatic nav: ONE distance-shaped glide; rest-coast must NOT re-evaluate after arrival */
  if (!keepTour) cancelTour();
  const now = tNow ?? performance.now();
  sndWhoosh(Math.abs(clamp01(u) - current));
  target = clamp01(u); fling = 0; commandActive = true; snapArmed = false;
  camSpeed = speed || CONFIG.maxScrollSpeed;
  const dist = Math.abs(target - current);
  if (dist < 0.0005) { snap = null; commandActive = false; current = target; arriveAtStop(target, true); return; }
  /* cruise time + ramp allowance: short hops get gentle short curves; long jumps ramp up,
     cruise the quintic's flat-ish middle, and ramp down — zero accel at both ends */
  const dur = Math.max(0.7, dist / camSpeed + 0.5);
  const vCap = 2.2 * dist / dur;
  snap = glide(target, Math.max(-vCap, Math.min(vCap, uVel)), now, dur);
}
/* ── Guided tour: hands-free flight through every canonical stop, then rest at the finale ──
   Content stops (buildings/boats) hold ~6s so the card can be read; scenic stops (hero,
   farewell) hold ~4s. Any user input cancels via markInput → control reads "Resume tour". */
const TOUR_HOLD = [4000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 4000, 6000, 6000, 6000, 6000, 0];   /* per SNAP_STOPS index; 0 = finale, ends */
const TOUR_SPEED = 0.11;   /* cinematic — slower than the 0.22 manual chase cap */
let tour = null;           /* { i, phase:'fly'|'hold', until } */
function startTour() {
  if (REDUCED || sail) return;
  let i = SNAP_STOPS.findIndex((s) => s > current + 0.004);
  if (i < 0) i = 0;        /* already at/after the finale → replay from the top */
  tour = { i, phase: 'fly' };
  command(SNAP_STOPS[i], TOUR_SPEED, true);
  setTourBtn('stop');
}
function tourTick(now) {
  if (!tour) return;
  if (tour.phase === 'fly') {
    if (!commandActive && !snap && Math.abs(current - SNAP_STOPS[tour.i]) < 0.003) {
      if (TOUR_HOLD[tour.i] <= 0) { tour = null; setTourBtn('take'); }        /* finale reached — stay, no loop */
      else { tour.phase = 'hold'; tour.until = now + TOUR_HOLD[tour.i]; }
    }
  } else if (now >= tour.until) {
    const next = tour.i + 1;
    if (next >= SNAP_STOPS.length) { tour = null; setTourBtn('take'); }
    else { tour.i = next; tour.phase = 'fly'; command(SNAP_STOPS[next], TOUR_SPEED, true, now); }
  }
}
/* token bucket: a flick can burst at most flickCap instantly, then travel continues at
   flickRefill u/s — hard scrolls can't skip a chapter, but scrolling never locks up */
/* A: sticky significant stops — EXIT DAMPING, direction-aware. Input effectiveness drops to
   ~30% right at a job-building or boat stop and eases back to 100% across the first ~30% of
   the path toward the next stop — the first flick away barely moves you; a second deliberate
   one releases cleanly. Entering, backtracking into a stop, and open transit run at full
   speed. Pure input scaling — the camera NEVER moves against the user's direction. */
const STICKY_STOPS = [0.426, 0.4805, 0.535, 0.5895, 0.644, 0.702, 0.744, 0.781, 0.818, 0.855];   /* farewell (0.702) included: a designed moment on a long downhill, so leaving forward must be deliberate */
function scrollGear(u, dir) {
  if (!dir) return 1;
  let g = 1;
  if (dir > 0) {
    let s = -1;
    for (const v of STICKY_STOPS) if (v <= u + 1e-4 && v > s) s = v;
    if (s >= 0) {
      const farewell = Math.abs(s - 0.702) < 1e-4;   /* farewell → harbor: widen the exit band ~80% of the gap to boat 1 and drop input harder, so a single flick coasts into boat 1 instead of past it */
      const band = farewell ? 0.034 : 0.02;   /* uniform exit band at every non-farewell stop */
      const floor = farewell ? 0.22 : 0.3;
      const k = (u - s) / band;
      if (k < 1) g = floor + (1 - floor) * smooth01(k);
    }
    /* lead-in: gain eases DOWN to the sticky floor across the last 0.012 before the stop, meeting the
       exit curve's start — continuous through the stop, no responsiveness step at any scroll position */
    let n = 2;
    for (const v of STICKY_STOPS) if (v > u + 1e-4 && v < n) n = v;
    if (n < 2 && n - u < 0.012) {
      const nf = Math.abs(n - 0.702) < 1e-4 ? 0.22 : 0.3;
      g = Math.min(g, 1 - (1 - nf) * smooth01(1 - (n - u) / 0.012));
    }
  } else {
    let s = 2;
    for (const v of STICKY_STOPS) if (v >= u - 1e-4 && v < s) s = v;
    if (s <= 1) {
      const band = 0.02;   /* uniform backward band */
      const k = (s - u) / band;
      if (k < 1) g = 0.3 + 0.7 * smooth01(k);
    }
    let n = -1;
    for (const v of STICKY_STOPS) if (v < u - 1e-4 && v > n) n = v;
    if (n >= 0 && u - n < 0.012) g = Math.min(g, 1 - 0.7 * smooth01(1 - (u - n) / 0.012));
  }
  return g;
}

/* ── B: FIRST-VISIT ARREST ──────────────────────────────────────────────────
   Session memory (in-page, not storage): every significant stop knows whether its
   card has been seen. An UNVISITED stop arrests a passing scroll — input bleeds
   along the ENTIRE approach segment (friction, not a wall: gain eases 1 → AR_FLOOR
   across the whole approach, stays continuous through the stop, and recovers over
   AR_EXIT beyond it), and the idle rest-coast is overridden to land ON the stop,
   pulling BACK onto it if a hard flick slightly overshot. Momentum dies at arrival;
   the stop becomes visited via a fresh gesture after arrival, a ~1.5s at-rest dwell,
   or arriving by dot-nav / tour / click-to-fly. Visited stops keep only the light
   normal damping. Live input is never fought — arrest only scales input magnitude
   and steers the idle coast. */
const SIG_ARREST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];   /* campsite, boathouse, 5 town, farewell, 4 boats — hero & finale start visited */
const visited = SNAP_STOPS.map((_, i) => !SIG_ARREST.includes(i));
let arrestLatch = -1;          /* stop index we were arrested at; the next fresh gesture marks it visited */
let restAt = -1, restT = 0;    /* at-rest dwell accumulator (card on screen) */
let simDry = false;            /* instrumentation harness: run scroll dynamics only, skip camera/world/render */
const AR_FLOOR = 0.12, AR_EXIT = 0.02, AR_PULLBACK = 0.024;
function arrestGain(u, dir) {
  if (!dir) return 1;
  let g = 1, ahead = -1, behind = -1;
  for (const i of SIG_ARREST) {
    if (visited[i]) continue;
    const s = SNAP_STOPS[i];
    if (dir > 0) {
      if (s > u + 1e-4) { if (ahead < 0 || s < SNAP_STOPS[ahead]) ahead = i; }
      else if (behind < 0 || s > SNAP_STOPS[behind]) behind = i;
    } else {
      if (s < u - 1e-4) { if (ahead < 0 || s > SNAP_STOPS[ahead]) ahead = i; }
      else if (behind < 0 || s < SNAP_STOPS[behind]) behind = i;
    }
  }
  if (ahead >= 0) {   /* approach bleed: 1 (zero slope) at the segment start → AR_FLOOR at the stop */
    const s = SNAP_STOPS[ahead];
    const seg = Math.max(Math.abs(s - snapStopFor(s, dir > 0 ? -1 : 1)), 1e-4);
    const k = clamp01(1 - Math.abs(s - u) / seg);
    g *= 1 - (1 - AR_FLOOR) * smooth01(k);
  }
  if (behind >= 0) {  /* recovery just past an unarrived stop — continuous through it */
    const d = Math.abs(u - SNAP_STOPS[behind]);
    if (d < AR_EXIT) g *= AR_FLOOR + (1 - AR_FLOOR) * smooth01(d / AR_EXIT);
  }
  return g;
}
const gearAll = (u, dir) => scrollGear(u, dir) * arrestGain(u, dir);
/* first unvisited significant stop the coast would pass (or just overshot) → catch it */
function arrestCatchIdx(u, to, dir) {
  let best = -1;
  for (const i of SIG_ARREST) {
    if (visited[i]) continue;
    const s = SNAP_STOPS[i];
    if (dir > 0) { if (s >= u - AR_PULLBACK && s <= to + 1e-4 && (best < 0 || s < SNAP_STOPS[best])) best = i; }
    else if (s <= u + AR_PULLBACK && s >= to - 1e-4 && (best < 0 || s > SNAP_STOPS[best])) best = i;
  }
  return best;
}
function arriveAtStop(u, programmatic) {
  let i = -1;
  for (let j = 0; j < SNAP_STOPS.length; j++) if (Math.abs(SNAP_STOPS[j] - u) < 1e-4) { i = j; break; }
  if (i < 0 || visited[i]) { arrestLatch = -1; return; }
  if (programmatic) { visited[i] = true; arrestLatch = -1; }   /* dot-nav / tour / click-to-fly count as visits */
  else arrestLatch = i;
}

let budget = 0.07, lastNudgeT = performance.now();
function nudge(du, tNow) {
  if (gateLock || !du) return;
  const rb = regionBudget(current);                    // per-segment pacing: slows travel AND shrinks the per-flick burst ceiling
  du *= gearAll(current, Math.sign(du)) * rb;
  const now = tNow ?? performance.now();
  const cap = CONFIG.flickCap * rb;                    // one hard flick can't burst a whole harbor hop → never skips a boat
  budget = Math.min(cap, budget + (now - lastNudgeT) / 1000 * CONFIG.flickRefill * rb);
  lastNudgeT = now;
  const step = Math.sign(du) * Math.min(Math.abs(du), budget);
  budget -= Math.abs(step);
  target = clamp01(target + step);
}
addEventListener('wheel', (e) => {
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  if (ride) { exitRide(); return; }                    /* scroll input lands the balloon, journey untouched */
  if (sail) return;
  nudge(dy / CONFIG.scrollLengthPx);
  fling = 0;
  markInput(dy);
}, { passive: false });

let dragging = false, lastY = 0, dragVel = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (ride) { exitRide(); return; }
  if (sail) return;
  if (e.pointerType === 'mouse') return;
  dragging = true; lastY = e.clientY; dragVel = 0; fling = 0;
  markInput(0);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dy = lastY - e.clientY; lastY = e.clientY;
  dragVel = dy;
  target = clamp01(target + dy * CONFIG.touchMultiplier / CONFIG.scrollLengthPx * gearAll(current, Math.sign(dy)) * regionBudget(current));   // direct drag: unclamped
  markInput(dy);
});
const endDrag = () => {
  if (dragging) { dragging = false; fling = dragVel; }
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

addEventListener('keydown', (e) => {
  if (sail || ride || gateLock) return;
  if (e.key === 'ArrowDown') { target = clamp01(target + 0.02 * gearAll(current, 1) * regionBudget(current)); markInput(1); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { target = clamp01(target - 0.02 * gearAll(current, -1) * regionBudget(current)); markInput(-1); e.preventDefault(); }
});

/* Mouse parallax */
let mx = 0, my = 0, pmx = 0, pmy = 0;
addEventListener('mousemove', (e) => {
  mx = (e.clientX / innerWidth) * 2 - 1;
  my = (e.clientY / innerHeight) * 2 - 1;
});

/* ═══════════════════════ OVERLAY CONTENT ═══════════════════════ */
const FACTS = {
  ball:      ["Soccer ball", "Played ECNL and captained a Liverpool FC affiliate to a State Cup final. Still play pickup whenever the group chat delivers.", 'soccer.png'],
  cupGold:   ["Gold trophy", "Peaked at Top 5 in the world in Clash Royale, out of ~100 million players. I think about this more than I should.", 'clash.png'],
  cupSilver: ["Silver trophy", "Top 25 in the US at Brawl Stars. Yes, a second mobile game. I contain multitudes.", 'brawl.png'],
  bench:     ["Bench press", "315 lb bench. The gym is where I do my best thinking."],
  shoes:     ["Running shoes", "4:52 mile, I've always loved to get active."],
  lantern:   ["Red lantern", "HSK 6 — the highest Chinese fluency certification. 我说真的。", 'hsk.png'],
  surf:      ["Surfboard", "The ocean is non-negotiable. It's why this whole site is a coastline.", 'beach.png'],
  berkeley:  ["UC Berkeley", "CS + Industrial Engineering, class of 2029 · 3.94 GPA · Debate, quantum computing, math club, consulting. I collect clubs like achievements."],
};
FACTS['berkeley-hall'] = FACTS.berkeley;
FACTS['c-github']  = ["GitHub", "@yinggarykairui — the code behind all of this. Click to visit."];
FACTS['c-linkedin'] = ["LinkedIn", "in/garyying — let's connect. Click to visit."];
FACTS['c-email']   = ["Say hi", "yinggarykairui@gmail.com — click to write."];
FACTS['c-resume']  = ["Resume", "The one-page version. Click to open the PDF."];
FACTS.balloon      = ["Hot-air balloon", "Fancy a ride? One slow lap over the whole valley. Click to board."];
FACTS.bottle       = ["Found something?", "A message in a bottle — click it; the subject line's already written."];
FACTS['skill-build'] = ["BUILD", "Python · TypeScript / JavaScript · SQL · NumPy · OpenCV"];
FACTS['skill-ship']  = ["SHIP", "FastAPI · Next.js · Docker · nginx · GCP + AWS · Flask · Cloudflare Workers"];
FACTS['skill-scale'] = ["SCALE & SECURE", "LangChain agents · pgvector + HNSW · hybrid retrieval (SQL + vector) · Postgres row-level security · WebSockets · prompt-injection defense"];
FACTS['helm'] = ["Take the helm?", "Sail the bay — ← → steer, ↑ sail, ↓ slow. Esc brings you back to shore."];
FACTS['moon'] = ["Take to the sky ✦", "The balloon's waiting — one slow lap over the valley by moonlight. Click to lift off."];
const LINKS = {
  'c-github': 'https://github.com/yinggarykairui',
  'c-linkedin': 'https://www.linkedin.com/in/garyying/',
  'c-email': 'mailto:yinggarykairui@gmail.com',
  'c-resume': 'resume.pdf',
  bottle: 'mailto:yinggarykairui@gmail.com?subject=Found%20your%20bottle',
};
const WORK = [
  { id: 'gobattle',    img: 'gobattle.webp', t: "Gobattle.io",            r: "Game Developer · 2023–2025",  b: "Started as a high schooler wondering if I could build a multiplayer game from scratch. It became a browser MMO with 50,000+ players — WebSockets, 60 FPS, web/iOS/Android, no engine. It's still live." },
  { id: 'umich',       img: 'umich.png', t: "University of Michigan", r: "AI Research Assistant · 2024–2025", b: "Built a real-time CNN classifier in Python/OpenCV that hit &gt;95% accuracy at &lt;50ms on a webcam. My first taste of research pace vs. shipping pace." },
  { id: 'platepromos', img: 'senate.png', photo: true, t: "PlatePromos",            r: "CTO & Co-Founder · 2024–present",         b: "I walked into 35+ restaurants as a high schooler with no budget and asked them to give students discounts. It worked: 500+ students eating cheaper, recognition from the California Senate, Legislature, and the Mayor of Encinitas. The best part was watching kids order shawarma who couldn't afford to eat out before." },
  { id: 'mirai',       img: 'mirai.png', t: "Mirai Copilot",          r: "Software Engineer · summer 2025", b: "Numerical algorithms in NumPy — Gaussian elimination, eigenvalue methods. Made the math 40% faster and the predictions 30% better." },
  { id: 'stanford',    img: 'stanford.png', photo: true, t: "Stanford Medicine",      r: "AI Engineer · Apr 2025 – Present",      b: "Building an agentic RAG system for doctors — five tools, dynamic routing, hybrid SQL + vector retrieval, with security enforced at the database layer (Postgres RLS), not the prompt. The agent is explicitly untrusted; the data stays safe anyway." },
];
const PROJ = [
  { id: 'boat-solver2048',  t: "2048 AI Solver", grid: true, b: "Minimax with custom heuristics. Wins 98% of 10,000+ simulated runs. The other 2% haunt me." },
  { id: 'boat-meetwise',    t: "MeetWise", img: "meetwise.png", url: "https://meetwise-mu.vercel.app", host: "meetwise-mu.vercel.app", b: "Scheduling shouldn't take 10 minutes. Claude API + Google OAuth + Cloudflare Workers gets it under one." },
  { id: 'boat-platepromos', t: "PlatePromos", img: "platepromos.webp", url: "https://platepromos.com", host: "platepromos.com", b: "The restaurant platform. Flask/AWS, 500+ users, 35+ partners, and a story I'll tell anyone who asks." },
  { id: 'boat-gobattle',    t: "Gobattle.io", tag: "flagship", img: "gobattle.webp", url: "https://gobattle.io", host: "gobattle.io", b: "The MMO. FSM enemy AI, delta-time game loop, predictive aim, adaptive difficulty that reads how you fight — all raw Canvas 2D. Built before I knew it was supposed to be hard." },
];

const chapterEls = ['ch-hero', 'ch-about', 'ch-skills', 'ch-work', 'ch-projects', 'ch-contact'].map((id) => document.getElementById(id));
const farewellEl = document.getElementById('ch-farewell');
const workCard = document.getElementById('workCard');
const projCard = document.getElementById('projCard');
const tip = document.getElementById('tip');

const pips = (arr, i) => `<div class="pips">${arr.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>`;
/* Guard every card/hover image: probe each referenced file ONCE with a silent fetch
   (a 404 response resolves normally — no console error, no broken-<img> retry), and only
   emit an <img> for files that actually exist. Filenames stay wired in the data, so an
   image you drop in later simply appears on the next load — nothing hardcoded. */
const IMG_PRESENT = new Set();
const imgTag = (src, cls, alt) => IMG_PRESENT.has(src) ? `<img class="${cls}" src="${(window.__RES && window.__RES[src]) || src}" alt="${alt || ''}" loading="lazy">` : '';
(function probeImages() {
  const files = new Set();
  WORK.forEach(w => w.img && files.add(w.img));
  PROJ.forEach(p => p.img && files.add(p.img));
  Object.values(FACTS).forEach(f => Array.isArray(f) && f[2] && files.add(f[2]));
  /* standalone build: images are inlined as blobs in window.__RES — presence comes from that map, no network */
  if (window.__RES) {
    for (const src of files) if (window.__RES[src]) IMG_PRESENT.add(src);
    return;
  }
  Promise.all([...files].map(src =>
    fetch(src, { cache: 'force-cache' }).then(r => { if (r.ok) IMG_PRESENT.add(src); }).catch(() => {})
  )).then(() => {   /* a just-confirmed image slots into whatever card is on screen */
    if (typeof workIdx !== 'undefined' && workIdx >= 0) renderWork(workIdx);
    if (typeof projIdx !== 'undefined' && projIdx >= 0) renderProj(projIdx);
  });
})();

function renderWork(i) {
  const w = WORK[i];
  const media = w.img ? imgTag(w.img, w.photo ? 'thumb' : 'thumb logo', '') : '';
  workCard.innerHTML = `${media}<h2>${w.t}</h2><p class="role">${w.r}</p><p>${w.b}</p>${pips(WORK, i)}`;
}
function renderProj(i) {
  const p = PROJ[i];
  const media = p.grid ? GRID2048 : (p.img ? imgTag(p.img, 'thumb', p.t) : '');
  projCard.innerHTML = `${media}<h2>${p.t}${p.tag ? ` <span style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#FFFBF4;background:var(--coral);border-radius:6px;padding:2px 7px;vertical-align:3px;">FLAGSHIP</span>` : ''}</h2><p>${p.b}</p>${p.url ? `<a class="visit" href="${p.url}" target="_blank" rel="noopener">Visit ${p.host} →</a>` : ''}${pips(PROJ, i)}`;
}
/* live-rendered mini 2048 board for the solver card */
const GRID2048 = (() => {
  const vals = [2, 0, 0, 2, 4, 16, 2, 0, 8, 64, 32, 4, 2048, 256, 128, 8];
  const cols = { 2: '#EEE4DA', 4: '#EDE0C8', 8: '#F2B179', 16: '#F59563', 32: '#F67C5F', 64: '#F65E3B', 128: '#EDCF72', 256: '#EDCC61', 2048: '#EDC22E' };
  return `<div class="g2048">${vals.map(v => v ? `<i style="background:${cols[v]};color:${v >= 8 ? '#F9F6F2' : '#776E65'}${v >= 128 ? ';font-size:11px' : ''}${v === 2048 ? ';animation:tilepop 2.4s ease-in-out infinite' : ''}">${v}</i>` : '<i></i>').join('')}</div>`;
})();
function swapCard(el, fn) {
  clearTimeout(el._t);
  if (!el.innerHTML) { fn(); return; }
  el.classList.add('swap');
  el._t = setTimeout(() => { fn(); el.classList.remove('swap'); }, 165);
}

/* — hover raycasting against interactables — */
const ray = new THREE.Raycaster();
const ndcV = new THREE.Vector2();
let hoverDirty = false, hoverId = null, workHover = null, projHover = null, tipEntry = null, lastRay = 0, lastHoverU = -1;
function castHover() {
  if (ride) { if (hoverId) setHover(null); return; }   /* aboard the balloon: the world is scenery, not UI */
  ray.setFromCamera(ndcV, camera);
  const hits = ray.intersectObjects(hoverMeshes, false).filter((h) => {
    const id = h.object.userData.hid;
    if (id === 'helm') return helmReady && !sail;
    if (id === 'moon') return current > 0.958 && !sail;   /* background object mid-journey, interactable only at the finale dwell */
    return true;
  });
  setHover(hits.length ? hits[0].object.userData.hid : null);
}
addEventListener('pointermove', (e) => {
  ndcV.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const n = performance.now();
  if (n - lastRay > 33) { lastRay = n; castHover(); }
  else hoverDirty = true;
});
canvas.addEventListener('click', (e) => {
  ndcV.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  castHover();
  if (!sail) cancelTour();                             /* a click is user input — stop any guided tour */
  if (hoverId === 'moon' && !sail && !ride) { sndMoonTone(); enterBalloon(); return; }   /* take to the sky — same ride, boarded from the finale */
  if (hoverId === 'balloon' && !sail && !ride) { enterBalloon(); return; }   /* board from any distance */
  if (hoverId === 'helm' && helmReady && !sail) { sndHelmBoard(); enterSail(); return; }
  /* click-to-fly: hovered object maps to a stop we're not already parked at → dot-nav-style flight */
  if (!sail && hoverId && STOP_BY_ID[hoverId] != null && Math.abs(current - STOP_BY_ID[hoverId]) > 0.012) {
    command(STOP_BY_ID[hoverId]); return;
  }
  if (hoverId && LINKS[hoverId]) { sndClickFor(hoverId); window.open(LINKS[hoverId], '_blank', 'noopener'); }
});
function setHover(id) {
  if (id === hoverId) return;
  if (hoverId && glowById[hoverId]) glowById[hoverId].hover = false;
  hoverId = id;
  const e = id ? glowById[id] : null;
  if (e) e.hover = true;
  sndHover(id);
  canvas.style.cursor = id ? 'pointer' : '';
  const f = id ? FACTS[id] : null;
  if (f) {
    const im = f[2] ? imgTag(f[2], 'tip-img', '') : '';
    tip.innerHTML = `${im}<b>${f[0]}</b><span>${f[1]}</span>`;
    tip.classList.add('show'); tipEntry = e; positionTip();
  }
  else { tip.classList.remove('show'); tipEntry = null; }
  const wi = WORK.findIndex((w) => w.id === id);
  workHover = wi >= 0 ? wi : null;
  const pi = PROJ.findIndex((p) => p.id === id);
  projHover = pi >= 0 ? pi : null;
}

let workIdx = -1, projIdx = -1;
const _tipV = new THREE.Vector3();
function positionTip() {
  if (!tipEntry) return;
  tipEntry.obj.getWorldPosition(_tipV);
  _tipV.y += tipEntry.top * tipEntry.obj.scale.x + 0.35;
  _tipV.project(camera);
  if (_tipV.z < 1) {
    tip.style.left = Math.max(105, Math.min(innerWidth - 105, (_tipV.x * 0.5 + 0.5) * innerWidth)) + 'px';
    tip.style.top = Math.max(74, (-_tipV.y * 0.5 + 0.5) * innerHeight) + 'px';
  }
}
function overlayUpdate(u) {
  CHAPTERS.forEach((ch, i) =>
    chapterEls[i].classList.toggle('show', u >= ch.u0 - 0.006 && u <= ch.u1 + 0.008));
  farewellEl.classList.toggle('show', u >= 0.694 && u <= 0.712);   // village farewell caption

  /* town cards follow the camera: whichever facade stop the walk has reached; hover overrides */
  let wi = workHover;
  if (wi == null) {
    wi = 0;
    for (let i = 0; i < TOWN_STOPS.length; i++) if (u >= TOWN_STOPS[i].u0 - 0.006) wi = i;
  }
  if (wi !== workIdx) { workIdx = wi; swapCard(workCard, () => renderWork(wi)); }
  workCard.classList.toggle('pre', u < TOWN_STOPS[0].u0 - 0.006 && workHover == null);   // intro only, before the first stop
  /* project cards follow the harbor walk: whichever docked boat the pier walk has reached; hover overrides */
  let pi = projHover;
  if (pi == null) {
    pi = 0;
    for (let j = 0; j < 4; j++) if (u >= 0.730 + j * 0.037 - 0.006) pi = j;
  }
  if (pi !== projIdx) { projIdx = pi; swapCard(projCard, () => renderProj(pi)); }

  /* the camera moves under a resting pointer while scrolling — re-cast hover so a stale
     hover lock can't freeze the card (it used to hold the previous stop's card until arrival) */
  if (Math.abs(u - lastHoverU) > 0.0006) {
    lastHoverU = u;
    const n = performance.now();
    if (n - lastRay > 66) { lastRay = n; castHover(); }
    else hoverDirty = true;
  }

  if (hoverDirty) {
    hoverDirty = false;
    castHover();
  }
  positionTip();
}

/* ═══════════════════════ DOT NAV ═══════════════════════ */
const dotsEl = document.getElementById('dots');
const dotBtns = CHAPTERS.map((ch, i) => {
  const b = document.createElement('button');
  b.className = 'dot';
  b.setAttribute('aria-label', ch.label);
  b.innerHTML = `<span class="label">${ch.label}</span><span class="pip"></span>`;
  b.addEventListener('click', () => { command(ch.jump ?? (ch.u0 + ch.u1) / 2); });
  dotsEl.appendChild(b);
  return b;
});
document.getElementById('skipWork').addEventListener('click', () => { command(SNAP_STOPS[3]); });  /* exact Gobattle stop */
/* ── Guided-tour control ── */
const tourBtn = document.getElementById('tourBtn');
const TOUR_LABELS = { take: '\u25B6 Take the tour', resume: '\u25B6 Resume tour', stop: '\u25FC Stop tour' };
function setTourBtn(state) {
  if (!tourBtn) return;
  tourBtn.textContent = (tourFin && state !== 'stop') ? '↑ Back to the beginning' : TOUR_LABELS[state];
  tourBtn.classList.toggle('touring', state === 'stop');
}
function cancelTour() { if (tour) { tour = null; setTourBtn('resume'); } }
if (REDUCED) { if (tourBtn) tourBtn.remove(); }
else {
  tourBtn.addEventListener('click', () => { if (tour) cancelTour(); else if (tourFin) command(0); else startTour(); });
}
function updateDots(u) {
  let active = 0, best = 1e9;
  CHAPTERS.forEach((ch, i) => {
    const c = (ch.u0 + ch.u1) / 2, d = Math.abs(u - c);
    if (d < best) { best = d; active = i; }
  });
  dotBtns.forEach((b, i) => b.classList.toggle('active', i === active));
  /* context-aware controls: skip retires for good once the work chapter is behind you;
     the tour pill becomes a quiet way home at the finale */
  if (!skipGone && u > 0.67) { skipGone = true; skipBtnEl && skipBtnEl.classList.add('gone'); }
  const fin = u > 0.935;
  if (fin !== tourFin) {
    tourFin = fin;
    if (tourBtn && !tour) tourBtn.textContent = fin ? '↑ Back to the beginning' : TOUR_LABELS.start;
  }
}
let skipGone = false, tourFin = false;
const skipBtnEl = document.getElementById('skipWork');

/* ═══════════════════════ TIME OF DAY ═══════════════════════ */
const _ca = new THREE.Color(), _cb = new THREE.Color(), _va = new THREE.Vector3(), _vb = new THREE.Vector3();
function lerpCol(dst, a, b, t) { _ca.setHex(a); _cb.setHex(b); dst.copy(_ca).lerp(_cb, t); }
function applyTOD(u) {
  let i = 0;
  while (i < TOD.length - 2 && u > TOD[i + 1].u) i++;
  const a = TOD[i], b = TOD[i + 1];
  const t = smooth01((u - a.u) / (b.u - a.u));

  lerpCol(hemi.color, a.hemiSky, b.hemiSky, t);
  lerpCol(hemi.groundColor, a.hemiGnd, b.hemiGnd, t);
  hemi.intensity = lerp(a.hemiInt, b.hemiInt, t);
  lerpCol(dir.color, a.dirCol, b.dirCol, t);
  dir.intensity = lerp(a.dirInt, b.dirInt, t);
  if (ride) {   /* aloft at night the moonlight lifts a touch — ground reads, mood stays */
    const nb = smoothstep(0.80, 0.95, u);
    hemi.intensity += 0.26 * nb;
    dir.intensity += 0.12 * nb;
  }

  _va.fromArray(a.sun).normalize(); _vb.fromArray(b.sun).normalize();
  const sunDir = _va.lerp(_vb, t).normalize();
  dir.position.copy(sunDir).multiplyScalar(300);

  lerpCol(skyUniforms.uTop.value, a.top, b.top, t);
  lerpCol(skyUniforms.uHor.value, a.hor, b.hor, t);
  lerpCol(skyUniforms.uSunCol.value, a.sunCol, b.sunCol, t);
  skyUniforms.uGlow.value = lerp(a.glow, b.glow, t);
  skyUniforms.uSunDir.value.copy(sunDir);
  lerpCol(skyUniforms.uSea.value, a.fog, b.fog, t);   // dome sea matches fogged ocean → seamless horizon
  skyUniforms.uSea.value.lerp(waterUniforms.uDeep.value, 0.35);
  farSeaMat.color.copy(waterUniforms.uDeep.value);

  lerpCol(waterUniforms.uDeep.value, a.deep, b.deep, t);
  lerpCol(waterUniforms.uShallow.value, a.shal, b.shal, t);
  lerpCol(waterUniforms.uSunCol.value, a.sunCol, b.sunCol, t);
  lerpCol(waterUniforms.uHor.value, a.hor, b.hor, t);
  waterUniforms.uSunDir.value.copy(sunDir);
  waterUniforms.uGlitter.value = lerp(a.glow, b.glow, t);
  waterUniforms.uMoonPath.value = smooth01((u - 0.85) / 0.1) * 0.85 * (sail ? 0.4 : 1);   /* dampen the coarse glitter plates while sailing */

  lerpCol(scene.fog.color, a.fog, b.fog, t);
  scene.fog.color.lerp(waterUniforms.uDeep.value, 0.18);   // pull horizon haze toward the sea, not white

  /* sun / moon discs */
  const sunVis = 1 - smoothstep(0.80, 0.92, u);
  const moonVis = smoothstep(0.80, 0.95, u);
  sunDisc.material.opacity = sunVis;
  sunDisc.visible = sunVis > 0.01;
  sunDisc.position.copy(camera.position).addScaledVector(sunDir, 950);
  sunDisc.lookAt(camera.position);
  lerpCol(sunDisc.material.color, a.sunCol, b.sunCol, t);
  moonDisc.visible = moonVis > 0.01;
  moonDisc.position.copy(camera.position).addScaledVector(moonDir, 950);
  moonDisc.lookAt(camera.position);
  const md = moonDisc.userData;
  /* at the finale the moon is an interactable — a whisper of idle breathing, a touch more under the pointer */
  const mLive = !REDUCED && current > 0.958;
  const inviteP = (constArmed && !REDUCED) ? 0.35 * Math.sin(Math.PI * Math.min(1, Math.max(0, (constClock - 3.1) / 2.4))) : 0;   /* one slow extra pulse while its label lands */
  const mPulse = mLive ? 1 + 0.06 * Math.sin(lastWorldT * 1.5) + (hoverId === 'moon' ? 0.18 : 0) + inviteP : 1;
  md.baseM.opacity = moonVis;
  md.mariaM.opacity = 0.5 * moonVis;
  md.haloM.uniforms.uOp.value = moonVis * mPulse;
  /* occasional wisp of night cloud drifting across the moon */
  let wOn = false;
  if (!REDUCED && moonVis > 0.5) {
    const ph = (lastWorldT % 57) / 57;
    if (ph < 0.36) {
      const k = ph / 0.36;
      md.wisp.position.x = lerp(-64, 64, k);
      const fade = smooth01(k / 0.16) * (1 - smooth01((k - 0.84) / 0.16));
      md.wispM.uniforms.uOp.value = 0.3 * fade * moonVis;
      md.wispM.uniforms.uSilver.value = Math.exp(-Math.pow(md.wisp.position.x / 26, 2));
      wOn = md.wispM.uniforms.uOp.value > 0.004;
    }
  }
  md.wisp.visible = wOn;
}

/* ═══════════════════════ SOUND — system + ambient beds ═══════════════════════
   Zero audio files — every bed and tone is synthesized (filtered noise, FM, AM). Off by
   default; whisper mixing; ≥300ms fades everywhere; ±5–10% jitter on every repeat. */
const sndBtnEl = document.getElementById('sndBtn');
const SND = { on: false, ctx: null, master: null, amb: null, fx: null, ui: null,
  pending: sessionStorage.getItem('cv_snd') !== '0',
  duck: 1, beds: [], fires: [], nbuf: null, inputSeen: false, swellDone: false, card: false, settled: false, hull: null, hullOn: false };
const _sndV = new THREE.Vector3();
function sndPanOf(obj) {   /* stereo position of a world object from the current camera */
  if (!obj) return 0;
  obj.getWorldPosition(_sndV).project(camera);
  return Math.max(-0.75, Math.min(0.75, _sndV.x * 0.9));
}
const sJit = (v, p = 0.08) => v * (1 + (Math.random() * 2 - 1) * p);
const sndLast = {};
function sndAllow(id, gap = 1000) { const t = performance.now(); if (sndLast[id] && t - sndLast[id] < gap) return false; sndLast[id] = t; return true; }
function sndRamp(param, v, d = 0.35) { const t = SND.ctx.currentTime; param.cancelScheduledValues(t); param.setTargetAtTime(v, t, Math.max(0.05, d / 3)); }
function sndNoise() {   /* shared 2s pink-ish loop — one buffer feeds every noise voice */
  if (SND.nbuf) return SND.nbuf;
  const sr = SND.ctx.sampleRate, n = sr * 2, b = SND.ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lp += 0.015 * (w - lp); d[i] = w * 0.22 + lp * 2.4; }
  SND.nbuf = b; return b;
}
function sndSrc(rate = 1) { const s = SND.ctx.createBufferSource(); s.buffer = sndNoise(); s.loop = true; s.playbackRate.value = rate; s.start(); return s; }
/* one-shot pitched tone: optional glide (f→f1), optional lowpass, exp-ish decay */
function sTone(dest, o) {
  const c = SND.ctx, t = c.currentTime + (o.at || 0), a = o.a ?? 0.012, d = o.d ?? 0.3;
  const os = c.createOscillator(); os.type = o.type || 'sine';
  os.frequency.setValueAtTime(Math.max(20, o.f), t);
  if (o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.gl || d * 0.7));
  const g = c.createGain(); g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.v, t + a);
  g.gain.setTargetAtTime(0, t + a + (o.h || 0), d / 4);
  let head = os;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); head = f; }
  head.connect(g);
  if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(dest); } else g.connect(dest);
  os.start(t); os.stop(t + a + (o.h || 0) + d * 2.5 + 0.2);
}
/* one-shot filtered-noise burst */
function sNoise(dest, o) {
  const c = SND.ctx, t = c.currentTime + (o.at || 0), a = o.a ?? 0.03, d = o.d ?? 0.3;
  const s = c.createBufferSource(); s.buffer = sndNoise(); s.loop = true; s.playbackRate.value = sJit(o.rate || 1, 0.1);
  const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 800, t); f.Q.value = o.Q ?? 1;
  if (o.freq1) f.frequency.setTargetAtTime(o.freq1, t, d / 3);
  const g = c.createGain(); g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.v, t + a);
  g.gain.setTargetAtTime(0, t + a + (o.h || 0), d / 4);
  s.connect(f); f.connect(g);
  if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(dest); } else g.connect(dest);
  s.start(t); s.stop(t + a + (o.h || 0) + d * 2.5 + 0.3);
}
/* beds: trapezoid gain windows over camU, crossfaded continuously while scrolling */
function mkBed(u0, u1, f = 0.035) {
  const g = SND.ctx.createGain(); g.gain.value = 0; g.connect(SND.amb);
  const bed = { u0, u1, f, g, w: 0, evs: [] };
  SND.beds.push(bed); return bed;
}
/* continuous filtered-noise layer inside a bed, with an organic random-walk swell */
function lyr(bed, type, freq, Q, base, swMin = 5, swMax = 11, swAmt = 0.3) {
  const f = SND.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
  const g = SND.ctx.createGain(); g.gain.value = base;
  sndSrc().connect(f); f.connect(g); g.connect(bed.g);
  bed.evs.push({ min: swMin * 1000, max: swMax * 1000, next: 0, fire() { sndRamp(g.gain, base * sJit(1, swAmt), 2.2); } });
  return g;
}
function ev(bed, min, max, fire) { bed.evs.push({ min: min * 1000, max: max * 1000, next: 0, fire }); }
/* — one-shot vocabulary (all reused by later batches) — */
function evBird(bed, close) { if (!sndAllow('bird', 2600)) return;   /* mourning-dove coos — morning birds re-voiced into the low-mid */
  const f0 = sJit(close ? 700 : 620, 0.08), v = (close ? 0.032 : 0.02) * sJit(1, 0.2);
  sTone(bed.g, { f: f0, a: 0.05, h: 0.1, d: 0.28, v, lp: 1000 });
  sTone(bed.g, { f: f0 * 0.82, a: 0.06, h: 0.16, d: 0.35, v: v * 0.85, at: sJit(0.5, 0.2), lp: 950 });
  if (Math.random() < 0.5) sTone(bed.g, { f: f0 * 0.78, a: 0.06, h: 0.1, d: 0.3, v: v * 0.6, at: sJit(0.95, 0.15), lp: 900 });
}
function evGull(bed) { if (!sndAllow('gull', 2500)) return;
  const f0 = sJit(1250, 0.12), v = 0.032 * sJit(1, 0.2);
  sTone(bed.g, { type: 'sawtooth', f: f0, f1: f0 * 0.55, gl: 0.42, lp: 1500, a: 0.05, d: 0.5, v });
  if (Math.random() < 0.45) sTone(bed.g, { type: 'sawtooth', f: f0 * 0.94, f1: f0 * 0.52, gl: 0.36, lp: 1400, a: 0.05, d: 0.42, v: v * 0.7, at: 0.55 });
}
function evChime(bed) { if (!sndAllow('chime', 3000)) return;
  const pent = [523.3, 587.3, 659.3, 784, 880], n = 1 + (Math.random() * 2.4 | 0);
  for (let i = 0; i < n; i++) { const f = pent[Math.random() * pent.length | 0] * sJit(1, 0.004);
    const at = i === 0 ? 0 : sJit(0.4 * i, 0.4), v = 0.024 * sJit(1, 0.25);
    sTone(bed.g, { f, a: 0.005, d: 1.6, v, at }); }
}
function evClink(bed) { if (!sndAllow('clink', 2400)) return;   /* rigging taps, kept under 2k */
  const f0 = sJit(1250, 0.14), v = 0.03 * sJit(1, 0.25);
  sTone(bed.g, { type: 'triangle', f: f0, a: 0.003, d: 0.13, v });
  sTone(bed.g, { type: 'triangle', f: f0 * 1.347, a: 0.003, d: 0.09, v: v * 0.55 });
  if (Math.random() < 0.35) { sTone(bed.g, { type: 'triangle', f: f0 * sJit(0.96, 0.03), a: 0.003, d: 0.1, v: v * 0.6, at: sJit(0.16, 0.3) }); }
}
function evCreak(bed, v = 0.035) { if (!sndAllow('creak', 2600)) return;
  const f0 = sJit(118, 0.18);
  sTone(bed.g, { type: 'sawtooth', f: f0, f1: f0 * 0.72, gl: 0.4, lp: 300, a: 0.09, d: 0.42, v: v * 0.55 });
  sNoise(bed.g, { type: 'lowpass', freq: 320, freq1: 190, a: 0.09, d: 0.4, v });
}
function evLap(bed, piling) { if (!sndAllow('lap', 1100)) return;
  const pan = piling ? (Math.random() * 2 - 1) * 0.5 : 0;
  sNoise(bed.g, { freq: sJit(piling ? 640 : 470, 0.2), Q: piling ? 2 : 1.1, a: piling ? 0.03 : 0.07,
    d: piling ? 0.22 : 0.38, v: (piling ? 0.05 : 0.045) * sJit(1, 0.25), pan });
}
function evFlutter(bed, canvas) { if (!sndAllow('flutter', 2200)) return;
  const n = 3 + (Math.random() * 3 | 0); let at = 0;
  for (let i = 0; i < n; i++) { at += sJit(canvas ? 0.16 : 0.1, 0.35);
    sNoise(bed.g, { freq: sJit(canvas ? 520 : 900, 0.2), Q: 0.8, a: 0.008, d: canvas ? 0.09 : 0.06, v: (canvas ? 0.042 : 0.028) * sJit(1, 0.3), at }); }
}
/* continuous fire: two slowed-noise crackle loops with offset loop points (no seam, no gap),
   panned to the source, occasional brighter pops jittered on top */
function mkFire(bed, obj, base, swell) {
  const c = SND.ctx, pan = c.createStereoPanner();
  const g = c.createGain(); g.gain.value = base;
  g.connect(pan); pan.connect(bed.g);
  for (const [rate, off, fq, q, lv] of [[0.29, 0, 1050, 1.8, 1], [0.43, 1.1, 800, 1.4, 0.8]]) {
    const s = c.createBufferSource(); s.buffer = sndNoise(); s.loop = true; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q;
    const lg = c.createGain(); lg.gain.value = lv;
    s.connect(f); f.connect(lg); lg.connect(g); s.start(c.currentTime, off);
  }
  const F = { g, pan, base, obj, swell, lastPan: 0, lastG: base };
  SND.fires.push(F);
  ev(bed, 1.6, 4.2, () => {
    const p = F.lastPan, n = 1 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) sNoise(bed.g, { type: 'bandpass', freq: 1100 + Math.random() * 500, Q: 1.4,
      a: 0.003, d: sJit(0.05, 0.4), v: 0.05 * sJit(1, 0.35), at: Math.random() * 0.5, pan: p });
    if (Math.random() < 0.25) sNoise(bed.g, { type: 'lowpass', freq: 220, a: 0.006, d: 0.12, v: 0.032 * sJit(1, 0.3), pan: p });   /* ember thud — noise, never a tone */
  });
}
function evOwl(bed) { if (!sndAllow('owl', 20000)) return;
  const f0 = sJit(335, 0.06), v = 0.045 * sJit(1, 0.15);
  sTone(bed.g, { f: f0, f1: f0 * 0.9, gl: 0.3, lp: 620, a: 0.07, h: 0.12, d: 0.4, v });
  sTone(bed.g, { f: f0 * 0.96, f1: f0 * 0.85, gl: 0.3, lp: 600, a: 0.07, h: 0.18, d: 0.5, v: v * 0.85, at: 0.62 });
}
/* — interactions & transitions — */
const CONST_NOTES = [392, 493.88, 587.33, 739.99];   /* Gmaj7 rise — EXEMPT from the high-cut, per spec */
const CONST_IDX = { 'c-github': 0, 'c-linkedin': 1, 'c-email': 2, 'c-resume': 3 };
function sndConstNote(i, k = 1) {
  if (!SND.on || !sndAllow('cnote' + i, 900)) return;
  const f = CONST_NOTES[i] * sJit(1, 0.003), v = 0.055 * k;
  sTone(SND.fx, { f, a: 0.02, d: 2.2, v });
  sTone(SND.fx, { f: f * 2.76, a: 0.02, d: 1.1, v: v * 0.16 });
}
function sndSparkle() {
  for (let i = 0; i < 3; i++) sTone(SND.fx, { f: sJit(1900 + i * 500, 0.1), a: 0.008, d: 0.35, v: 0.012, at: i * 0.07, lp: 2600 });
}
const SND_BUILDINGS = new Set(['gobattle', 'umich', 'platepromos', 'mirai', 'stanford', 'berkeley', 'berkeley-hall', 'boathouse']);
function sndHover(id) {
  if (!SND.on || !id) return;
  if (id in CONST_IDX) { sndConstNote(CONST_IDX[id], 0.55); return; }
  if (!sndAllow('tick', 150)) return;
  /* kalimba/wood tap — single note, sharp attack, fast exp decay, no sweep: buildings knock low, props tap mid */
  const bldg = SND_BUILDINGS.has(id);
  sTone(SND.ui, { type: 'sine', f: (bldg ? 300 : 500) * sJit(1, 0.06), a: 0.005, d: bldg ? 0.13 : 0.11,
    v: (bldg ? 0.034 : 0.03) * sJit(1, 0.1), lp: bldg ? 900 : 1200 });
}
function sndClickFor(id) {
  if (!SND.on) return;
  if (id === 'bottle') { sndBottle(); return; }
  if (id in CONST_IDX) { sndConstNote(CONST_IDX[id], 1); sndSparkle(); return; }
  if (sndAllow('click', 1000)) sTone(SND.ui, { type: 'sine', f: sJit(420, 0.06), a: 0.005, d: 0.1, v: 0.048 * sJit(1, 0.1), lp: 1100 });   /* firmer wood tap, no sweep */
}
function sndBottle() {
  if (!sndAllow('bottle', 1200)) return;
  sTone(SND.fx, { f: 285, f1: 135, gl: 0.05, a: 0.004, d: 0.09, v: 0.065 });        /* cork pop */
  sNoise(SND.fx, { type: 'bandpass', freq: 900, Q: 0.8, a: 0.004, d: 0.045, v: 0.035 });
  sNoise(SND.fx, { type: 'bandpass', freq: 1100, Q: 0.7, a: 0.06, d: 0.35, v: 0.024, at: 0.14 });   /* paper, warm-voiced */
}
function sndHelmBoard() {
  if (!SND.on || !sndAllow('helmboard', 2000)) return;
  const f0 = sJit(95, 0.12);
  sTone(SND.fx, { type: 'sawtooth', f: f0, f1: f0 * 0.72, gl: 0.45, lp: 290, a: 0.1, d: 0.5, v: 0.045 });   /* rope-and-wood */
  sNoise(SND.fx, { type: 'lowpass', freq: 330, freq1: 190, a: 0.1, d: 0.45, v: 0.05 });
  sTone(SND.fx, { f: sJit(215, 0.1), f1: 150, gl: 0.06, a: 0.005, d: 0.11, v: 0.04, at: 0.34 });            /* knock */
  sTone(SND.fx, { type: 'sawtooth', f: f0 * 1.12, f1: f0 * 0.8, gl: 0.4, lp: 280, a: 0.09, d: 0.42, v: 0.032, at: 0.55 });
}
function sndMoonTone() {
  if (!SND.on || !sndAllow('moontone', 3000)) return;
  for (const [m, v] of [[1, 0.055], [1.5, 0.032], [2, 0.018]])
    sTone(SND.fx, { f: 220 * m * sJit(1, 0.002), a: 0.4, h: 0.4, d: 2.4, v, lp: 850 });
  setTimeout(() => sndBurner(), 1100);   /* …then the burner lights as the ride begins */
}
function sndBurner() {
  if (!SND.on || !sndAllow('burner', 3000)) return;
  sNoise(SND.fx, { type: 'lowpass', freq: 470, a: 0.25, h: 0.55, d: 0.6, v: 0.085 * sJit(1, 0.15) });
  sNoise(SND.fx, { type: 'bandpass', freq: sJit(900, 0.12), Q: 0.6, a: 0.25, h: 0.5, d: 0.55, v: 0.038 });
}
function sndWhoosh(dist) {   /* programmatic flights: airy filtered-noise swell scaled to distance */
  if (!SND.on || dist < 0.012 || !sndAllow('whoosh', 1000)) return;
  const dur = Math.min(2.2, 0.5 + dist * 2.4), v = Math.min(0.11, 0.04 + dist * 0.16);
  sNoise(SND.fx, { type: 'bandpass', freq: 300, freq1: sJit(760, 0.15), Q: 0.7, a: dur * 0.35, h: dur * 0.1, d: dur * 0.45, v });
}
function sndPaper(k) {   /* card slides in (k=1) / away (k=0.5) — rounded noise, no tonal sweep */
  if (!sndAllow('paper', 700)) return;
  sNoise(SND.ui, { type: 'bandpass', freq: 1000, Q: 0.6, a: 0.02, d: 0.24, v: 0.04 * k });
  sNoise(SND.ui, { type: 'lowpass', freq: 420, a: 0.015, d: 0.09, v: 0.018 * k, at: 0.02 });
}
function sndSettle() {   /* moment sound: the finale's warm settle — used nowhere else */
  for (const [f, v] of [[110, 0.05], [164.8, 0.032], [220, 0.02]])
    sTone(SND.fx, { f, a: 0.9, h: 0.4, d: 2.2, v, lp: 700 });
}
function sndBuild() {
  const C = window.AudioContext || window.webkitAudioContext;
  SND.ctx = new C();
  SND.master = SND.ctx.createGain(); SND.master.gain.value = 0;
  const warmth = SND.ctx.createBiquadFilter(); warmth.type = 'lowpass'; warmth.frequency.value = 7500; warmth.Q.value = 0.4;
  SND.master.connect(warmth); warmth.connect(SND.ctx.destination);   /* master warmth: rolls the synthetic sizzle off everything */
  SND.amb = SND.ctx.createGain(); SND.amb.gain.value = 0.32; SND.amb.connect(SND.master);
  SND.fx = SND.ctx.createGain(); SND.fx.gain.value = 0.5; SND.fx.connect(SND.master);
  SND.ui = SND.ctx.createGain(); SND.ui.gain.value = 0.35; SND.ui.connect(SND.master);
  /* — the nine beds — */
  const bluff = mkBed(-0.02, 0.15);            /* dawn hero: wind, distant surf, sparse birds */
  lyr(bluff, 'lowpass', 420, 0.5, 0.14, 4, 9, 0.35);
  lyr(bluff, 'bandpass', 230, 0.6, 0.1, 6, 11, 0.5);
  ev(bluff, 8, 22, () => evBird(bluff, false));
  const camp = mkBed(0.15, 0.26);              /* campsite: closer birds, creek murmur, leaf rustle */
  lyr(camp, 'bandpass', 950, 2.2, 0.1, 3, 6, 0.2);
  lyr(camp, 'lowpass', 380, 0.5, 0.07, 5, 9, 0.3);
  ev(camp, 8, 18, () => { if (sndAllow('stir', 3000)) sNoise(camp.g, { type: 'bandpass', freq: sJit(650, 0.15), Q: 0.8, a: 0.12, d: 0.5, v: 0.02 * sJit(1, 0.25) }); });   /* low foliage stir — no tones at the campsite */
  mkFire(camp, () => campFire && campFire.light, 0.042,
    (u) => 0.8 + 0.3 * (1 - Math.min(1, Math.abs(u - 0.195) / 0.04)));   /* campfire swells at its dwell */
  const falls = mkBed(0.09, 0.3, 0.06);        /* the bluff waterfall, swelling on approach */
  lyr(falls, 'lowpass', 1100, 0.4, 0.085, 6, 10, 0.15);
  const bh = mkBed(0.26, 0.4);                 /* boathouse: creek close, wood creaks, lapping */
  lyr(bh, 'bandpass', 640, 1.8, 0.13, 3, 6, 0.2);
  ev(bh, 1.8, 4.5, () => evLap(bh, false));
  ev(bh, 6, 16, () => evCreak(bh));
  const vil = mkBed(0.395, 0.69);              /* village: flag flutter, faint chime, distant gull */
  lyr(vil, 'lowpass', 480, 0.5, 0.08, 4, 8, 0.35);
  ev(vil, 3, 9, () => evFlutter(vil, false));
  ev(vil, 9, 25, () => evChime(vil));
  ev(vil, 8, 20, () => evGull(vil));
  const open = mkBed(0.68, 0.75, 0.03);        /* farewell + descent: open wind and gulls */
  lyr(open, 'lowpass', 420, 0.5, 0.15, 4, 8, 0.4);
  ev(open, 6, 15, () => evGull(open));
  const harb = mkBed(0.72, 0.875);             /* harbor: laps on pilings, rigging clink, gulls */
  lyr(harb, 'bandpass', 340, 0.8, 0.09, 5, 9, 0.3);
  ev(harb, 1.2, 3.5, () => evLap(harb, true));
  ev(harb, 4, 12, () => evClink(harb));
  ev(harb, 9, 22, () => evGull(harb));
  const sailout = mkBed(0.865, 0.945);         /* cast-off: wind swell, canvas */
  lyr(sailout, 'lowpass', 520, 0.5, 0.17, 3, 7, 0.45);
  ev(sailout, 4, 10, () => evFlutter(sailout, true));
  const fin = mkBed(0.94, 1.02);               /* finale: fire, slow hull waves, rare owl — warm and low */
  lyr(fin, 'lowpass', 240, 0.6, 0.05, 5, 9, 0.25);
  lyr(fin, 'lowpass', 480, 0.7, 0.045, 7, 12, 0.4);   /* soft wave-wash where the crickets used to sit */
  mkFire(fin, () => beachFire && beachFire.light, 0.06,
    (u) => 0.8 + 0.3 * smooth01((u - 0.96) / 0.035));   /* brazier crackle swells as the camera settles onto the deck */
  ev(fin, 2.5, 6, () => evLap(fin, false));
  ev(fin, 40, 90, () => evOwl(fin));
}
function sndSwell() {   /* moment sound: the dawn swell — used nowhere else */
  if (SND.swellDone) return; SND.swellDone = true;
  for (const [m, v] of [[1, 0.05], [1.5, 0.03], [2.02, 0.02]])
    sTone(SND.fx, { f: 164.8 * m, a: 1.1, h: 0.5, d: 1.6, v, lp: 900 });
  sNoise(SND.fx, { type: 'bandpass', freq: 300, Q: 0.6, a: 1.3, h: 0.3, d: 1.8, v: 0.05 });
}
function sndSetBtn() {
  const on = SND.on || SND.pending;
  sndBtnEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z"></path><path d="M16.2 9.2a4.1 4.1 0 0 1 0 5.6"></path>' + (on ? '' : '<line x1="3.5" y1="20.5" x2="20.5" y2="3.5"></line>') + '</svg>';
  sndBtnEl.classList.toggle('muted', !on);
  sndBtnEl.setAttribute('aria-pressed', String(on));
  sndBtnEl.classList.add('show');
}
sndSetBtn();
function sndEnable() {
  if (SND.on) return;
  if (!SND.ctx) sndBuild();
  SND.ctx.resume();
  SND.on = true; SND.pending = false;
  try { sessionStorage.setItem('cv_snd', '1'); } catch (e) {}
  sndRamp(SND.master.gain, 0.5, 0.9);
  sndSetBtn();
  if (camU < 0.06) sndSwell();   /* enabling at the bluff → the dawn swell greets you */
}
function sndDisable() {
  if (!SND.on) return;
  SND.on = false; SND.pending = false;
  try { sessionStorage.setItem('cv_snd', '0'); } catch (e) {}
  sndRamp(SND.master.gain, 0, 0.35);
  clearTimeout(sndDisable._t);
  sndDisable._t = setTimeout(() => { if (!SND.on && SND.ctx) SND.ctx.suspend(); }, 700);
  sndSetBtn();
}
sndBtnEl.addEventListener('click', () => ((SND.on || SND.pending) ? sndDisable() : sndEnable()));
function sndOnInput() {   /* sound is on by default — the first gesture is what browsers need to let it start */
  if (SND.pending && !SND.on) sndEnable();
}
if (SND.pending) {   /* wheel alone isn't a browser activation gesture — pointer/key arms it too */
  const arm = () => { removeEventListener('pointerdown', arm); removeEventListener('keydown', arm); if (SND.pending) sndEnable(); };
  addEventListener('pointerdown', arm); addEventListener('keydown', arm);
}
document.addEventListener('visibilitychange', () => {
  if (!SND.ctx) return;
  if (document.hidden) SND.ctx.suspend(); else if (SND.on) SND.ctx.resume();
});
function sndTick(now) {
  if (!SND.ctx || !SND.on) return;
  const u = camU;
  const cardOn = !!tipEntry || !!document.querySelector('.chapter.show .card:not(.pre)');   /* ducking: the world lowers its voice while a card is up */
  const duckT = cardOn ? 0.7 : 1;
  if (Math.abs(duckT - SND.duck) > 0.01) { SND.duck = duckT; sndRamp(SND.amb.gain, 0.32 * duckT, 0.5); }
  const bigCard = workHover != null || projHover != null;   /* paper-slide on card entry/exit */
  if (bigCard !== SND.card) { SND.card = bigCard; sndPaper(bigCard ? 1 : 0.5); }
  if (ride) { const cyc = lastWorldT % 6.4; if (cyc < 0.4 && sndAllow('burner', 4500)) sndBurner(); }   /* burner follows the visual flame cycle */
  /* helm mode: hull water scaled to speed, wake hiss, the odd deck creak under hard rudder */
  if (sail && sail.phase !== 'exit' && sail.phase !== 'blend') {
    if (!SND.hull) {
      const f = SND.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.2;
      const g = SND.ctx.createGain(); g.gain.value = 0; sndSrc().connect(f); f.connect(g); g.connect(SND.fx);
      SND.hull = g;
    }
    SND.hullOn = true;
    const spd = Math.hypot(sail.vx || 0, sail.vz || 0);
    sndRamp(SND.hull.gain, Math.min(0.16, 0.015 + spd * 0.022), 0.5);
    if (Math.abs(sail.rud || 0) > 0.5 && spd > 3 && sndAllow('deckcreak', 3500))
      sTone(SND.fx, { type: 'sawtooth', f: sJit(105, 0.15), f1: 78, gl: 0.4, lp: 280, a: 0.08, d: 0.4, v: 0.028 });
  } else if (SND.hullOn) { SND.hullOn = false; sndRamp(SND.hull.gain, 0, 0.5); }
  if (!SND.settled && u > 0.955 && !snap && !commandActive && Math.abs(target - current) < 0.002) { SND.settled = true; sndSettle(); }
  for (const F of SND.fires) {   /* fires: live pan to the source + designed swell */
    const o = F.obj(); if (!o) continue;
    const p = sndPanOf(o), gv = F.base * (F.swell ? F.swell(u) : 1);
    if (Math.abs(p - F.lastPan) > 0.02) { F.lastPan = p; sndRamp(F.pan.pan, p, 0.4); }
    if (Math.abs(gv - F.lastG) > 0.003) { F.lastG = gv; sndRamp(F.g.gain, gv, 0.6); }
  }
  for (const b of SND.beds) {
    const w = smooth01((u - b.u0) / b.f) * (1 - smooth01((u - b.u1) / b.f));
    if (Math.abs(w - b.w) > 0.015) { b.w = w; sndRamp(b.g.gain, w, 0.6); }
    for (const e of b.evs) {
      if (now >= e.next) { e.next = now + e.min + Math.random() * (e.max - e.min); if (b.w > 0.05 && e.next - now > 250) e.fire(); }
    }
  }
}
window.__sndDebug = { get on() { return SND.on; }, enable: sndEnable, disable: sndDisable, SND,
  beds: () => SND.beds.map((b) => ({ u0: b.u0, u1: b.u1, w: +b.w.toFixed(3) })) };

/* ═══════════════════════ MAIN LOOP ═══════════════════════ */
const hint = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
const showFps = location.search.includes('fps');
if (showFps) fpsEl.style.display = 'block';
let frames = 0, fpsTime = 0;
window.__fps = 0;
window.__journey = { get u() { return current; }, set u(v) { target = current = clamp01(v); camU = current; camV = 0; snap = null; commandActive = false; tick(performance.now(), 0); }, goTo(v) { target = clamp01(v); } };
window.__debug = { camera, camCurve, lookCurve, warp, terrainH, camPoints, lookPoints, scene };
window.__arrestDebug = {
  get visited() { return visited.slice(); },
  get latch() { return arrestLatch; },
  gain: arrestGain, gearAll, rb: regionBudget, markInput, nudge, tick,
  get state() { return { u: current, camU, camV, target, fling, budget, uVel, snap: snap ? snap.phase : null, cmd: commandActive }; },
  setU(v) { current = target = clamp01(v); camU = current; camV = 0; fling = 0; snap = null; uVel = 0; snapArmed = false; },
  setBudget(v) { budget = v; },
  setDry(v) { simDry = !!v; },
  reset() { for (const i of SIG_ARREST) visited[i] = false; arrestLatch = -1; restAt = -1; restT = 0; },
  visitAll() { for (let i = 0; i < visited.length; i++) visited[i] = true; arrestLatch = -1; },
};
window.__motionDebug = { get camU() { return camU; }, get camV() { return camV; }, startTour };

let rafId = null, lastT = performance.now();
function tick(now, dt) {
  sndTick(now);
  if (sail) {
    sailTick(now, Math.min(dt, 0.05));
    camU = current; camV = 0;        /* rides own the camera; the follower stays parked at the driver */
  } else if (ride) {
    rideTick(now, Math.min(dt, 0.05));
    camU = current; camV = 0;
  } else {
  const uBefore = current;
  /* fling momentum */
  if (Math.abs(fling) > 0.05 && !dragging) {
    nudge(fling * CONFIG.touchMultiplier / CONFIG.scrollLengthPx);
    lastDir = Math.sign(fling) || lastDir;
    fling *= 0.94;
  }

  if (snap) {
    /* single distance-shaped ease curve — begins and ends at zero acceleration */
    const k = clamp01((now - snap.t0) / (snap.dur * 1000));
    const k3 = k * k * k;
    current = clamp01(snap.from + snap.c1 * k + k3 * (snap.c3 + k * (snap.c4 + k * snap.c5)));
    target = current;
    if (k >= 1) {
      arriveAtStop(snap.to, commandActive);
      current = target = snap.to; snap = null; snapArmed = false; commandActive = false; uVel = 0;
    }
  } else {
    /* chase target with capped speed — flies fast, never teleports */
    const delta = target - current;
    const maxStep = camSpeed * dt;
    let step = delta * Math.min(1, CONFIG.followEase * dt);
    step = Math.max(-maxStep, Math.min(maxStep, step));
    current += step;

    /* idle rest-coast: when USER input goes quiet, hand the remaining travel to a
       velocity-matched glide into a canonical stop. Triggers while still moving (fling
       nearly spent) so the handoff is seamless; any new input cancels via markInput. */
    if (snapArmed && !commandActive && !dragging &&
        (now - lastInputT) > 150 && Math.abs(fling) < 4) {
      const dir = Math.abs(uVel) > 0.002 ? Math.sign(uVel) : lastDir;
      const near = SNAP_STOPS.reduce((a, b) => Math.abs(b - current) < Math.abs(a - current) ? b : a);
      if (Math.abs(near - current) <= 0.0015 && Math.abs(target - current) < 0.002) {
        current = near; target = near; fling = 0; snapArmed = false;   /* already at rest on a stop */
        arriveAtStop(near, false);
      } else {
        /* stop nearest to where the free scroll was heading. Small backward settles (≤0.02u)
           are allowed — a damped flick off a boat drifts back onto it — but a real scroll
           never coasts backwards a whole stop against travel. */
        let to = SNAP_STOPS.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
        if (dir > 0 && to < current - 0.02) to = snapStopFor(current, 1);
        if (dir < 0 && to > current + 0.02) to = snapStopFor(current, -1);
        /* B: first-visit arrest — an unvisited significant stop along the path catches the
           coast, pulling BACK onto it if a hard flick slightly overshot */
        if (dir) { const ai = arrestCatchIdx(current, to, dir); if (ai >= 0) to = SNAP_STOPS[ai]; }
        const dist = Math.abs(to - current);
        /* ~0.6s drift when already close, ~1.2s short hops, up to 2.4s for long glides */
        let dur = Math.min(2.4, Math.max(0.55, 0.55 + dist * 14));
        let v0 = uVel;
        if (v0 * (to - current) < 0) v0 = 0;                 /* never start by moving away */
        dur = Math.max(dur, Math.min(2.4, Math.abs(v0) * 2.2));   /* arriving hot → longer runway, no wiggle */
        const vMax = 2.5 * dist / dur;                       /* bound overshoot */
        v0 = Math.max(-vMax, Math.min(vMax, v0));
        snap = glide(to, v0, now, dur);
        target = to; fling = 0;
      }
    }
  }

  if (dt > 0) uVel += (((current - uBefore) / dt) - uVel) * Math.min(1, dt * 12);

  /* B: first-visit dwell — a stop's card held on screen at rest for ~1.5s marks it visited */
  if (dt > 0 && !dragging && Math.abs(uVel) < 0.02 && Math.abs(target - current) < 0.008) {
    let ni = -1, nd = 0.008;
    for (let i = 0; i < SNAP_STOPS.length; i++) { const d = Math.abs(SNAP_STOPS[i] - current); if (d < nd) { nd = d; ni = i; } }
    if (ni >= 0) {
      if (restAt !== ni) { restAt = ni; restT = 0; }
      restT += dt;
      if (restT > 1.5 && !visited[ni]) { visited[ni] = true; if (arrestLatch === ni) arrestLatch = -1; }
    } else { restAt = -1; restT = 0; }
  } else { restAt = -1; restT = 0; }

  tourTick(now);

  followTick(dt);                  /* stage 2: the camera follower chases the driver */

  if (simDry) return;

  const s = warp(camU);
  camera.position.copy(camCurve.getPoint(s));
  camera.lookAt(lookCurve.getPoint(s));
  }

  /* boathouse doors swing open, slow and weighty, across the approach segment — closed at the campsite, fully open by the skills dwell */
  if (boathouseDoors) {
    const ok = smoothstep(0.250, 0.294, camU);
    boathouseDoors.L.rotation.y = -ok * 1.6;
    boathouseDoors.R.rotation.y =  ok * 1.6;
  }

  if (!sail && !ride) {
  /* mouse parallax */
  pmx += (mx - pmx) * 0.06; pmy += (my - pmy) * 0.06;
  const rad = CONFIG.parallaxDeg * Math.PI / 180;
  camera.rotateY(-pmx * rad);
  camera.rotateX(-pmy * rad);
  /* standing on the finale deck: inherit the boat's swell, tilt up so the constellations get their moment */
  if (beachFire) {
    const dw = smooth01((camU - 0.90) / 0.07);
    if (dw > 0.001) {
      camera.rotateZ(beachFire.rock.rl * dw);
      camera.rotateX((beachFire.rock.pt + 0.12 * smooth01((camU - 0.952) / 0.048)) * dw);
      camera.position.y += beachFire.rock.hv * dw;
    }
  }
  }

  /* aspect-aware hero framing: portrait pulls back + pitches up to keep the sky-to-land ratio */
  const narrow = Math.max(0, 1 - (innerWidth / innerHeight) / 1.35);
  if (narrow > 0 && !ride) {
    const heroW = 1 - smooth01((camU - 0.06) / 0.06);
    if (heroW > 0) {
      camera.translateZ(15 * narrow * heroW);
      camera.rotateX(0.11 * narrow * heroW);
    }
  }

  /* the story ends first, always: offer the helm only once the finale has fully settled */
  if (!helmReady && !REDUCED && helmG && current > 0.958 && !snap && !commandActive && Math.abs(target - current) < 0.002) {
    helmReady = true;
    helmG.visible = true;
    helmG.scale.setScalar(0.05);                     // glow loop eases it up to full size
    if (glowById.helm) glowById.helm.emIdle = 0.07;
  }

  sky.position.copy(camera.position);
  waterUniforms.uTime.value = now / 1000;
  animateWorld(now / 1000);
  applyTOD(camU);
  updateDots(camU);
  overlayUpdate(camU);
  hint.classList.toggle('hidden', camU > 0.02);

  renderer.render(scene, camera);
  __framesRendered++;
}
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  tick(now, dt);

  frames++; fpsTime += dt;
  if (fpsTime >= 1) {
    window.__fps = Math.round(frames / fpsTime);
    if (showFps) fpsEl.textContent = window.__fps + ' fps';
    frames = 0; fpsTime = 0;
  }
}
frame(performance.now());  // paint immediately, even if RAF is throttled

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
  else if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(frame); }
});

/* ═══ cold-load hardening: resync + watchdog + reveal gate ═══ */
function hardResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  tick(performance.now(), 0);              /* re-render immediately at the correct size + pose */
}
addEventListener('resize', hardResize);
addEventListener('orientationchange', () => setTimeout(hardResize, 80));
if (window.visualViewport) visualViewport.addEventListener('resize', hardResize);
addEventListener('pageshow', (e) => {      /* bfcache restore must never leave a stale frame */
  if (!e.persisted) return;
  lastT = performance.now();
  if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame);
  hardResize();
});
setTimeout(() => {                          /* watchdog: a real frame must land shortly after init */
  if (__framesRendered < 2) {
    console.warn('[coastal-valley] watchdog: forcing a repaint');
    lastT = performance.now(); tick(lastT, 0);
    if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame);
  }
}, 2500);

window.__worldReady = true;
if (window.__loader) window.__loader.progress(0.92);
const gateT0 = performance.now();
let gateVW = -1, gateVH = -1, gateStable = 0;
function gateCheck(now) {
  const vv = window.visualViewport;
  const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
  if (vw === gateVW && vh === gateVH) gateStable++;
  else { gateStable = 0; gateVW = vw; gateVH = vh; hardResize(); }   /* address-bar settling → re-fit and re-render */
  const settled = __framesRendered >= 2 && gateStable >= 2 && current < 0.005;
  const floored = !window.__loaderT0 || (performance.now() - window.__loaderT0) >= 1000;   /* 1s floor: cached loads don't strobe */
  if ((settled && floored) || now - gateT0 > 12000) {
    gateLock = false;
    if (window.__loader) { window.__loader.progress(1); window.__loader.reveal(); }
    return true;
  }
  return false;
}
if (!__ogMode) (function gateLoop() { if (gateLock && !gateCheck(performance.now())) requestAnimationFrame(gateLoop); })();

/* ── ?capture=og: one 2400×1260 dawn-hero frame (world only — DOM text never bakes in) → og.jpg download ── */
function captureOG() {
  const W = 2400, H = 1260;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  const oldPR = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);                     /* backing store only — CSS size untouched */
  camera.aspect = W / H; camera.updateProjectionMatrix();
  skyUniforms.uDither.value = 1;                     /* soften sky gradient banding */
  tick(performance.now(), 0);
  canvas.toBlob((blob) => {
    renderer.setPixelRatio(oldPR);
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    skyUniforms.uDither.value = 0;
    lastT = performance.now(); rafId = requestAnimationFrame(frame);
    gateLock = false;
    if (!blob) { console.warn('[og] capture failed — canvas.toBlob returned null'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'og.jpg';
    document.body.appendChild(a); a.click(); a.remove();
    const img = document.createElement('img');
    img.src = url; img.alt = 'og preview';
    img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:70;';
    const toast = document.createElement('div');
    toast.textContent = 'og.jpg downloaded — 2400×1260 · right-click the preview to save manually if needed';
    toast.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:71;background:rgba(58,46,40,0.9);color:#FFFBF4;font:600 14px Nunito,sans-serif;padding:10px 18px;border-radius:999px;max-width:88vw;text-align:center;';
    document.body.appendChild(img); document.body.appendChild(toast);
  }, 'image/jpeg', 0.9);
}
if (__ogMode) setTimeout(captureOG, 800);
