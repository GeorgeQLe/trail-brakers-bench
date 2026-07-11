import * as THREE from './vendor/three.module.min.js';

/* ============================================================
   VOXEL GRAND PRIX — SILVERSTONE · Fable 5 bench entry
   Real GPS centerline (5,878 m), voxelised to a cube grid.
   ============================================================ */

// ---- Real Silverstone GP centerline, local meters, rotated so
//      index 0 = start/finish on the Hamilton straight. x=east, z=south.
const RAW = [[-381,259],[-365,238],[-349,217],[-333,196],[-316,174],[-300,153],[-284,132],[-267,111],[-251,90],[-233,70],[-210,58],[-183,54],[-157,56],[-130,60],[-104,64],[-78,67],[-51,70],[-24,68],[2,63],[26,53],[48,38],[69,21],[90,4],[111,-12],[132,-29],[153,-46],[174,-62],[196,-76],[221,-72],[234,-49],[241,-24],[249,2],[256,27],[275,45],[299,38],[312,15],[321,-11],[330,-36],[336,-62],[339,-88],[339,-115],[332,-140],[313,-159],[294,-177],[274,-195],[254,-213],[234,-231],[215,-249],[195,-267],[175,-285],[156,-303],[136,-321],[116,-339],[96,-357],[77,-375],[57,-393],[37,-411],[17,-429],[-2,-447],[-22,-465],[-42,-483],[-62,-501],[-81,-519],[-101,-537],[-121,-555],[-140,-573],[-164,-587],[-189,-593],[-216,-590],[-239,-577],[-251,-553],[-254,-527],[-257,-500],[-261,-474],[-275,-452],[-299,-441],[-325,-443],[-348,-455],[-362,-478],[-362,-504],[-353,-529],[-341,-553],[-329,-577],[-317,-601],[-305,-625],[-293,-649],[-277,-670],[-258,-689],[-239,-707],[-218,-724],[-195,-737],[-170,-747],[-144,-754],[-118,-757],[-91,-760],[-65,-762],[-38,-765],[-11,-767],[15,-770],[42,-772],[68,-775],[95,-777],[122,-779],[148,-782],[175,-784],[202,-786],[228,-788],[255,-791],[281,-789],[307,-783],[330,-769],[348,-749],[360,-726],[369,-700],[376,-675],[382,-649],[389,-623],[396,-597],[402,-571],[406,-545],[409,-518],[412,-492],[414,-465],[416,-438],[417,-412],[418,-385],[419,-358],[420,-331],[420,-305],[423,-278],[432,-253],[444,-229],[457,-206],[467,-181],[465,-155],[457,-129],[447,-104],[438,-79],[431,-54],[429,-27],[435,-1],[448,22],[464,44],[478,66],[484,92],[481,118],[467,140],[448,158],[425,173],[402,186],[379,200],[360,218],[346,241],[332,264],[320,287],[307,311],[295,335],[282,358],[269,381],[256,405],[244,428],[231,452],[218,475],[205,499],[193,522],[180,546],[167,569],[154,593],[142,616],[129,640],[116,663],[103,687],[91,710],[78,734],[65,757],[50,779],[36,802],[21,824],[7,847],[-8,869],[-24,890],[-43,909],[-67,920],[-93,923],[-120,919],[-144,908],[-163,889],[-176,866],[-187,842],[-199,818],[-212,795],[-227,773],[-244,752],[-261,731],[-279,712],[-298,692],[-316,673],[-333,652],[-350,632],[-367,611],[-385,591],[-409,591],[-429,608],[-451,623],[-475,614],[-494,595],[-511,574],[-524,551],[-533,526],[-540,500],[-540,474],[-527,451],[-511,429],[-495,408],[-479,386],[-463,365],[-446,344],[-430,323],[-414,302],[-398,280]];

const SCALE = 0.25;            // world units per meter
const CELL = 2;                // voxel grid cell (world units)
const HALF_W = 6;              // track half-width (world) => 48 m stylised
const M = 2048;                // arc-length samples around the lap

// Physics (meters, m/s)
const VMAX = 96, ALAT = 39, ABRK = 47;
const accOf = v => 14.5 * (1.05 - 0.7 * v / VMAX);

// Named corners: index into RAW (220 pts, evenly spaced)
const CORNERS = [
  { i: 9,   n: 'ABBEY' },
  { i: 17,  n: 'FARM CURVE' },
  { i: 27,  n: 'VILLAGE' },
  { i: 33,  n: 'THE LOOP' },
  { i: 39,  n: 'AINTREE' },
  { i: 53,  n: 'WELLINGTON STRAIGHT' },
  { i: 67,  n: 'BROOKLANDS' },
  { i: 76,  n: 'LUFFIELD' },
  { i: 89,  n: 'WOODCOTE' },
  { i: 110, n: 'COPSE' },
  { i: 131, n: 'MAGGOTTS' },
  { i: 139, n: 'BECKETTS' },
  { i: 146, n: 'CHAPEL' },
  { i: 165, n: 'HANGAR STRAIGHT' },
  { i: 183, n: 'STOWE' },
  { i: 200, n: 'VALE' },
  { i: 204, n: 'CLUB' },
];
const LABELED = ['ABBEY','THE LOOP','LUFFIELD','WOODCOTE','COPSE','MAGGOTTS','BECKETTS','HANGAR STRAIGHT','STOWE','CLUB','VILLAGE','BROOKLANDS'];

