import * as THREE from 'three';
import {
  GRAVITY, JUMP_VELOCITY, PLAYER_SPEED, FLY_SPEED,
  MOUSE_SENSITIVITY, PLAYER_HEIGHT, PLAYER_WIDTH,
  CHUNK_HEIGHT,
} from '../config.js';

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.pitch = 0;
    this.yaw = 0;
    this.flying = true;
    this.onGround = false;
    this.keys = {};
    this.locked = false;

    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF') this.flying = !this.flying;
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

  update(dt, isSolid) {
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw), 0, -Math.cos(this.yaw)
    ).normalize();
    const right = new THREE.Vector3(
      Math.cos(this.yaw), 0, -Math.sin(this.yaw)
    ).normalize();

    const speed = this.flying ? FLY_SPEED : PLAYER_SPEED;
    const move = new THREE.Vector3(0, 0, 0);

    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
    if (this.keys['KeyE'] || this.keys['ArrowRight']) move.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);

    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    if (this.flying) {
      if (this.keys['Space']) move.y = speed;
      else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) move.y = -speed;
      this.velocity.set(move.x, move.y, move.z);
    } else {
      this.velocity.x = move.x;
      this.velocity.z = move.z;
      if (this.keys['Space'] && this.onGround) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
      }
      this.velocity.y -= GRAVITY * dt;
    }

    this._moveAxis('x', this.velocity.x * dt, isSolid);
    this._moveAxis('y', this.velocity.y * dt, isSolid);
    this._moveAxis('z', this.velocity.z * dt, isSolid);

    if (this.position.y < -10) {
      this.position.y = CHUNK_HEIGHT;
      this.velocity.y = 0;
    }

    this.camera.position.copy(this.position);
    this.camera.position.y += PLAYER_HEIGHT;

    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    this.camera.quaternion.copy(qYaw).multiply(qPitch);
  }

  _moveAxis(axis, delta, isSolid) {
    this.position[axis] += delta;
    const hw = PLAYER_WIDTH / 2;

    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + PLAYER_HEIGHT);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (!isSolid(bx, by, bz)) continue;
          if (axis === 'x') {
            this.position.x = delta > 0 ? bx - hw - 0.001 : bx + 1 + hw + 0.001;
            this.velocity.x = 0;
          } else if (axis === 'y') {
            this.position.y = delta > 0 ? by - PLAYER_HEIGHT - 0.001 : by + 1 + 0.001;
            if (delta < 0) this.onGround = true;
            this.velocity.y = 0;
          } else {
            this.position.z = delta > 0 ? bz - hw - 0.001 : bz + 1 + hw + 0.001;
            this.velocity.z = 0;
          }
          return;
        }
      }
    }

    if (axis === 'y') this.onGround = false;
  }

  getChunkCoords() {
    return {
      cx: Math.floor(this.position.x / 16),
      cz: Math.floor(this.position.z / 16),
    };
  }
}
