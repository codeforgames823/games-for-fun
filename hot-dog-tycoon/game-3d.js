// game-3d.js — First-person 3D overworld (Three.js)
// ----------------------------------------------------------------------
// Replaces the side-scroller overworld with a real 3D world the player
// walks around in. Reads/writes the existing global `state`, `BUILDING_DEFS`,
// `keys`, and bridges into the existing CSS-3D `enterInterior(id)` for
// building interiors (which are unchanged).
// ----------------------------------------------------------------------

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Bridge-in globals from game.js (regular script). They're attached to window
// in game.js's BOOT block.
const state = window.state;
const BUILDING_DEFS = window.BUILDING_DEFS;
const WORLD_WIDTH = window.WORLD_WIDTH;
const keys = window.keys;
const enterInterior = window.enterInterior;

// ---------- CONFIG ----------
const SCALE = 0.06;                  // 1 game pixel = 0.06 meters
const WORLD_LEN = WORLD_WIDTH * SCALE; // long axis (X) of the city
const ROAD_WIDTH = 12;
const SIDEWALK_WIDTH = 4;
const GRASS_DEPTH = 80;              // how far the world extends in Z each side
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.6;
const PLAYER_SPEED = 6.5;
const PLAYER_RUN_MULT = 1.6;
const ENTER_RANGE = 6;               // meters from a building's door to enter

// ---------- STATE ----------
const fpv = {
  active: false,
  initialized: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  buildings: [],     // [{ def, mesh, doorPos: Vector3, halfW, halfD }]
  npcs: [],          // [{ mesh, speed, dir }]
  sun: null,
  ambient: null,
  hemi: null,
  skyMat: null,
  fogColor: new THREE.Color(0x87ceeb),
  velocity: new THREE.Vector3(),
  nearestBuilding: null,
  enterPromptEl: null,
  hintEl: null,
  lockOverlayEl: null,
  crosshairEl: null,
  canvas: null,
  windowsTexCache: new Map(), // building id -> { day: Texture, night: Texture }
  litMaterials: [],            // wall materials whose emissive ramps at night
  signMaterials: [],           // storefront/transit signs that glow at night
  neonHalos: [],               // translucent halo planes behind neon signs
  marqueeBulbs: [],            // marquee bulb materials that twinkle at night
  streetlamps: [],             // { lampMat, haloMat } lamp posts along the road
};

// Expose so game.js can tell us when to start/stop and what to do per frame.
window.fpvOverworld = {
  init,
  show,
  hide,
  updateFrame,
  isActive: () => fpv.active,
  enterNearest,    // for game.js E-key bridge
  hasNearest: () => !!fpv.nearestBuilding,
};

// ---------- INIT ----------
function init() {
  if (fpv.initialized) return;
  fpv.initialized = true;

  fpv.canvas = document.getElementById('three-canvas');
  fpv.crosshairEl = document.getElementById('crosshair');
  fpv.hintEl = document.getElementById('fpvHint');
  fpv.lockOverlayEl = document.getElementById('lockOverlay');

  // Floating "Press E to enter ..." pill
  fpv.enterPromptEl = document.createElement('div');
  fpv.enterPromptEl.className = 'fpv-enter-prompt hidden';
  fpv.enterPromptEl.innerHTML = 'Press <kbd>E</kbd> to enter';
  document.getElementById('world').appendChild(fpv.enterPromptEl);

  fpv.scene = new THREE.Scene();
  fpv.scene.background = new THREE.Color(0x87ceeb);
  fpv.scene.fog = new THREE.Fog(0x87ceeb, 30, 280);

  fpv.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 600);
  fpv.camera.position.set(20, PLAYER_HEIGHT, 0);

  fpv.renderer = new THREE.WebGLRenderer({ canvas: fpv.canvas, antialias: true });
  fpv.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  resizeRenderer();

  // Lights
  fpv.ambient = new THREE.AmbientLight(0xffffff, 0.45);
  fpv.scene.add(fpv.ambient);

  fpv.hemi = new THREE.HemisphereLight(0xa6cfff, 0x4a7a3a, 0.55);
  fpv.scene.add(fpv.hemi);

  fpv.sun = new THREE.DirectionalLight(0xffffff, 1.1);
  fpv.sun.position.set(60, 120, 30);
  fpv.scene.add(fpv.sun);

  // Sky dome (large back-side sphere)
  const skyGeom = new THREE.SphereGeometry(450, 32, 16);
  fpv.skyMat = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    side: THREE.BackSide,
    fog: false,
  });
  fpv.scene.add(new THREE.Mesh(skyGeom, fpv.skyMat));

  buildGround();
  buildBuildings();
  buildNpcs();

  // Pointer lock controls
  fpv.controls = new PointerLockControls(fpv.camera, document.body);
  fpv.scene.add(fpv.controls.object);

  fpv.controls.addEventListener('lock', () => {
    fpv.lockOverlayEl.classList.add('hidden');
    fpv.hintEl.classList.remove('hidden');
  });
  fpv.controls.addEventListener('unlock', () => {
    if (fpv.active && !state.interiorBuildingId) {
      fpv.lockOverlayEl.classList.remove('hidden');
    }
    fpv.hintEl.classList.add('hidden');
  });

  fpv.lockOverlayEl.addEventListener('click', () => {
    if (fpv.active && !state.interiorBuildingId) fpv.controls.lock();
  });
  fpv.canvas.addEventListener('click', () => {
    if (fpv.active && !state.interiorBuildingId && !fpv.controls.isLocked) {
      fpv.controls.lock();
    }
  });

  // E to enter is handled by game.js; we expose enterNearest()

  window.addEventListener('resize', resizeRenderer);
}

function resizeRenderer() {
  if (!fpv.renderer) return;
  const w = window.innerWidth;
  // Reserve top HUD bar (~80px); the canvas fills the rest of .world
  const worldEl = document.getElementById('world');
  const h = worldEl ? worldEl.clientHeight : window.innerHeight - 80;
  fpv.renderer.setSize(w, h, false);
  fpv.camera.aspect = w / h;
  fpv.camera.updateProjectionMatrix();
}

