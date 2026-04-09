import * as THREE from 'three';

function box(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

export function createCowModel() {
  const group = new THREE.Group();

  const body = box(0.9, 0.6, 0.5, 0x6b3a1a);
  body.position.y = 0.6;
  group.add(body);

  const spots = box(0.3, 0.25, 0.52, 0xf0e8d0);
  spots.position.set(0.2, 0.7, 0);
  group.add(spots);

  const head = box(0.4, 0.4, 0.4, 0x6b3a1a);
  head.position.set(0.55, 0.85, 0);
  group.add(head);

  const snout = box(0.2, 0.15, 0.25, 0xc8b8a0);
  snout.position.set(0.72, 0.75, 0);
  group.add(snout);

  const hornL = box(0.05, 0.15, 0.05, 0xe8e0d0);
  hornL.position.set(0.6, 1.1, 0.12);
  group.add(hornL);
  const hornR = hornL.clone();
  hornR.position.z = -0.12;
  group.add(hornR);

  for (const [x, z] of [[0.25, 0.15], [0.25, -0.15], [-0.25, 0.15], [-0.25, -0.15]]) {
    const leg = box(0.15, 0.4, 0.15, 0x5a3018);
    leg.position.set(x, 0.2, z);
    group.add(leg);
  }

  group.userData.eyeHeight = 0.9;
  group.userData.width = 0.9;
  group.userData.height = 1.1;
  return group;
}

export function createPigModel() {
  const group = new THREE.Group();

  const body = box(0.7, 0.45, 0.4, 0xe8a0a0);
  body.position.y = 0.45;
  group.add(body);

  const head = box(0.35, 0.35, 0.35, 0xe8a0a0);
  head.position.set(0.42, 0.6, 0);
  group.add(head);

  const snout = box(0.15, 0.1, 0.18, 0xd08888);
  snout.position.set(0.58, 0.55, 0);
  group.add(snout);

  for (const [x, z] of [[0.18, 0.1], [0.18, -0.1], [-0.18, 0.1], [-0.18, -0.1]]) {
    const leg = box(0.12, 0.25, 0.12, 0xd09090);
    leg.position.set(x, 0.12, z);
    group.add(leg);
  }

  group.userData.eyeHeight = 0.65;
  group.userData.width = 0.7;
  group.userData.height = 0.8;
  return group;
}

export function createSheepModel() {
  const group = new THREE.Group();

  const body = box(0.8, 0.55, 0.5, 0xf0ece0);
  body.position.y = 0.55;
  group.add(body);

  const wool = box(0.85, 0.6, 0.55, 0xf8f4ee);
  wool.position.y = 0.57;
  group.add(wool);

  const head = box(0.3, 0.3, 0.3, 0xc0b0a0);
  head.position.set(0.48, 0.75, 0);
  group.add(head);

  for (const [x, z] of [[0.22, 0.14], [0.22, -0.14], [-0.22, 0.14], [-0.22, -0.14]]) {
    const leg = box(0.12, 0.35, 0.12, 0xb0a090);
    leg.position.set(x, 0.17, z);
    group.add(leg);
  }

  group.userData.eyeHeight = 0.8;
  group.userData.width = 0.8;
  group.userData.height = 1.0;
  return group;
}

export function createChickenModel() {
  const group = new THREE.Group();

  const body = box(0.3, 0.25, 0.25, 0xf0f0f0);
  body.position.y = 0.3;
  group.add(body);

  const head = box(0.18, 0.18, 0.18, 0xf0f0f0);
  head.position.set(0.2, 0.5, 0);
  group.add(head);

  const beak = box(0.08, 0.04, 0.06, 0xe8a020);
  beak.position.set(0.3, 0.47, 0);
  group.add(beak);

  const comb = box(0.06, 0.08, 0.04, 0xd03020);
  comb.position.set(0.2, 0.6, 0);
  group.add(comb);

  const wattle = box(0.04, 0.06, 0.03, 0xd03020);
  wattle.position.set(0.24, 0.42, 0);
  group.add(wattle);

  for (const z of [0.06, -0.06]) {
    const leg = box(0.04, 0.2, 0.04, 0xe8a020);
    leg.position.set(0, 0.1, z);
    group.add(leg);
  }

  group.userData.eyeHeight = 0.5;
  group.userData.width = 0.3;
  group.userData.height = 0.6;
  return group;
}

export function createZombieModel() {
  const group = new THREE.Group();

  const body = box(0.5, 0.65, 0.3, 0x4a7a3a);
  body.position.y = 0.85;
  group.add(body);

  const head = box(0.4, 0.4, 0.4, 0x4a7a3a);
  head.position.set(0, 1.4, 0);
  group.add(head);

  const eyeL = box(0.06, 0.06, 0.05, 0x101010);
  eyeL.position.set(0.21, 1.45, 0.1);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.1;
  group.add(eyeR);

  const armL = box(0.15, 0.55, 0.15, 0x4a7a3a);
  armL.position.set(0.32, 1.0, 0.22);
  armL.rotation.x = -Math.PI / 4;
  group.add(armL);
  const armR = box(0.15, 0.55, 0.15, 0x4a7a3a);
  armR.position.set(0.32, 1.0, -0.22);
  armR.rotation.x = -Math.PI / 4;
  group.add(armR);

  const legL = box(0.18, 0.5, 0.18, 0x3a5a2a);
  legL.position.set(0, 0.25, 0.08);
  group.add(legL);
  const legR = legL.clone();
  legR.position.z = -0.08;
  group.add(legR);

  group.userData.eyeHeight = 1.5;
  group.userData.width = 0.6;
  group.userData.height = 1.7;
  return group;
}

export function createSkeletonModel() {
  const group = new THREE.Group();
  const bone = 0xe8e0d0;
  const dark = 0x303030;

  const body = box(0.4, 0.6, 0.2, bone);
  body.position.y = 0.85;
  group.add(body);

  const ribs = box(0.42, 0.15, 0.22, dark);
  ribs.position.y = 0.8;
  group.add(ribs);
  const ribs2 = ribs.clone();
  ribs2.position.y = 0.95;
  group.add(ribs2);

  const head = box(0.4, 0.4, 0.4, bone);
  head.position.set(0, 1.4, 0);
  group.add(head);

  const eyeL = box(0.08, 0.08, 0.05, dark);
  eyeL.position.set(0.21, 1.42, 0.1);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.1;
  group.add(eyeR);

  const jaw = box(0.3, 0.08, 0.3, 0xd0c8b8);
  jaw.position.set(0, 1.2, 0);
  group.add(jaw);

  const armL = box(0.1, 0.55, 0.1, bone);
  armL.position.set(0.3, 1.0, 0.18);
  group.add(armL);
  const armR = armL.clone();
  armR.position.z = -0.18;
  group.add(armR);

  const bow = box(0.04, 0.6, 0.04, 0x6b4423);
  bow.position.set(0.45, 1.0, 0.2);
  bow.rotation.z = -0.3;
  group.add(bow);

  const bowString = box(0.02, 0.55, 0.02, 0xc0c0c0);
  bowString.position.set(0.42, 1.0, 0.2);
  bowString.rotation.z = -0.3;
  group.add(bowString);

  const legL = box(0.1, 0.5, 0.1, bone);
  legL.position.set(0, 0.25, 0.06);
  group.add(legL);
  const legR = legL.clone();
  legR.position.z = -0.06;
  group.add(legR);

  group.userData.eyeHeight = 1.5;
  group.userData.width = 0.5;
  group.userData.height = 1.7;
  return group;
}

export function createSpiderModel() {
  const group = new THREE.Group();

  const abdomen = box(0.6, 0.35, 0.45, 0x3a3a3a);
  abdomen.position.set(-0.25, 0.35, 0);
  group.add(abdomen);

  const thorax = box(0.35, 0.3, 0.35, 0x2a2a2a);
  thorax.position.set(0.15, 0.3, 0);
  group.add(thorax);

  const head = box(0.25, 0.22, 0.25, 0x2a2a2a);
  head.position.set(0.38, 0.32, 0);
  group.add(head);

  for (const z of [0.08, -0.08]) {
    const eye = box(0.06, 0.06, 0.05, 0xd02020);
    eye.position.set(0.5, 0.38, z);
    group.add(eye);
  }

  for (let i = 0; i < 4; i++) {
    const xOff = -0.1 + i * 0.12;
    for (const side of [1, -1]) {
      const leg = box(0.04, 0.04, 0.4, 0x3a3a3a);
      leg.position.set(xOff, 0.25, side * 0.35);
      leg.rotation.x = side * 0.6;
      leg.rotation.z = (i - 1.5) * 0.15;
      group.add(leg);

      const lowerLeg = box(0.03, 0.25, 0.03, 0x3a3a3a);
      lowerLeg.position.set(xOff, 0.08, side * 0.55);
      group.add(lowerLeg);
    }
  }

  group.userData.eyeHeight = 0.4;
  group.userData.width = 1.0;
  group.userData.height = 0.5;
  return group;
}

export const MOB_CREATORS = {
  cow: createCowModel,
  pig: createPigModel,
  sheep: createSheepModel,
  chicken: createChickenModel,
  zombie: createZombieModel,
  skeleton: createSkeletonModel,
  spider: createSpiderModel,
};