// ---------------------------------------------------------- utils
const hash2 = (x, z) => {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
const vnoise = (x, z) => { // cheap smooth value noise
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fmtTime = t => {
  if (t == null) return '—:——.———';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

// ---------------------------------------------------------- scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf2c9a0, 480, 1050);

const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 2400);

// sky dome (gradient dusk)
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#1c2f63');
  grad.addColorStop(0.42, '#4d6ba8');
  grad.addColorStop(0.72, '#d99a77');
  grad.addColorStop(0.88, '#f7c896');
  grad.addColorStop(1.00, '#f7c896');
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);
}

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a5a33, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
sun.position.set(-220, 260, 140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -280, right: 280, top: 280, bottom: -280, near: 40, far: 720 });
sun.shadow.bias = -0.0006;
scene.add(sun);

// ---------------------------------------------------------- track curve
const ctrl = RAW.map(p => new THREE.Vector3(p[0] * SCALE, 0, p[1] * SCALE));
const curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.5);
const L_WORLD = curve.getLength();
const L_M = L_WORLD / SCALE;                 // ≈ 5878 m
const dsM = L_M / M;

const pos = [], tan = [], nrm = [];
for (let i = 0; i < M; i++) {
  const u = i / M;
  pos.push(curve.getPointAt(u));
  const t = curve.getTangentAt(u); t.y = 0; t.normalize();
  tan.push(t);
  nrm.push(new THREE.Vector3(-t.z, 0, t.x)); // +N = driver's right
}

// signed curvature (1/m), smoothed
const kRaw = new Float32Array(M);
for (let i = 0; i < M; i++) {
  const a = tan[(i - 1 + M) % M], b = tan[(i + 1) % M];
  const cross = a.z * b.x - a.x * b.z;         // >0 = left turn
  const dot = THREE.MathUtils.clamp(a.x * b.x + a.z * b.z, -1, 1);
  kRaw[i] = Math.atan2(cross, dot) / (2 * dsM);
}
const kSm = new Float32Array(M);
for (let i = 0; i < M; i++) {
  let s = 0;
  for (let w = -6; w <= 6; w++) s += kRaw[(i + w + M) % M];
  kSm[i] = s / 13;
}

// speed profile: lateral-g limit + braking/traction passes
const vProf = new Float32Array(M);
for (let i = 0; i < M; i++) vProf[i] = Math.min(VMAX, Math.sqrt(ALAT / Math.max(Math.abs(kSm[i]), 1e-4)));
for (let r = 0; r < 3; r++) {
  for (let i = 2 * M; i >= 0; i--) { // braking (backward)
    const j = i % M, jn = (i + 1) % M;
    vProf[j] = Math.min(vProf[j], Math.sqrt(vProf[jn] * vProf[jn] + 2 * ABRK * dsM));
  }
  for (let i = 0; i <= 2 * M; i++) { // traction (forward)
    const j = i % M, jp = (i - 1 + M) % M;
    vProf[j] = Math.min(vProf[j], Math.sqrt(vProf[jp] * vProf[jp] + 2 * accOf(vProf[jp]) * dsM));
  }
}
let idealLap = 0;
for (let i = 0; i < M; i++) idealLap += dsM / vProf[i];

// ---------------------------------------------------------- voxel terrain
const key = (ix, iz) => ix + '|' + iz;
const trackCells = new Map();   // key -> {i, minOff}
for (let i = 0; i < M; i++) {
  for (let off = -HALF_W; off <= HALF_W + 0.01; off += 0.7) {
    const px = pos[i].x + nrm[i].x * off, pz = pos[i].z + nrm[i].z * off;
    const ix = Math.floor(px / CELL), iz = Math.floor(pz / CELL);
    const k2 = key(ix, iz), a = Math.abs(off);
    const c = trackCells.get(k2);
    if (!c) trackCells.set(k2, { i, minOff: a });
    else if (a < c.minOff) { c.minOff = a; c.i = i; }
  }
}
// kerb cells just outside apex zones
const kerbCells = new Map();    // key -> stripe 0|1
const KERB_K = 1 / 120;
for (let i = 0; i < M; i++) {
  if (Math.abs(kSm[i]) < KERB_K) continue;
  for (const side of [1, -1]) {
    for (const off of [HALF_W + 1.0, HALF_W + 1.9]) {
      const px = pos[i].x + nrm[i].x * off * side, pz = pos[i].z + nrm[i].z * off * side;
      const ix = Math.floor(px / CELL), iz = Math.floor(pz / CELL);
      const k2 = key(ix, iz);
      if (!trackCells.has(k2) && !kerbCells.has(k2)) kerbCells.set(k2, Math.floor(i * dsM / 4.2) % 2);
    }
  }
}