// ---------- WORLD GEOMETRY ----------
function buildGround() {
  // Grass: a wide plane covering the entire world, behind/under everything
  const grassGeom = new THREE.PlaneGeometry(WORLD_LEN + 100, GRASS_DEPTH * 2 + 60);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5a8a3a });
  const grass = new THREE.Mesh(grassGeom, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(WORLD_LEN / 2, 0, 0);
  fpv.scene.add(grass);

  // Road (asphalt)
  const roadGeom = new THREE.PlaneGeometry(WORLD_LEN, ROAD_WIDTH);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const road = new THREE.Mesh(roadGeom, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(WORLD_LEN / 2, 0.02, 0);
  fpv.scene.add(road);

  // Center yellow dashes (just a long thin strip, simple)
  const dashCount = Math.floor(WORLD_LEN / 6);
  const dashGeom = new THREE.PlaneGeometry(3, 0.3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  for (let i = 0; i < dashCount; i++) {
    const d = new THREE.Mesh(dashGeom, dashMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(i * 6 + 3, 0.04, 0);
    fpv.scene.add(d);
  }

  // Two sidewalks (one on each side of road)
  for (const sign of [-1, +1]) {
    const swGeom = new THREE.PlaneGeometry(WORLD_LEN, SIDEWALK_WIDTH);
    const swMat = new THREE.MeshLambertMaterial({ color: 0xb6b6b6 });
    const sw = new THREE.Mesh(swGeom, swMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(WORLD_LEN / 2, 0.03, sign * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2));
    fpv.scene.add(sw);
  }
}

function buildBuildings() {
  // Place buildings on alternating sides of the road for a real street feel.
  // Even index -> north side (z<0), odd -> south side (z>0).
  BUILDING_DEFS.forEach((def, i) => {
    const w = (140 + def.windows[0] * 8) * SCALE;
    const h = def.height * SCALE;
    const d = ((def.depth || 90) + 30) * SCALE; // a bit deeper for visual mass
    const x = def.x * SCALE + w / 2;
    const sideSign = (i % 2 === 0) ? -1 : +1;
    const sideOffset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + d / 2 + 0.5;
    const z = sideSign * sideOffset;

    // ----- PARK: render as open green plot + trees instead of a box -----
    if (def.id === 'park') {
      buildPark(def, x, z, w, d);
      return;
    }

    const tex = makeBuildingTexture(def, false);
    const litTex = makeBuildingTexture(def, true);

    // Material per face: front/back use the windows texture; sides use it too;
    // top = roof color; bottom = unseen (just dark).
    const wallMat = new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: litTex,
      emissive: new THREE.Color(0x000000), // toggled at night via emissiveIntensity
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: shadeHex(def.color, 1.15) });
    const bottomMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // BoxGeometry materials order: +X,-X,+Y,-Y,+Z,-Z
    const mats = [
      wallMat, // +X (right side)
      wallMat, // -X (left side)
      roofMat, // +Y (top)
      bottomMat, // -Y (bottom)
      wallMat, // +Z (front, faces +Z direction)
      wallMat, // -Z (back)
    ];

    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mats);
    mesh.position.set(x, h / 2, z);
    fpv.scene.add(mesh);

    // Door: a small dark plane on the road-facing side
    const doorH = Math.min(2.4, h * 0.35);
    const doorW = 1.6;
    const doorGeom = new THREE.PlaneGeometry(doorW, doorH);
    const doorMat = new THREE.MeshBasicMaterial({ color: 0x2a1a08 });
    const door = new THREE.Mesh(doorGeom, doorMat);
    const facingZ = -sideSign; // door faces road
    door.position.set(x, doorH / 2 + 0.01, z + facingZ * (d / 2 + 0.02));
    door.rotation.y = sideSign === -1 ? Math.PI : 0; // face the road
    fpv.scene.add(door);

    // Floating name banner above door (always faces camera via Sprite)
    const nameSpr = makeTextSprite(def.icon + ' ' + def.name);
    nameSpr.position.set(x, h + 1.6, z + facingZ * (d / 2 + 0.05));
    nameSpr.visible = false;
    fpv.scene.add(nameSpr);

    fpv.buildings.push({
      def,
      mesh,
      doorPos: new THREE.Vector3(x, 0, z + facingZ * (d / 2 + 0.5)),
      enterPos: new THREE.Vector3(x, PLAYER_HEIGHT, z + facingZ * (d / 2 + 1.2)),
      halfW: w / 2,
      halfD: d / 2,
      x, z, w, d, h,
      sideSign,
      nameSprite: nameSpr,
      wallMat,
    });

    fpv.litMaterials.push(wallMat);
  });
}

// Park: open grass plot with low-poly trees, walk-through, still enterable.
function buildPark(def, x, z, w, d) {
  // Grass plot (slightly brighter than world grass so it reads as "the park")
  const plotGeom = new THREE.PlaneGeometry(w, d);
  const plotMat = new THREE.MeshLambertMaterial({ color: 0x7ab94a });
  const plot = new THREE.Mesh(plotGeom, plotMat);
  plot.rotation.x = -Math.PI / 2;
  plot.position.set(x, 0.05, z);
  fpv.scene.add(plot);

  // Curb: a thin lighter strip around the plot edge
  const curbMat = new THREE.MeshLambertMaterial({ color: 0xa6a6a6 });
  for (const [cw, cd, ox, oz] of [
    [w + 0.6, 0.4, 0, -d / 2 - 0.2],
    [w + 0.6, 0.4, 0,  d / 2 + 0.2],
    [0.4, d + 0.6, -w / 2 - 0.2, 0],
    [0.4, d + 0.6,  w / 2 + 0.2, 0],
  ]) {
    const cGeom = new THREE.PlaneGeometry(cw, cd);
    const c = new THREE.Mesh(cGeom, curbMat);
    c.rotation.x = -Math.PI / 2;
    c.position.set(x + ox, 0.06, z + oz);
    fpv.scene.add(c);
  }

  // Trees: scattered cone+cylinder; deterministic seed so layout is stable
  const seedRand = mulberry32(def.x);
  const treeCount = 7;
  for (let t = 0; t < treeCount; t++) {
    const tree = makeTree();
    const tx = x + (seedRand() - 0.5) * w * 0.78;
    const tz = z + (seedRand() - 0.5) * d * 0.78;
    tree.position.set(tx, 0, tz);
    tree.scale.setScalar(0.85 + seedRand() * 0.5);
    fpv.scene.add(tree);
  }

  // A picnic bench in the middle for flavor
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b3e1a });
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.5), benchMat);
  benchTop.position.set(x, 0.6, z);
  fpv.scene.add(benchTop);
  const legGeom = new THREE.BoxGeometry(0.1, 0.6, 0.5);
  for (const lx of [-1.0, 1.0]) {
    const leg = new THREE.Mesh(legGeom, benchMat);
    leg.position.set(x + lx, 0.3, z);
    fpv.scene.add(leg);
  }

  // Floating sign so you know it's enterable
  const nameSpr = makeTextSprite(def.icon + ' ' + def.name);
  nameSpr.position.set(x, 4.5, z);
  nameSpr.visible = false;
  fpv.scene.add(nameSpr);

  fpv.buildings.push({
    def,
    mesh: plot,
    doorPos: new THREE.Vector3(x, 0, z),
    enterPos: new THREE.Vector3(x, PLAYER_HEIGHT, z),
    halfW: w / 2,
    halfD: d / 2,
    x, z, w, d, h: 0.1,
    sideSign: 0,
    nameSprite: nameSpr,
    wallMat: null,
    walkable: true, // park is open ground; collidesAt() skips it
  });
}

