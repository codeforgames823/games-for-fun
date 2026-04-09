import * as THREE from 'three';
import { REACH_DISTANCE } from '../config.js';

export function raycastBlock(camera, getBlock) {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

  const step = 0.05;
  const maxSteps = REACH_DISTANCE / step;

  let prevX = Math.floor(origin.x);
  let prevY = Math.floor(origin.y);
  let prevZ = Math.floor(origin.z);

  for (let i = 0; i < maxSteps; i++) {
    const t = i * step;
    const x = Math.floor(origin.x + dir.x * t);
    const y = Math.floor(origin.y + dir.y * t);
    const z = Math.floor(origin.z + dir.z * t);

    if (x === prevX && y === prevY && z === prevZ && i > 0) continue;

    const block = getBlock(x, y, z);
    if (block !== 0) {
      return {
        x, y, z, block,
        placeX: prevX, placeY: prevY, placeZ: prevZ,
      };
    }

    prevX = x;
    prevY = y;
    prevZ = z;
  }

  return null;
}