// nearest-sample spatial hash (for gravel + island falloff)
const SH = 10, shash = new Map();
for (let i = 0; i < M; i++) {
  const k2 = key(Math.floor(pos[i].x / SH), Math.floor(pos[i].z / SH));
  (shash.get(k2) || shash.set(k2, []).get(k2)).push(i);
}
function nearest(px, pz) {
  const cx = Math.floor(px / SH), cz = Math.floor(pz / SH);
  let best = -1, bd = Infinity;
  for (let r = 0; r <= 8; r++) {
    for (let ax = cx - r; ax <= cx + r; ax++) for (let az = cz - r; az <= cz + r; az++) {
      if (r > 0 && Math.abs(ax - cx) !== r && Math.abs(az - cz) !== r) continue;
      const arr = shash.get(key(ax, az));
      if (arr) for (const i of arr) {
        const dx = pos[i].x - px, dz = pos[i].z - pz, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best >= 0 && r * SH >= Math.sqrt(bd) + SH) break; // farther rings can't beat this
  }
  return { i: Math.max(best, 0), d: best >= 0 ? Math.sqrt(bd) : 9e9 };
}
function insidePoly(px, pz) {
  let inside = false;
  for (let a = 0, b = RAW.length - 1; a < RAW.length; b = a++) {
    const xa = RAW[a][0] * SCALE, za = RAW[a][1] * SCALE, xb = RAW[b][0] * SCALE, zb = RAW[b][1] * SCALE;
    if ((za > pz) !== (zb > pz) && px < (xb - xa) * (pz - za) / (zb - za) + xa) inside = !inside;
  }
  return inside;
}

// gather every terrain voxel: {x,z,h,topY?,color}
const voxels = [];
const C = {
  asphalt: [0x3a3d44, 0x40434b, 0x35383f],
  edge: 0xd8d5cc, kerbR: 0xd2372e, kerbW: 0xe8e4da,
  grass: [0x4e8f34, 0x55983a, 0x468530, 0x5da043],
  gravel: [0xc9b283, 0xd4bf90], dirt: 0x6b4a2f, dirtDark: 0x53381f,
};
let minIX = 1e9, maxIX = -1e9, minIZ = 1e9, maxIZ = -1e9;
for (const k2 of trackCells.keys()) {
  const [ix, iz] = k2.split('|').map(Number);
  if (ix < minIX) minIX = ix; if (ix > maxIX) maxIX = ix;
  if (iz < minIZ) minIZ = iz; if (iz > maxIZ) maxIZ = iz;
}
const PAD = 22; // cells of countryside beyond track bbox
minIX -= PAD; maxIX += PAD; minIZ -= PAD; maxIZ += PAD;

const grassSet = new Set();
for (let ix = minIX; ix <= maxIX; ix++) {
  for (let iz = minIZ; iz <= maxIZ; iz++) {
    const k2 = key(ix, iz);
    const cx = (ix + 0.5) * CELL, cz = (iz + 0.5) * CELL;
    if (trackCells.has(k2)) {
      const c = trackCells.get(k2);
      let col;
      if (c.i < 4 || c.i > M - 2) col = ((ix + iz) & 1) ? 0xf2f0ea : 0x1c1d21;         // start/finish checkers
      else if (c.minOff > HALF_W - 1.1) col = C.edge;                                    // painted edge line
      else col = C.asphalt[Math.floor(hash2(ix, iz) * 3)];
      voxels.push({ x: cx, z: cz, h: 0.7, c: col });
      continue;
    }
    if (kerbCells.has(k2)) {
      voxels.push({ x: cx, z: cz, h: 0.82, c: kerbCells.get(k2) ? C.kerbR : C.kerbW });
      grassSet.add(k2); // treat as land for edge detection
      continue;
    }
    const nr = nearest(cx, cz);
    const islandR = 26 + 18 * vnoise(cx * 0.02, cz * 0.02);
    if (!(insidePoly(cx, cz) || nr.d < islandR)) continue;
    let col;
    if (nr.d < HALF_W * 1.0 + 9 && Math.abs(kSm[nr.i]) > 1 / 85 && !insidePoly(cx, cz))
      col = C.gravel[Math.floor(hash2(ix, iz) * 2)];                                     // gravel traps
    else {
      col = C.grass[Math.floor(hash2(ix * 3, iz * 7) * 4)];
      if (vnoise(cx * 0.045 + 9, cz * 0.045) > 0.62) col = 0x3f7a2a;                     // mowed patches
    }
    voxels.push({ x: cx, z: cz, h: 0.55 + hash2(ix, iz) * 0.1, c: col });
    grassSet.add(k2);
  }
}
// dirt cliff skirt on island boundary
const landHas = k2 => grassSet.has(k2) || trackCells.has(k2);
for (const k2 of grassSet) {
  const [ix, iz] = k2.split('|').map(Number);
  if (landHas(key(ix + 1, iz)) && landHas(key(ix - 1, iz)) && landHas(key(ix, iz + 1)) && landHas(key(ix, iz - 1))) continue;
  const cx = (ix + 0.5) * CELL, cz = (iz + 0.5) * CELL;
  voxels.push({ x: cx, z: cz, h: 3.2, yTop: 0, c: hash2(ix, iz) > 0.5 ? C.dirt : C.dirtDark });
}

// build the single terrain InstancedMesh
const box = new THREE.BoxGeometry(1, 1, 1);
const terrainMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
const terrain = new THREE.InstancedMesh(box, terrainMat, voxels.length);
terrain.receiveShadow = true;
{
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  voxels.forEach((v, i) => {
    const top = v.yTop !== undefined ? v.yTop : v.h;
    m4.makeScale(CELL, v.h, CELL);
    m4.setPosition(v.x, top - v.h / 2, v.z);
    terrain.setMatrixAt(i, m4);
    terrain.setColorAt(i, col.setHex(v.c));
  });
  terrain.instanceColor.needsUpdate = true;
}
scene.add(terrain);

// ---------------------------------------------------------- decor blocks (2nd instanced mesh, casts shadows)
const blocks = []; // {x,y,z,sx,sy,sz,c,ry?}
const addBlock = (x, y, z, sx, sy, sz, c, ry = 0) => blocks.push({ x, y, z, sx, sy, sz, c, ry });
const occupied = [];

const uOf = idx => ((idx % RAW.length) + RAW.length) % RAW.length / RAW.length;
const pAt = u => curve.getPointAt(u);
const tAt = u => { const t = curve.getTangentAt(u); t.y = 0; return t.normalize(); };
const nAt = u => { const t = tAt(u); return new THREE.Vector3(-t.z, 0, t.x); };

function grandstand(u, side, len) {
  const p = pAt(u), n = nAt(u).multiplyScalar(side), t = tAt(u);
  const ry = Math.atan2(t.x, t.z);
  const base = p.clone().addScaledVector(n, HALF_W + 8.5);
  occupied.push({ x: base.x, z: base.z, r: len * 0.7 });
  const seat = [0xd23c32, 0xe8e4da, 0x2f6fb1, 0xe0a13a];
  for (let r = 0; r < 4; r++) {
    const off = HALF_W + 6.5 + r * 1.7;
    const q = p.clone().addScaledVector(n.clone().normalize(), off);
    for (let sgm = 0; sgm < Math.floor(len / 2.2); sgm++) {
      const along = (sgm - Math.floor(len / 2.2) / 2) * 2.2;
      addBlock(q.x + t.x * along, 0.9 + r * 0.85, q.z + t.z * along,
        2.0, 0.85, 1.6, seat[Math.floor(hash2(sgm * 13, r * 7) * 4)], ry);
    }
  }
  // roof
  const q = p.clone().addScaledVector(n.clone().normalize(), HALF_W + 9.2);
  addBlock(q.x, 5.6, q.z, len * 1.02, 0.5, 9.5, 0xf4f2ec, ry);
  for (const e of [-1, 1]) {
    const q2 = p.clone().addScaledVector(n.clone().normalize(), HALF_W + 12.5);
    addBlock(q2.x + t.x * e * len * 0.46, 2.6, q2.z + t.z * e * len * 0.46, 0.7, 5.6, 0.7, 0x9aa0a8, ry);
  }
}
function tree(x, z) {
  const s = 0.8 + hash2(x, z) * 0.7;
  addBlock(x, 1.1 * s, z, 0.8 * s, 2.2 * s, 0.8 * s, 0x6b4a2f);
  const g = [0x2f6a26, 0x387a2c, 0x2a5f22][Math.floor(hash2(x * 2, z * 3) * 3)];
  addBlock(x, 2.9 * s, z, 2.8 * s, 2.4 * s, 2.8 * s, g);
  addBlock(x, 4.4 * s, z, 1.8 * s, 1.2 * s, 1.8 * s, g);
}

// The Wing — pit building along the Hamilton straight (driver's right)
{
  const u = uOf(215.5), p = pAt(u), t = tAt(u), n = nAt(u);
  const ry = Math.atan2(t.x, t.z);
  const b = p.clone().addScaledVector(n, HALF_W + 12);
  occupied.push({ x: b.x, z: b.z, r: 60 });
  addBlock(b.x, 2.6, b.z, 8, 5.2, 86, 0xe9e6df, ry);          // main hall
  addBlock(b.x, 5.6, b.z, 9.5, 1.0, 92, 0xcfd3d8, ry);        // roof blade
  addBlock(b.x - n.x * 4.4, 1.7, b.z - n.z * 4.4, 1.2, 3.4, 86, 0x2b6fa8, ry); // glass band facing track
  for (let i = -4; i <= 4; i++)                                // garage doors
    addBlock(b.x - n.x * 4.9 + t.x * i * 9, 0.9, b.z - n.z * 4.9 + t.z * i * 9, 0.5, 1.8, 4.5, 0x22242a, ry);
}
// grandstands at the famous corners (outside of each)
grandstand(uOf(217.5), -1, 46);   // Hamilton straight main stand
grandstand(uOf(110), -1, 34);     // Copse
grandstand(uOf(183), -1, 40);     // Stowe
grandstand(uOf(204.5), -1, 30);   // Club
grandstand(uOf(76), -1, 30);      // Luffield
grandstand(uOf(33), 1, 26);       // The Loop outer

// start gantry + lights
const lightMats = [];
{
  const u = 4 / M, p = pAt(u), t = tAt(u), n = nAt(u);
  const ry = Math.atan2(t.x, t.z);
  for (const s of [-1, 1]) {
    const q = p.clone().addScaledVector(n, s * (HALF_W + 3.4));
    addBlock(q.x, 4.5, q.z, 1.1, 9, 1.1, 0x2a2c31, ry);
  }
  addBlock(p.x, 9.2, p.z, 1.2, 1.2, (HALF_W + 4) * 2, 0x2a2c31, ry);
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 2.6;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1417, roughness: 0.5, emissive: 0x000000 });
    lightMats.push(mat);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.9), mat);
    pod.position.set(p.x + n.x * off, 7.9, p.z + n.z * off);
    pod.rotation.y = ry;
    scene.add(pod);
  }
}
// trees around the countryside
{
  let placed = 0, guard = 0;
  while (placed < 170 && guard++ < 4000) {
    const x = (minIX + (maxIX - minIX) * hash2(guard * 1.7, 3.1)) * CELL;
    const z = (minIZ + (maxIZ - minIZ) * hash2(9.2, guard * 2.3)) * CELL;
    const nr = nearest(x, z);
    if (nr.d < HALF_W + 7) continue;
    const land = insidePoly(x, z) || nr.d < 26;
    if (!land) continue;
    if (occupied.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < o.r * o.r)) continue;
    tree(x, z); placed++;
  }
}
{
  const decorMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const decor = new THREE.InstancedMesh(box, decorMat, blocks.length);
  decor.castShadow = true; decor.receiveShadow = true;
  const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), col = new THREE.Color(), sc = new THREE.Vector3();
  blocks.forEach((b, i) => {
    q.setFromEuler(e.set(0, b.ry || 0, 0));
    m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, sc.set(b.sx, b.sy, b.sz));
    decor.setMatrixAt(i, m4);
    decor.setColorAt(i, col.setHex(b.c));
  });
  scene.add(decor);
}
// drifting voxel clouds
const clouds = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(hash2(i, 4) * 3);
  for (let j = 0; j < n; j++) {
    const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xfff4e8, roughness: 1, transparent: true, opacity: 0.8 }));
    m.scale.set(5 + hash2(i, j) * 7, 2 + hash2(j, i) * 1.4, 4 + hash2(i * 2, j) * 4);
    m.position.set((j - n / 2) * 4.5, hash2(j, i * 3) * 1.4, (hash2(i, j * 5) - 0.5) * 6);
    g.add(m);
  }
  const ang = i / 5 * Math.PI * 2 + hash2(i, 8);
  g.position.set(Math.cos(ang) * (330 + hash2(i, 9) * 140), 190 + hash2(i, 2) * 60, Math.sin(ang) * (330 + hash2(i, 9) * 140));
  scene.add(g); clouds.push(g);
}
// floating corner labels
{
  for (const c of CORNERS) {
    if (!LABELED.includes(c.n)) continue;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.font = '600 52px "Chakra Petch", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(12,12,16,0.55)';
    const w = g.measureText(c.n).width + 44;
    g.beginPath(); g.roundRect((512 - w) / 2, 12, w, 72, 10); g.fill();
    g.fillStyle = '#fff'; g.fillText(c.n, 256, 50);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 }));
    const u = uOf(c.i), p = pAt(u), n = nAt(u);
    const side = kSm[Math.floor(u * M)] > 0 ? -1 : 1; // inside of the turn
    sp.position.copy(p).addScaledVector(n, side * 15);
    sp.position.y = 8.5;
    sp.scale.set(24, 4.5, 1);
    scene.add(sp);
  }
}