function makeTree() {
  const tree = new THREE.Group();
  const trunkGeom = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b3e1a });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.8;
  tree.add(trunk);

  const folGeom = new THREE.ConeGeometry(1.3, 2.6, 8);
  const folMat = new THREE.MeshLambertMaterial({ color: 0x2f7a36 });
  const foliage = new THREE.Mesh(folGeom, folMat);
  foliage.position.y = 2.6;
  tree.add(foliage);

  const folGeom2 = new THREE.ConeGeometry(1.0, 1.6, 8);
  const foliage2 = new THREE.Mesh(folGeom2, folMat);
  foliage2.position.y = 3.6;
  tree.add(foliage2);

  return tree;
}

// Tiny seedable PRNG so park layout is the same every load (no jitter on save/resume).
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// BUILDING DECORATION HELPERS
// All helpers expect `group` rooted at building base (origin = building center,
// y=0 = ground). `sideSign` = -1 if building is on north (z<0), +1 if south.
// `facingZ` = -sideSign points from the building toward the road.
// ============================================================

// ---------- ROOFS ----------
function addPeakedRoof(group, w, d, h, color) {
  // Gabled (ridge) roof: 6 vertices, ridge runs along the X axis
  const ridgeH = Math.min(w, d) * 0.42;
  const ovr = 0.25; // overhang
  const positions = new Float32Array([
    -w/2 - ovr, 0, -d/2 - ovr,   w/2 + ovr, 0, -d/2 - ovr,
     w/2 + ovr, 0,  d/2 + ovr,  -w/2 - ovr, 0,  d/2 + ovr,
    -w/2 - ovr, ridgeH, 0,       w/2 + ovr, ridgeH, 0,
  ]);
  const indices = [
    0, 5, 1,  0, 4, 5,  // back slope (-z)
    3, 2, 5,  3, 5, 4,  // front slope (+z)
    0, 3, 4,            // left gable
    1, 5, 2,            // right gable
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 0.55) });
  const roof = new THREE.Mesh(geom, mat);
  roof.position.y = h;
  group.add(roof);

  // Chimney for residential vibe
  const chimMat = new THREE.MeshLambertMaterial({ color: 0x8a4a3a });
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), chimMat);
  chim.position.set(w * 0.25, h + ridgeH * 0.55, -d * 0.18);
  group.add(chim);
}

function addDome(group, radius, h, color) {
  // Drum (cylinder) base under the dome
  const drumMat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 0.9) });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.6, 24), drumMat);
  drum.position.y = h + 0.3;
  group.add(drum);

  const domeMat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 1.4) });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat
  );
  dome.position.y = h + 0.6;
  group.add(dome);

  // Gold finial
  const finialMat = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), finialMat);
  finialBall.position.y = h + 0.6 + radius + 0.3;
  group.add(finialBall);
  const finialRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), finialMat);
  finialRod.position.y = h + 0.6 + radius + 0.05;
  group.add(finialRod);
}

function addSpireRoof(group, w, d, h, color) {
  // Pyramid base + tall spire + finial
  addPeakedRoof(group, w, d, h, color);
  const ridgeH = Math.min(w, d) * 0.42;
  const spireH = Math.min(h * 0.6, 5.5);
  const spireMat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 1.15) });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.55, spireH, 12), spireMat);
  spire.position.y = h + ridgeH + spireH / 2;
  group.add(spire);

  const finialMat = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), finialMat);
  ball.position.y = h + ridgeH + spireH + 0.35;
  group.add(ball);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff7a59, side: THREE.DoubleSide })
  );
  flag.position.set(0.42, h + ridgeH + spireH + 0.55, 0);
  group.add(flag);
}

function addUmbrella(group, w, d, h, color) {
  // For tiny carts: a striped circular umbrella above
  const radius = Math.max(w, d) * 0.65;
  const umbMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const umbrella = new THREE.Mesh(new THREE.ConeGeometry(radius, 0.9, 16, 1, true), umbMat);
  umbrella.position.y = h + 0.9;
  group.add(umbrella);
  // Pole
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), poleMat);
  pole.position.y = h + 0.55;
  group.add(pole);
  // Finial ball
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffd23a })
  );
  ball.position.y = h + 1.4;
  group.add(ball);
}

function addParapet(group, w, d, h, color) {
  const parapetH = 0.4;
  const t = 0.18;
  const mat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 0.78) });
  const sides = [
    { w: w + t * 2, d: t,        x: 0,             z: -d / 2 - t / 2 },
    { w: w + t * 2, d: t,        x: 0,             z:  d / 2 + t / 2 },
    { w: t,         d: d,        x: -w / 2 - t / 2, z: 0 },
    { w: t,         d: d,        x:  w / 2 + t / 2, z: 0 },
  ];
  for (const s of sides) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, parapetH, s.d), mat);
    m.position.set(s.x, h + parapetH / 2, s.z);
    group.add(m);
  }
}

// ---------- ROOFTOP EQUIPMENT ----------
function addRoofAC(group, w, d, h) {
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const ac = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), acMat);
  ac.position.set(w * 0.22, h + 0.85, -d * 0.18);
  group.add(ac);
  const ventMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 8), ventMat);
  vent.position.set(w * 0.22, h + 1.4, -d * 0.18);
  group.add(vent);
  // Smaller box next to it
  const ac2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), acMat);
  ac2.position.set(w * 0.22 - 1.2, h + 0.7, -d * 0.18);
  group.add(ac2);
}

function addRoofAntenna(group, w, d, h) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const poleH = 3.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, poleH, 6), poleMat);
  pole.position.set(-w * 0.22, h + poleH / 2 + 0.5, d * 0.15);
  group.add(pole);
  // 3 horizontal cross bars
  for (const yo of [poleH * 0.35, poleH * 0.55, poleH * 0.78]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), poleMat);
    bar.position.set(-w * 0.22, h + yo + 0.5, d * 0.15);
    group.add(bar);
  }
  // Red blinking tip (tracked so it can pulse at night)
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), tipMat);
  tip.position.set(-w * 0.22, h + poleH + 0.5, d * 0.15);
  group.add(tip);
  fpv.marqueeBulbs.push(tipMat); // reuse the marquee twinkle path
}

// ---------- DOOR / FRAME / STEPS / AWNING / PLANTERS ----------
function addDoorAndFrame(group, doorW, doorH, d, sideSign) {
  const facingZ = -sideSign;
  const frontZ = facingZ * (d / 2 + 0.02);
  // Door frame plate (slightly larger, lighter color)
  const frameW = doorW + 0.5, frameH = doorH + 0.35;
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(frameW, frameH),
    new THREE.MeshLambertMaterial({ color: 0xeae6dc })
  );
  frame.position.set(0, frameH / 2 + 0.005, frontZ);
  frame.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(frame);
  // Door
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    new THREE.MeshBasicMaterial({ color: 0x2a1a08 })
  );
  door.position.set(0, doorH / 2 + 0.01, frontZ + facingZ * 0.005);
  door.rotation.y = frame.rotation.y;
  group.add(door);
  // Door handle (small gold dot)
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  handle.position.set(doorW * 0.35, doorH * 0.5, frontZ + facingZ * 0.02);
  group.add(handle);
}

function addSteps(group, doorW, d, sideSign) {
  const facingZ = -sideSign;
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  // Two stacked stairs for visible depth
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.8, 0.18, 0.7), stepMat);
  s1.position.set(0, 0.09, facingZ * (d / 2 + 0.35));
  group.add(s1);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.5, 0.18, 0.45), stepMat);
  s2.position.set(0, 0.27, facingZ * (d / 2 + 0.22));
  group.add(s2);
}

function addAwning(group, doorW, doorH, d, sideSign, color) {
  const facingZ = -sideSign;
  const awnW = doorW + 1.4, awnD = 1.0, awnH = 0.14;
  const awn = new THREE.Mesh(
    new THREE.BoxGeometry(awnW, awnH, awnD),
    new THREE.MeshLambertMaterial({ color })
  );
  awn.position.set(0, doorH + 0.45, facingZ * (d / 2 + awnD / 2));
  group.add(awn);
  // White scallop stripe along the front edge
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(awnW, 0.12, 0.05),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  stripe.position.set(0, doorH + 0.38, facingZ * (d / 2 + awnD));
  group.add(stripe);
  // Two support poles
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const sx of [-awnW * 0.45, awnW * 0.45]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, doorH + 0.5, 6), poleMat);
    p.position.set(sx, (doorH + 0.5) / 2, facingZ * (d / 2 + awnD - 0.05));
    group.add(p);
  }
}

function addPlanters(group, doorW, d, sideSign) {
  const facingZ = -sideSign;
  const potMat = new THREE.MeshLambertMaterial({ color: 0x6b3e1a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });
  for (const sx of [-(doorW + 0.9), (doorW + 0.9)]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.5, 10), potMat);
    pot.position.set(sx, 0.25, facingZ * (d / 2 + 0.3));
    group.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 6), leafMat);
    leaf.position.set(sx, 0.7, facingZ * (d / 2 + 0.3));
    group.add(leaf);
  }
}

// ---------- SIGNS ----------
function addPlateSign(group, def, w, h, d, sideSign) {
  const facingZ = -sideSign;
  const signW = Math.min(w * 0.78, 4.5);
  const signH = 0.7;
  const tex = makePlateSignTexture(def.icon + ' ' + def.name);
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(0x000000),
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.08), mat);
  const yPos = clamp(h * 0.45 + 0.6, 2.6, h - 0.5);
  sign.position.set(0, yPos, facingZ * (d / 2 + 0.05));
  sign.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(sign);
  // Mounting brackets
  const bMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const sx of [-signW * 0.38, signW * 0.38]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.18), bMat);
    b.position.set(sx, yPos - signH / 2 - 0.16, facingZ * (d / 2 + 0.09));
    group.add(b);
  }
  fpv.signMaterials.push(mat);
}

function makePlateSignTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#1a1208');
  grad.addColorStop(1, '#070504');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 506, 90);
  ctx.shadowColor = 'rgba(255,210,58,0.55)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffe680';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addNeonSign(group, def, w, h, d, sideSign, neonHex) {
  const facingZ = -sideSign;
  const signW = Math.min(w * 0.85, 5.2);
  const signH = 1.05;
  const tex = makeNeonSignTexture(def.icon + ' ' + def.name, neonHex);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.06), mat);
  const yPos = clamp(h * 0.5 + 0.6, 2.8, h - 0.6);
  sign.position.set(0, yPos, facingZ * (d / 2 + 0.06));
  sign.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(sign);
  // Halo plane behind for night glow (opacity ramps in updateDayNight)
  const haloMat = new THREE.MeshBasicMaterial({
    color: neonHex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(signW * 1.6, signH * 2.0), haloMat);
  halo.position.set(0, yPos, facingZ * (d / 2 + 0.04));
  halo.rotation.y = sign.rotation.y;
  group.add(halo);
  fpv.neonHalos.push(haloMat);
}