// ---------------------------------------------------------- the car
const car = new THREE.Group();
const carBody = new THREE.Group();
car.add(carBody);
const MAT = {
  green: new THREE.MeshStandardMaterial({ color: 0x0b5c38, roughness: 0.35, metalness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a93b, roughness: 0.35, metalness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 }),
};
const bx = (m, sx, sy, sz, x, y, z, parent = carBody) => {
  const mesh = new THREE.Mesh(box, m);
  mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};
// floor + nose (nose = +Z)
bx(MAT.dark, 2.5, 0.24, 5.8, 0, 0.42, 0.1);
bx(MAT.green, 1.6, 0.5, 1.5, 0, 0.72, 1.9);
bx(MAT.green, 1.05, 0.44, 1.3, 0, 0.7, 3.0);
bx(MAT.green, 0.62, 0.36, 1.0, 0, 0.66, 3.9);
bx(MAT.gold, 0.63, 0.3, 0.45, 0, 0.64, 4.55);
// front wing
bx(MAT.dark, 3.4, 0.14, 1.0, 0, 0.36, 4.35);
bx(MAT.gold, 3.2, 0.09, 0.4, 0, 0.52, 4.6);
bx(MAT.dark, 0.14, 0.5, 1.05, 1.68, 0.55, 4.35);
bx(MAT.dark, 0.14, 0.5, 1.05, -1.68, 0.55, 4.35);
// cockpit, halo, driver
bx(MAT.green, 1.55, 0.72, 2.3, 0, 0.9, 0.9);
bx(MAT.dark, 0.9, 0.3, 1.0, 0, 1.28, 1.35);
bx(MAT.white, 0.52, 0.46, 0.52, 0, 1.42, 0.55);         // helmet
bx(MAT.dark, 0.54, 0.16, 0.1, 0, 1.44, 0.83);           // visor
bx(MAT.gold, 0.2, 0.06, 0.5, 0, 1.66, 0.55);            // helmet stripe
bx(MAT.dark, 0.12, 0.5, 0.12, 0, 1.5, 1.5);             // halo pillar
bx(MAT.dark, 1.15, 0.13, 0.14, 0, 1.74, 1.05);          // halo front bar
bx(MAT.dark, 0.13, 0.13, 1.35, 0.56, 1.74, 0.45);
bx(MAT.dark, 0.13, 0.13, 1.35, -0.56, 1.74, 0.45);
// sidepods + engine cover
bx(MAT.green, 2.7, 0.62, 2.3, 0, 0.73, -0.5);
bx(MAT.dark, 2.72, 0.34, 0.3, 0, 0.72, 0.72);           // radiator intakes
bx(MAT.green, 0.62, 0.6, 2.7, 0, 1.2, -0.9);
bx(MAT.dark, 0.5, 0.34, 0.6, 0, 1.62, 0.0);             // airbox
bx(MAT.green, 1.7, 0.5, 1.5, 0, 0.72, -2.3);
// rear wing + diffuser
bx(MAT.dark, 0.16, 0.8, 0.16, 0, 1.3, -2.55);
bx(MAT.dark, 2.3, 0.13, 0.85, 0, 1.78, -2.6);
bx(MAT.gold, 2.3, 0.1, 0.4, 0, 1.98, -2.78);
bx(MAT.dark, 0.12, 0.95, 0.9, 1.12, 1.5, -2.6);
bx(MAT.dark, 0.12, 0.95, 0.9, -1.12, 1.5, -2.6);
bx(MAT.dark, 2.1, 0.3, 0.6, 0, 0.5, -2.95);
const rainLightMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0x000000 });
bx(rainLightMat, 0.2, 0.2, 0.12, 0, 1.05, -3.05);