function makeNeonSignTexture(text, neonHex) {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 168;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 768, 168);
  const cstr = '#' + neonHex.toString(16).padStart(6, '0');
  // Glowing border tubes
  ctx.shadowColor = cstr;
  ctx.shadowBlur = 30;
  ctx.strokeStyle = cstr;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 748, 148);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.shadowBlur = 12;
  ctx.strokeRect(10, 10, 748, 148);
  // Glowing text
  ctx.shadowColor = cstr;
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 92);
  // Second pass for thicker glow
  ctx.shadowBlur = 16;
  ctx.fillStyle = cstr;
  ctx.fillText(text, 384, 92);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 384, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addSubwaySign(group, def, w, h, d, sideSign) {
  const facingZ = -sideSign;
  // Sunken stair entry (a dark hole next to the building)
  const hole = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.05, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x080808 })
  );
  hole.position.set(0, 0.07, facingZ * (d / 2 + 1.6));
  group.add(hole);
  // Curb around the hole
  const curbMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  for (const [cw, cd, ox, oz] of [
    [2.6, 0.18, 0,    facingZ * (d / 2 + 0.85)],
    [0.18, 1.6, -1.1, facingZ * (d / 2 + 1.6)],
    [0.18, 1.6,  1.1, facingZ * (d / 2 + 1.6)],
  ]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.3, cd), curbMat);
    c.position.set(ox, 0.15, oz);
    group.add(c);
  }
  // M sign on a pole
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), poleMat);
  pole.position.set(1.4, 1.4, facingZ * (d / 2 + 1.0));
  group.add(pole);
  const discTex = makeIconDiscTexture('M', '#1aa3ff');
  const discMat = new THREE.MeshLambertMaterial({
    map: discTex,
    emissiveMap: discTex,
    emissive: new THREE.Color(0x000000),
  });
  const disc = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.08), discMat);
  disc.position.set(1.4, 2.85, facingZ * (d / 2 + 1.0));
  group.add(disc);
  fpv.signMaterials.push(discMat);
  // Plate sign on the wall too
  addPlateSign(group, def, w, h, d, sideSign);
}

function makeIconDiscTexture(letter, bgHex) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addTickerSign(group, def, w, h, d, sideSign) {
  const facingZ = -sideSign;
  const signW = Math.min(w * 0.88, 5.4);
  const tex = makeTickerTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const ticker = new THREE.Mesh(new THREE.BoxGeometry(signW, 0.5, 0.08), mat);
  const yPos = clamp(h * 0.5 + 1.4, 3.0, h - 0.5);
  ticker.position.set(0, yPos, facingZ * (d / 2 + 0.06));
  ticker.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(ticker);
  // Plate sign below
  addPlateSign(group, def, w, h, d, sideSign);
}

function makeTickerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 1024, 96);
  ctx.font = 'bold 44px monospace';
  ctx.textBaseline = 'middle';
  const segments = ['BUN +2.4%', '🌭 +5.1%', 'KETCH -0.8%', 'MUST +3.2%', 'RELISH +1.7%'];
  let x = 16;
  for (const seg of segments) {
    ctx.fillStyle = seg.includes('+') ? '#34d399' : '#f87171';
    ctx.fillText(seg, x, 50);
    x += ctx.measureText(seg).width + 36;
    if (x > 1024) break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addRedCross(group, w, h, d, sideSign) {
  const facingZ = -sideSign;
  const yPos = clamp(h * 0.55, 2.6, h - 1.2);
  // White circle
  const bg = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  bg.position.set(0, yPos, facingZ * (d / 2 + 0.04));
  bg.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(bg);
  // Red cross
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.06), crossMat);
  v.position.set(0, yPos, facingZ * (d / 2 + 0.07));
  group.add(v);
  const hbar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 0.06), crossMat);
  hbar.position.set(0, yPos, facingZ * (d / 2 + 0.07));
  group.add(hbar);
}

// ---------- MARQUEE / COLUMNS / SMOKESTACK / TURRETS / TOWER / DECK ----------
function addMarqueeLights(group, w, d, h, sideSign) {
  const facingZ = -sideSign;
  const yPos = clamp(h * 0.42, 1.8, h - 1.5);
  const bulbCount = 16;
  // Top row (above sign)
  for (let i = 0; i < bulbCount; i++) {
    const t = (i / (bulbCount - 1)) - 0.5;
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe680 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bulbMat);
    b.position.set(t * Math.min(w * 0.9, 5.8), yPos + 1.0, facingZ * (d / 2 + 0.12));
    group.add(b);
    fpv.marqueeBulbs.push(bulbMat);
  }
}

function addColumns(group, w, d, h, sideSign) {
  const facingZ = -sideSign;
  const colH = clamp(h * 0.65, 3, 6);
  const colR = 0.24;
  const mat = new THREE.MeshLambertMaterial({ color: 0xeae6dc });
  const offsets = [-w * 0.32, -w * 0.1, w * 0.1, w * 0.32];
  const colsToBuild = w > 5 ? offsets : [offsets[0], offsets[3]];
  for (const ox of colsToBuild) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(colR, colR, colH, 14),
      mat
    );
    shaft.position.set(ox, colH / 2, facingZ * (d / 2 + 0.4));
    group.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(colR * 2.6, 0.22, colR * 2.6), mat);
    cap.position.set(ox, colH + 0.11, facingZ * (d / 2 + 0.4));
    group.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(colR * 2.6, 0.22, colR * 2.6), mat);
    base.position.set(ox, 0.11, facingZ * (d / 2 + 0.4));
    group.add(base);
  }
  // Triangular pediment
  const ped = makeTriangleMesh(colsToBuild[colsToBuild.length - 1] - colsToBuild[0] + colR * 4, 0.7, mat);
  ped.position.set((colsToBuild[colsToBuild.length - 1] + colsToBuild[0]) / 2,
                   colH + 0.22, facingZ * (d / 2 + 0.4));
  ped.rotation.y = sideSign === -1 ? Math.PI : 0;
  group.add(ped);
}

function makeTriangleMesh(baseW, height, mat) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -baseW / 2, 0, 0,   baseW / 2, 0, 0,   0, height, 0,
    -baseW / 2, 0, -0.3, baseW / 2, 0, -0.3, 0, height, -0.3,
  ]), 3));
  geom.setIndex([0, 1, 2,   3, 5, 4,   0, 2, 5,  0, 5, 3,   1, 4, 5,  1, 5, 2]);
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, mat);
}

function addSmokestack(group, w, d, h) {
  const stackH = 4.5;
  const stackMat = new THREE.MeshLambertMaterial({ color: 0x8a6a5a });
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xd6d6d6 });
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xb8b8b8, transparent: true, opacity: 0.55 });
  for (const ox of [-w * 0.22, w * 0.22]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, stackH, 14), stackMat);
    stack.position.set(ox, h + stackH / 2, -d * 0.25);
    group.add(stack);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), rimMat);
    rim.position.set(ox, h + stackH - 0.1, -d * 0.25);
    group.add(rim);
    // Three smoke puffs
    for (const [yo, scl, opa] of [[0.7, 1.0, 0.55], [1.6, 1.25, 0.4], [2.7, 1.5, 0.25]]) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.6 * scl, 12, 8),
        smokeMat.clone()
      );
      puff.material.opacity = opa;
      puff.position.set(ox + (Math.random() - 0.5) * 0.4, h + stackH + yo, -d * 0.25);
      group.add(puff);
    }
  }
}

function addTurrets(group, w, d, h, color) {
  const turretH = h * 0.4;
  const wallMat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 1.15) });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const flagMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  for (const [ox, oz] of [
    [-w * 0.45, -d * 0.45], [w * 0.45, -d * 0.45],
    [-w * 0.45,  d * 0.45], [w * 0.45,  d * 0.45],
  ]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, turretH, 14), wallMat);
    tower.position.set(ox, turretH / 2, oz);
    group.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.5, 14), roofMat);
    cap.position.set(ox, turretH + 0.75, oz);
    group.add(cap);
    // Flag pole + flag
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x222 })
    );
    pole.position.set(ox, turretH + 1.85, oz);
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), flagMat);
    flag.position.set(ox + 0.28, turretH + 1.95, oz);
    group.add(flag);
  }
}

function addControlTower(group, w, d, h, color) {
  const towerH = h + 4.5;
  const towerMat = new THREE.MeshLambertMaterial({ color: shadeHex(color, 0.8) });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, towerH, 14), towerMat);
  tower.position.set(w * 0.42, towerH / 2, -d * 0.32);
  group.add(tower);
  // Cabin disc
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x202028 });
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.05, 0.85, 16), cabinMat);
  cabin.position.set(w * 0.42, towerH + 0.43, -d * 0.32);
  group.add(cabin);
  // Glass band
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.85 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.27, 0.45, 16), glassMat);
  glass.position.set(w * 0.42, towerH + 0.4, -d * 0.32);
  group.add(glass);
  fpv.signMaterials.push(glassMat);
  // Antenna + red beacon
  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  ant.position.set(w * 0.42, towerH + 1.7, -d * 0.32);
  group.add(ant);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), beaconMat);
  beacon.position.set(w * 0.42, towerH + 2.55, -d * 0.32);
  group.add(beacon);
  fpv.marqueeBulbs.push(beaconMat);
}

function addObservationDeck(group, w, d, h) {
  // Bulge near top of tower
  const r = Math.max(w, d) * 0.55;
  const bulgeMat = new THREE.MeshLambertMaterial({
    color: 0x4a3a2a,
    emissive: new THREE.Color(0xffd23a),
    emissiveIntensity: 0,
  });
  const bulge = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.0, 20), bulgeMat);
  bulge.position.set(0, h * 0.82, 0);
  group.add(bulge);
  fpv.signMaterials.push(bulgeMat);
  // Gold rim
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  for (const yo of [-0.55, 0.55]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.15, 20), rimMat);
    rim.position.set(0, h * 0.82 + yo, 0);
    group.add(rim);
  }
}

// ---------- STREETLAMPS ----------
function buildStreetlamps() {
  const spacing = 26;
  const lampCount = Math.floor(WORLD_LEN / spacing);
  for (let i = 0; i < lampCount; i++) {
    const x = i * spacing + 18;
    addStreetlamp(x, -1);
    addStreetlamp(x, +1);
  }
}

function addStreetlamp(x, sideSign) {
  const z = sideSign * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH * 0.7);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x1f1f1f });
  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.7, 8), poleMat);
  pole.position.set(x, 2.35, z);
  fpv.scene.add(pole);
  // Base flange
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.3, 10), poleMat);
  base.position.set(x, 0.15, z);
  fpv.scene.add(base);
  // Curved arm reaching toward road
  const armDir = -sideSign;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.0), poleMat);
  arm.position.set(x, 4.55, z + armDir * 0.5);
  fpv.scene.add(arm);
  // Lamp head
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe09a });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), lampMat);
  lamp.position.set(x, 4.45, z + armDir * 1.0);
  fpv.scene.add(lamp);
  // Soft glow halo
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffe09a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), haloMat);
  halo.position.set(x, 4.45, z + armDir * 1.0);
  fpv.scene.add(halo);
  fpv.streetlamps.push({ lampMat, haloMat });
}