// wheels (steer groups for fronts, spin on inner mesh)
const wheels = [], frontSteer = [];
function wheel(x, z, front) {
  const steer = new THREE.Group();
  steer.position.set(x, 0.78, z);
  const spin = new THREE.Mesh(box, MAT.tyre);
  spin.scale.set(front ? 0.72 : 0.95, 1.56, 1.56);
  spin.castShadow = true;
  const hub = new THREE.Mesh(box, MAT.gold);
  hub.scale.set((front ? 0.72 : 0.95) + 0.06, 0.62, 0.62);
  const wg = new THREE.Group();
  wg.add(spin); wg.add(hub);
  hub.matrixAutoUpdate = true;
  steer.add(wg);
  carBody.add(steer);
  wheels.push(wg);
  if (front) frontSteer.push(steer);
  return steer;
}
wheel(1.6, 2.35, true); wheel(-1.6, 2.35, true);
wheel(1.65, -1.85, false); wheel(-1.65, -1.85, false);
scene.add(car);

// tyre smoke pool
const smoke = [];
for (let i = 0; i < 34; i++) {
  const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0 }));
  m.visible = false; scene.add(m);
  smoke.push({ m, t: 1e9 });
}
let smokeClock = 0;

// ---------------------------------------------------------- camera rig
const CENTER = new THREE.Vector3((minIX + maxIX) / 2 * CELL, 0, (minIZ + maxIZ) / 2 * CELL);
const cam = { mode: 'orbit', az: 0.95, pol: 0.92, r: 430, lastTouch: performance.now() };
const chasePos = new THREE.Vector3(), chaseLook = new THREE.Vector3();
let tvIdx = 0;
const TV_POSTS = [];
for (let i = 0; i < 14; i++) {
  const u = i / 14, p = pAt(u).clone().addScaledVector(nAt(u), -(HALF_W + 30));
  p.y = 15; TV_POSTS.push({ u, p });
}
function applyOrbit() {
  camera.position.set(
    CENTER.x + cam.r * Math.sin(cam.pol) * Math.sin(cam.az),
    cam.r * Math.cos(cam.pol),
    CENTER.z + cam.r * Math.sin(cam.pol) * Math.cos(cam.az)
  );
  camera.lookAt(CENTER.x, 0, CENTER.z);
}
applyOrbit();
chasePos.copy(camera.position); chaseLook.copy(CENTER);