// Small clamp helper
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Procedural texture: facade with windows + door for a building.
function makeBuildingTexture(def, lit) {
  const cw = 256;
  const ch = Math.max(128, Math.floor(256 * def.height / 200));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');

  // Wall background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, shadeHex(def.color, 1.1));
  grad.addColorStop(1, shadeHex(def.color, 0.65));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Windows
  const cols = Math.max(1, def.windows[0]);
  const rows = Math.max(1, def.windows[1]);
  if (def.windows[0] > 0) {
    const padX = 16;
    const usableW = cw - padX * 2;
    const winW = (usableW / cols) * 0.7;
    const gapX = (usableW - winW * cols) / (cols + 1);
    const padTop = 24;
    const padBot = 50;
    const usableH = ch - padTop - padBot;
    const winH = (usableH / rows) * 0.7;
    const gapY = (usableH - winH * rows) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = padX + gapX + cx * (winW + gapX);
        const y = padTop + gapY + r * (winH + gapY);
        const isLit = lit ? Math.random() > 0.25 : false;
        if (lit) {
          ctx.fillStyle = isLit ? '#ffd23a' : '#1a1208';
          // soft glow background
          if (isLit) {
            ctx.fillStyle = '#ffe680';
            ctx.fillRect(x - 2, y - 2, winW + 4, winH + 4);
            ctx.fillStyle = '#ffd23a';
          }
        } else {
          ctx.fillStyle = '#3a2a1a';
        }
        ctx.fillRect(x, y, winW, winH);
        // window cross
        ctx.strokeStyle = lit ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + winW / 2, y); ctx.lineTo(x + winW / 2, y + winH);
        ctx.moveTo(x, y + winH / 2); ctx.lineTo(x + winW, y + winH / 2);
        ctx.stroke();
      }
    }
  }

  // Door (only on the wall facing the road; here baked into all sides for simplicity)
  const dw = 36, dh = 50;
  const dx = (cw - dw) / 2;
  const dy = ch - dh - 4;
  const dgrad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
  dgrad.addColorStop(0, '#5a3a1a'); dgrad.addColorStop(1, '#2a1808');
  ctx.fillStyle = dgrad;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2; ctx.strokeRect(dx, dy, dw, dh);
  // doorknob
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.arc(dx + dw - 8, dy + dh / 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Building icon up top
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, cw / 2, 28);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function makeTextSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,20,20,0.85)';
  roundRect(ctx, 16, 16, 480, 64, 16);
  ctx.fill();
  ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
  roundRect(ctx, 16, 16, 480, 64, 16);
  ctx.stroke();
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(8, 1.5, 1);
  return spr;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// ---------- NPCS ----------
function buildNpcs() {
  // Cheap billboarded emoji sprites
  const emojis = ['🚶', '🚶‍♀️', '🐕', '🚴', '🐩', '🤵', '👮'];
  for (let i = 0; i < 22; i++) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.font = '110px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojis[i % emojis.length], 64, 80);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(2.2, 2.2, 1);
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    const z = sideSign * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2);
    const x = Math.random() * WORLD_LEN;
    spr.position.set(x, 1.1, z);
    fpv.scene.add(spr);
    fpv.npcs.push({
      mesh: spr,
      speed: (0.6 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1),
      z,
    });
  }
}

// ---------- LIFECYCLE ----------
function show() {
  if (!fpv.initialized) init();
  fpv.active = true;
  document.getElementById('world').classList.add('fpv');
  fpv.canvas.classList.remove('hidden');
  fpv.crosshairEl.classList.remove('hidden');
  // Spawn at the apartment door (start of the strip)
  const home = fpv.buildings.find(b => b.def.id === 'home') || fpv.buildings[0];
  fpv.controls.object.position.set(home.enterPos.x, PLAYER_HEIGHT, home.enterPos.z + (home.sideSign === -1 ? 1.5 : -1.5));
  fpv.controls.object.rotation.y = home.sideSign === -1 ? 0 : Math.PI;
  // Show click-to-play overlay until user locks pointer
  fpv.lockOverlayEl.classList.remove('hidden');
  fpv.hintEl.classList.add('hidden');
  resizeRenderer();
  syncWorldX();
}

function hide() {
  fpv.active = false;
  document.getElementById('world').classList.remove('fpv');
  fpv.canvas.classList.add('hidden');
  fpv.crosshairEl.classList.add('hidden');
  fpv.hintEl.classList.add('hidden');
  fpv.lockOverlayEl.classList.add('hidden');
  fpv.enterPromptEl.classList.add('hidden');
  if (fpv.controls && fpv.controls.isLocked) fpv.controls.unlock();
}

// Called from game.js's loop each frame, after game.js update/render.
function updateFrame(dt) {
  if (!fpv.active) return;
  if (state.interiorBuildingId) {
    // We're inside a building — pause 3D rendering, hide chrome.
    fpv.canvas.classList.add('hidden');
    fpv.crosshairEl.classList.add('hidden');
    fpv.hintEl.classList.add('hidden');
    fpv.enterPromptEl.classList.add('hidden');
    fpv.lockOverlayEl.classList.add('hidden');
    if (fpv.controls.isLocked) fpv.controls.unlock();
    return;
  }
  // Coming back from interior — re-show
  if (fpv.canvas.classList.contains('hidden')) {
    fpv.canvas.classList.remove('hidden');
    fpv.crosshairEl.classList.remove('hidden');
    fpv.lockOverlayEl.classList.remove('hidden');
    syncWorldX();
  }

  movePlayer(dt);
  updateNpcs(dt);
  updateNearest();
  updateDayNight();

  fpv.renderer.render(fpv.scene, fpv.camera);

  // Sync horizontal position back to game.js (so saves & HUD match)
  syncWorldX();
}

// ---------- MOVEMENT ----------
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
function movePlayer(dt) {
  if (!fpv.controls.isLocked) return;

  // Read keys[] global maintained by game.js
  let fwd = 0, right = 0;
  if (keys['w'] || keys['arrowup']) fwd += 1;
  if (keys['s'] || keys['arrowdown']) fwd -= 1;
  if (keys['d'] || keys['arrowright']) right += 1;
  if (keys['a'] || keys['arrowleft']) right -= 1;
  const running = !!keys['shift'];
  const speed = PLAYER_SPEED * (running ? PLAYER_RUN_MULT : 1);

  if (fwd === 0 && right === 0) return;

  // Camera basis vectors flattened to ground plane
  fpv.camera.getWorldDirection(tmpForward);
  tmpForward.y = 0; tmpForward.normalize();
  tmpRight.copy(tmpForward).cross(fpv.camera.up).normalize();

  const dx = (tmpForward.x * fwd + tmpRight.x * right) * speed * dt;
  const dz = (tmpForward.z * fwd + tmpRight.z * right) * speed * dt;

  const pos = fpv.controls.object.position;
  // Try X then Z separately so we slide along walls instead of getting stuck
  tryMoveAxis(pos, dx, 0);
  tryMoveAxis(pos, 0, dz);

  // Clamp to world bounds
  pos.x = Math.max(2, Math.min(WORLD_LEN - 2, pos.x));
  pos.z = Math.max(-GRASS_DEPTH + 2, Math.min(GRASS_DEPTH - 2, pos.z));
  pos.y = PLAYER_HEIGHT;
}