// pointer input
let dragging = false, px = 0, py = 0, pinch = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; cam.lastTouch = performance.now(); canvas.setPointerCapture(e.pointerId); });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => {
  if (!dragging) return;
  cam.lastTouch = performance.now();
  if (cam.mode !== 'orbit') setCam('orbit');
  cam.az -= (e.clientX - px) * 0.0055;
  cam.pol = THREE.MathUtils.clamp(cam.pol - (e.clientY - py) * 0.004, 0.14, 1.38);
  px = e.clientX; py = e.clientY;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.lastTouch = performance.now();
  if (cam.mode !== 'orbit') setCam('orbit');
  cam.r = THREE.MathUtils.clamp(cam.r * (1 + e.deltaY * 0.0012), 60, 620);
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) cam.r = THREE.MathUtils.clamp(cam.r * pinch / d, 60, 620);
    pinch = d;
  } else pinch = 0;
}, { passive: true });
canvas.addEventListener('touchend', () => pinch = 0);

// ---------------------------------------------------------- race state
const state = {
  running: true, phase: 'lights', phaseT: 0,
  s: 0, v: 0, lap: 0, lapT: 0, last: null, best: null, mult: 1,
};
function restart() {
  state.phase = 'lights'; state.phaseT = 0;
  state.s = 0; state.v = 0; state.lap = 0; state.lapT = 0; state.last = null;
  state.running = true;
  syncPlayUI();
}
const profAt = sM => {
  const f = (sM / L_M) * M, i = Math.floor(f) % M;
  return vProf[i] + (vProf[(i + 1) % M] - vProf[i]) * (f - Math.floor(f));
};

// ---------------------------------------------------------- HUD
const $ = id => document.getElementById(id);
const elLap = $('lap'), elTime = $('time'), elLast = $('last'), elBest = $('best'),
  elSpeed = $('speed'), elGear = $('gear'), elCorner = $('corner'), elPlay = $('btn-play');
function syncPlayUI() {
  elPlay.innerHTML = state.running ? '&#10073;&#10073;' : '&#9654;';
  elPlay.title = state.running ? 'Pause (Space)' : 'Play (Space)';
}
$('btn-restart').onclick = restart;
elPlay.onclick = () => { state.running = !state.running; syncPlayUI(); };
document.querySelectorAll('[data-mult]').forEach(b => b.onclick = () => {
  state.mult = +b.dataset.mult;
  document.querySelectorAll('[data-mult]').forEach(x => x.classList.toggle('on', x === b));
});
function setCam(mode) {
  cam.mode = mode;
  document.querySelectorAll('[data-cam]').forEach(x => x.classList.toggle('on', x.dataset.cam === mode));
}
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => setCam(b.dataset.cam));
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); elPlay.onclick(); }
  if (e.key === 'r' || e.key === 'R') restart();
  if (e.key === '1') setCam('orbit');
  if (e.key === '2') setCam('chase');
  if (e.key === '3') setCam('tv');
});

// minimap
{
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('map');
  const xs = RAW.map(p => p[0]), zs = RAW.map(p => p[1]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mnz = Math.min(...zs), mxz = Math.max(...zs);
  const S = Math.min(96 / (mxx - mnx), 116 / (mxz - mnz));
  const tx = p => 6 + (p[0] - mnx) * S, tz = p => 6 + (p[1] - mnz) * S;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M ' + RAW.map(p => `${tx(p).toFixed(1)} ${tz(p).toFixed(1)}`).join(' L ') + ' Z');
  svg.appendChild(path);
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '3.4'); dot.setAttribute('class', 'dot');
  svg.appendChild(dot);
  window.__mapDot = u => {
    const f = u * RAW.length, i = Math.floor(f) % RAW.length, j = (i + 1) % RAW.length, t = f - Math.floor(f);
    dot.setAttribute('cx', tx(RAW[i]) + (tx(RAW[j]) - tx(RAW[i])) * t);
    dot.setAttribute('cy', tz(RAW[i]) + (tz(RAW[j]) - tz(RAW[i])) * t);
  };
}
// corner flash
let cornerShown = '', cornerHideAt = 0;
const cornerU = CORNERS.map(c => ({ u: uOf(c.i), n: c.n }));
function updateCorner(u, now) {
  for (const c of cornerU) {
    let d = Math.abs(u - c.u); d = Math.min(d, 1 - d);
    if (d < 0.008) {
      if (cornerShown !== c.n) {
        cornerShown = c.n;
        elCorner.textContent = c.n;
        elCorner.classList.add('show');
      }
      cornerHideAt = now + 1400;
      return;
    }
  }
  if (now > cornerHideAt && cornerShown) { cornerShown = ''; elCorner.classList.remove('show'); }
}

// ---------------------------------------------------------- resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------- main loop
const up = new THREE.Vector3(0, 1, 0);
let prevT = performance.now(), prevV = 0;
$('ideal').textContent = fmtTime(idealLap);