function tryMoveAxis(pos, dx, dz) {
  const nx = pos.x + dx;
  const nz = pos.z + dz;
  if (collidesAt(nx, nz)) return false;
  pos.x = nx; pos.z = nz;
  return true;
}

function collidesAt(x, z) {
  // AABB vs every building (cheap, n=24)
  for (const b of fpv.buildings) {
    if (b.walkable) continue; // open spaces (e.g. the park) are walk-through
    const localX = x - b.x;
    const localZ = z - b.z;
    if (Math.abs(localX) < b.halfW + PLAYER_RADIUS &&
        Math.abs(localZ) < b.halfD + PLAYER_RADIUS) {
      return true;
    }
  }
  return false;
}

// ---------- NPCS ----------
function updateNpcs(dt) {
  for (const n of fpv.npcs) {
    n.mesh.position.x += n.speed * dt;
    if (n.mesh.position.x > WORLD_LEN + 4) n.mesh.position.x = -4;
    if (n.mesh.position.x < -4) n.mesh.position.x = WORLD_LEN + 4;
  }
}

// ---------- NEAREST BUILDING / ENTER ----------
function updateNearest() {
  const pos = fpv.controls.object.position;
  let best = null;
  let bestDist = ENTER_RANGE;
  for (const b of fpv.buildings) {
    const d = Math.hypot(pos.x - b.enterPos.x, pos.z - b.enterPos.z);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  if (best !== fpv.nearestBuilding) {
    if (fpv.nearestBuilding) fpv.nearestBuilding.nameSprite.visible = false;
    fpv.nearestBuilding = best;
    if (best) best.nameSprite.visible = true;
  }
  if (best) {
    fpv.enterPromptEl.innerHTML = `Press <kbd>E</kbd> to enter <b>${best.def.icon} ${best.def.name}</b>`;
    fpv.enterPromptEl.classList.remove('hidden');
  } else {
    fpv.enterPromptEl.classList.add('hidden');
  }
}

function enterNearest() {
  if (!fpv.nearestBuilding) return false;
  enterInterior(fpv.nearestBuilding.def.id);
  return true;
}

// ---------- DAY/NIGHT ----------
function updateDayNight() {
  // state.timeMin runs 0..1440 (game minutes since midnight). 6=dawn, 18=dusk.
  const hour = state.timeMin / 60;
  // Smooth t: 1 = full day, 0 = full night
  let t;
  if (hour < 5) t = 0;
  else if (hour < 7) t = (hour - 5) / 2;
  else if (hour < 18) t = 1;
  else if (hour < 20) t = 1 - (hour - 18) / 2;
  else t = 0;

  const day = new THREE.Color(0x87ceeb);
  const dusk = new THREE.Color(0xff8a4a);
  const night = new THREE.Color(0x0e1230);
  let sky;
  if (hour >= 17 && hour < 20) {
    // dusk transition
    const k = (hour - 17) / 3;
    sky = day.clone().lerp(dusk, Math.min(1, k * 1.5)).lerp(night, Math.max(0, k - 0.5) * 2);
  } else if (hour >= 5 && hour < 7) {
    // dawn
    const k = (hour - 5) / 2;
    sky = night.clone().lerp(dusk, Math.min(1, k * 1.5)).lerp(day, Math.max(0, k - 0.5) * 2);
  } else if (hour >= 7 && hour < 17) {
    sky = day;
  } else {
    sky = night;
  }

  fpv.skyMat.color.copy(sky);
  fpv.scene.background = sky;
  fpv.scene.fog.color.copy(sky);

  // Sun intensity follows t
  fpv.sun.intensity = 0.25 + t * 1.0;
  fpv.ambient.intensity = 0.25 + t * 0.4;
  fpv.hemi.intensity = 0.3 + t * 0.5;

  // Window emissive intensity ramps up at night
  const nightT = 1 - t;
  for (const m of fpv.litMaterials) {
    m.emissive.setRGB(nightT, nightT, nightT);
    m.emissiveIntensity = 1.0;
  }

  // Storefront / transit signs glow softly during the day, brightly at night
  for (const m of fpv.signMaterials) {
    m.emissive.setRGB(1, 1, 1);
    m.emissiveIntensity = 0.45 + nightT * 1.05;
  }

  // Neon halo planes ramp opacity at night
  for (const m of fpv.neonHalos) {
    m.opacity = nightT * 0.5;
  }

  // Marquee bulbs twinkle (cheap noise-free shimmer using time)
  const tw = Date.now() / 220;
  let i = 0;
  for (const m of fpv.marqueeBulbs) {
    const lit = nightT * (0.55 + 0.45 * Math.sin(tw + i * 0.7));
    m.color.setRGB(1, 0.85 * (0.45 + lit * 0.55), 0.4 * (0.5 + lit * 0.5));
    i++;
  }

  // Streetlamps: lamp warmth + halo opacity ramp at night
  for (const s of fpv.streetlamps) {
    s.lampMat.color.setRGB(1, 0.85 * (0.45 + nightT * 0.55), 0.55 * (0.4 + nightT * 0.6));
    s.haloMat.opacity = nightT * 0.5;
  }
}

// ---------- HELPERS ----------
function shadeHex(hex, factor) {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((c & 0xff) * factor));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function syncWorldX() {
  // Mirror our 3D X position into state.playerWorldX so existing save/HUD logic is happy.
  if (!fpv.controls) return;
  const px = fpv.controls.object.position.x;
  const worldX = Math.max(60, Math.min(WORLD_WIDTH - 100, px / SCALE));
  state.playerWorldX = worldX;
}