function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min((now - prevT) / 1000, 0.05);
  prevT = now;
  const dt = rdt * state.mult;

  if (state.running) {
    if (state.phase === 'lights') {
      state.phaseT += rdt; // lights run in real time
      const lit = Math.min(5, Math.floor(state.phaseT / 0.72));
      lightMats.forEach((m, i) => m.emissive.setHex(i < lit ? 0xff0d00 : 0x000000));
      if (state.phaseT > 5 * 0.72 + 1.0) {
        lightMats.forEach(m => m.emissive.setHex(0x000000));
        state.phase = 'race'; state.lap = 1; state.lapT = 0;
      }
    } else {
      const target = profAt(state.s);
      state.v = Math.min(target, state.v + accOf(state.v) * dt);
      const s2 = state.s + state.v * dt;
      if (s2 >= L_M) {
        state.lap++;
        state.last = state.lapT + (L_M - state.s) / Math.max(state.v, 1);
        if (!state.best || state.last < state.best) state.best = state.last;
        state.lapT = -(s2 - L_M) / Math.max(state.v, 1);
      }
      state.s = s2 % L_M;
      state.lapT += dt;
    }
  }

  // --- place car
  const u = state.s / L_M;
  const f = u * M, i0 = Math.floor(f) % M, i1 = (i0 + 1) % M, ft = f - Math.floor(f);
  car.position.lerpVectors(pos[i0], pos[i1], ft);
  const tx = tan[i0].x + (tan[i1].x - tan[i0].x) * ft;
  const tz = tan[i0].z + (tan[i1].z - tan[i0].z) * ft;
  car.rotation.y = Math.atan2(tx, tz);

  const kHere = kSm[i0], kAhead = kSm[(i0 + Math.round(8 / dsM)) % M];
  const decel = (prevV - state.v) / Math.max(rdt, 1e-3);
  prevV = state.v;
  carBody.rotation.z = THREE.MathUtils.lerp(carBody.rotation.z, THREE.MathUtils.clamp(-kHere * state.v * state.v * 0.00045, -0.07, 0.07), 0.12);
  carBody.rotation.x = THREE.MathUtils.lerp(carBody.rotation.x, THREE.MathUtils.clamp(decel * 0.0012, -0.02, 0.035), 0.15);
  carBody.position.y = state.v > 2 ? Math.sin(now * 0.045) * 0.015 : 0;
  const steer = THREE.MathUtils.clamp(kAhead * 26, -0.4, 0.4);
  frontSteer.forEach(s => s.rotation.y = THREE.MathUtils.lerp(s.rotation.y, steer, 0.2));
  const wSpin = state.v * SCALE * dt / 0.78;
  wheels.forEach(w => w.rotation.x += wSpin);
  rainLightMat.emissive.setHex(decel > 6 && state.v > 5 ? 0xff2015 : 0x000000);

  // tyre smoke under heavy braking
  smokeClock -= rdt;
  if (decel > 10 && state.v > 25 && smokeClock <= 0 && state.running) {
    smokeClock = 0.05;
    for (const sx of [1.4, -1.4]) {
      const sm = smoke.find(s => s.t > 0.6);
      if (!sm) break;
      sm.t = 0;
      sm.m.visible = true;
      sm.m.position.copy(car.localToWorld(new THREE.Vector3(sx, 0.4, -2.0)));
    }
  }
  for (const s of smoke) {
    if (s.t > 0.6) { s.m.visible = false; continue; }
    s.t += rdt;
    const k = s.t / 0.6;
    s.m.scale.setScalar(0.5 + k * 2.0);
    s.m.position.y += rdt * 1.6;
    s.m.material.opacity = 0.4 * (1 - k);
  }

  // clouds drift
  for (const c of clouds) {
    c.position.x += rdt * 1.6;
    if (c.position.x > 500) c.position.x = -500;
  }

  // --- camera
  if (cam.mode === 'orbit') {
    if (now - cam.lastTouch > 6000) cam.az += rdt * 0.045;
    applyOrbit();
  } else if (cam.mode === 'chase') {
    const back = new THREE.Vector3(tx, 0, tz).normalize();
    chasePos.lerp(car.position.clone().addScaledVector(back, -13).addScaledVector(up, 4.6), 1 - Math.pow(0.0018, rdt));
    chaseLook.lerp(car.position.clone().addScaledVector(back, 3.5).addScaledVector(up, 1.2), 1 - Math.pow(0.0005, rdt));
    camera.position.copy(chasePos);
    camera.lookAt(chaseLook);
  } else { // tv
    let bi = tvIdx, bd = Infinity;
    TV_POSTS.forEach((p, idx) => {
      let d = Math.abs(u - p.u); d = Math.min(d, 1 - d);
      if (d < bd) { bd = d; bi = idx; }
    });
    let dCur = Math.abs(u - TV_POSTS[tvIdx].u); dCur = Math.min(dCur, 1 - dCur);
    if (bi !== tvIdx && dCur > 0.055) tvIdx = bi;
    camera.position.lerp(TV_POSTS[tvIdx].p, 1 - Math.pow(0.001, rdt));
    chaseLook.lerp(car.position.clone().addScaledVector(up, 1.2), 1 - Math.pow(0.0001, rdt));
    camera.lookAt(chaseLook);
  }

  // --- HUD
  elLap.textContent = state.phase === 'lights' ? '—' : state.lap;
  elTime.textContent = fmtTime(state.phase === 'lights' ? 0 : state.lapT);
  elLast.textContent = fmtTime(state.last);
  elBest.textContent = fmtTime(state.best);
  elSpeed.textContent = Math.round(state.v * 3.6);
  elGear.textContent = state.phase === 'lights' ? 'N' : Math.min(8, 1 + Math.floor(state.v * 3.6 / 42));
  window.__mapDot(u);
  updateCorner(u, now);

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
syncPlayUI();
window.__state = state; // debug/verification hook
