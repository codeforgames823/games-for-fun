import * as THREE from 'three';
import { MOB_CREATORS } from './mobModels.js';
import { CHUNK_HEIGHT } from '../config.js';

const MOB_DEFS = {
  cow:      { hostile: false, hp: 10, speed: 1.2, spawnWeight: 3 },
  pig:      { hostile: false, hp: 8,  speed: 1.4, spawnWeight: 3 },
  sheep:    { hostile: false, hp: 8,  speed: 1.1, spawnWeight: 3 },
  chicken:  { hostile: false, hp: 4,  speed: 1.6, spawnWeight: 2 },
  zombie:   { hostile: true,  hp: 20, speed: 1.8, damage: 3, attackRange: 1.5, spawnWeight: 3, attackCooldown: 1.2 },
  skeleton: { hostile: true,  hp: 18, speed: 1.5, damage: 4, attackRange: 14, spawnWeight: 2, attackCooldown: 2.0 },
  spider:   { hostile: true,  hp: 16, speed: 2.2, damage: 2, attackRange: 1.8, spawnWeight: 2, attackCooldown: 0.9 },
};

const MAX_MOBS = 30;
const SPAWN_RADIUS = 40;
const DESPAWN_RADIUS = 70;
const SPAWN_INTERVAL = 3;
const PASSIVE_SPAWN_LIGHT_MIN = 1;
const WANDER_CHANGE_TIME = 3;

export class MobManager {
  constructor(scene, getHeight, isSolid, getBlock) {
    this.scene = scene;
    this.getHeight = getHeight;
    this.isSolid = isSolid;
    this.getBlock = getBlock;
    this.mobs = [];
    this._spawnTimer = 0;
    this._arrowPool = [];
  }

  update(dt, playerPos, onPlayerHit) {
    this._spawnTimer += dt;
    if (this._spawnTimer >= SPAWN_INTERVAL && this.mobs.length < MAX_MOBS) {
      this._spawnTimer = 0;
      this._trySpawn(playerPos);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];

      const dx = mob.mesh.position.x - playerPos.x;
      const dz = mob.mesh.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > DESPAWN_RADIUS) {
        this._removeMob(i);
        continue;
      }

      if (mob.hp <= 0) {
        this._deathEffect(mob);
        this._removeMob(i);
        continue;
      }

      if (mob.def.hostile) {
        this._updateHostile(mob, dt, playerPos, dist, onPlayerHit);
      } else {
        this._updatePassive(mob, dt);
      }

      this._applyGravity(mob, dt);
      this._animateLegs(mob, dt);
    }

    this._updateArrows(dt, playerPos, onPlayerHit);
  }

  hitMob(px, py, pz, dirX, dirY, dirZ) {
    const reach = 4;
    let closest = null;
    let closestDist = reach;

    for (const mob of this.mobs) {
      const mPos = mob.mesh.position;
      const hw = (mob.mesh.userData.width || 0.5) / 2;
      const mh = mob.mesh.userData.height || 1;

      const toMob = new THREE.Vector3(mPos.x - px, mPos.y + mh / 2 - py, mPos.z - pz);
      const dot = toMob.x * dirX + toMob.y * dirY + toMob.z * dirZ;
      if (dot < 0 || dot > reach) continue;

      const projX = px + dirX * dot;
      const projY = py + dirY * dot;
      const projZ = pz + dirZ * dot;

      if (Math.abs(projX - mPos.x) < hw + 0.3 &&
          projY > mPos.y - 0.1 && projY < mPos.y + mh + 0.1 &&
          Math.abs(projZ - mPos.z) < hw + 0.3) {
        if (dot < closestDist) {
          closestDist = dot;
          closest = mob;
        }
      }
    }

    if (closest) {
      closest.hp -= 5;
      closest.hurtTimer = 0.3;

      const knockDir = new THREE.Vector3(dirX, 0.3, dirZ).normalize();
      closest.vx += knockDir.x * 6;
      closest.vy += 3;
      closest.vz += knockDir.z * 6;

      for (const child of closest.mesh.children) {
        if (child.material) {
          child.material._origColor = child.material._origColor || child.material.color.getHex();
          child.material.color.setHex(0xff3333);
        }
      }
      return true;
    }
    return false;
  }

  _trySpawn(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * (SPAWN_RADIUS - 20);
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);

    let height;
    try {
      height = this.getHeight(wx, wz);
    } catch { return; }

    if (height <= 0 || height >= CHUNK_HEIGHT - 5) return;

    const surfaceBlock = this.getBlock(wx, height, wz);
    if (surfaceBlock === 7 || surfaceBlock === 0) return;

    const aboveBlock = this.getBlock(wx, height + 1, wz);
    const above2 = this.getBlock(wx, height + 2, wz);
    if (aboveBlock !== 0 || above2 !== 0) return;

    const isHostileSpot = Math.random() < 0.35;
    const type = this._pickMobType(isHostileSpot);
    if (!type) return;

    this._spawnMob(type, wx + 0.5, height + 1, wz + 0.5);
  }

  _pickMobType(hostile) {
    const candidates = Object.entries(MOB_DEFS).filter(([, d]) => d.hostile === hostile);
    const totalWeight = candidates.reduce((s, [, d]) => s + d.spawnWeight, 0);
    let roll = Math.random() * totalWeight;
    for (const [type, def] of candidates) {
      roll -= def.spawnWeight;
      if (roll <= 0) return type;
    }
    return candidates[0]?.[0];
  }

  _spawnMob(type, x, y, z) {
    const creator = MOB_CREATORS[type];
    if (!creator) return;
    const mesh = creator();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const def = MOB_DEFS[type];
    this.mobs.push({
      type,
      def,
      mesh,
      hp: def.hp,
      vx: 0, vy: 0, vz: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: Math.random() * WANDER_CHANGE_TIME,
      attackTimer: 0,
      hurtTimer: 0,
      walkAnim: 0,
      onGround: false,
    });
  }

  _removeMob(index) {
    const mob = this.mobs[index];
    this.scene.remove(mob.mesh);
    for (const child of mob.mesh.children) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    this.mobs.splice(index, 1);
  }

  _updatePassive(mob, dt) {
    mob.wanderTimer -= dt;
    if (mob.wanderTimer <= 0) {
      mob.wanderTimer = WANDER_CHANGE_TIME + Math.random() * 3;
      if (Math.random() < 0.4) {
        mob.vx = 0;
        mob.vz = 0;
        return;
      }
      mob.wanderAngle += (Math.random() - 0.5) * 2;
    }

    const speed = mob.def.speed * 0.4;
    mob.vx = Math.cos(mob.wanderAngle) * speed;
    mob.vz = Math.sin(mob.wanderAngle) * speed;

    mob.mesh.rotation.y = -mob.wanderAngle + Math.PI / 2;

    const nextX = mob.mesh.position.x + mob.vx * dt;
    const nextZ = mob.mesh.position.z + mob.vz * dt;
    const fy = Math.floor(mob.mesh.position.y);

    if (this.isSolid(Math.floor(nextX), fy, Math.floor(nextZ)) ||
        this.isSolid(Math.floor(nextX), fy + 1, Math.floor(nextZ))) {
      mob.wanderAngle += Math.PI * 0.5 + Math.random();
      mob.vx = 0; mob.vz = 0;
      return;
    }

    mob.mesh.position.x = nextX;
    mob.mesh.position.z = nextZ;
  }

  _updateHostile(mob, dt, playerPos, dist, onPlayerHit) {
    mob.attackTimer = Math.max(0, mob.attackTimer - dt);

    if (mob.hurtTimer > 0) {
      mob.hurtTimer -= dt;
      if (mob.hurtTimer <= 0) {
        for (const child of mob.mesh.children) {
          if (child.material && child.material._origColor !== undefined) {
            child.material.color.setHex(child.material._origColor);
          }
        }
      }
    }

    if (dist > 20) {
      this._updatePassive(mob, dt);
      return;
    }

    const dx = playerPos.x - mob.mesh.position.x;
    const dz = playerPos.z - mob.mesh.position.z;
    const angle = Math.atan2(dz, dx);
    mob.mesh.rotation.y = -angle + Math.PI / 2;

    if (mob.type === 'skeleton') {
      this._updateSkeletonAI(mob, dt, playerPos, dist, angle, onPlayerHit);
      return;
    }

    if (dist > mob.def.attackRange) {
      const speed = mob.def.speed;
      const moveX = Math.cos(angle) * speed;
      const moveZ = Math.sin(angle) * speed;
      const nextX = mob.mesh.position.x + moveX * dt;
      const nextZ = mob.mesh.position.z + moveZ * dt;
      const fy = Math.floor(mob.mesh.position.y);

      const blocked = this.isSolid(Math.floor(nextX), fy, Math.floor(nextZ)) ||
                      this.isSolid(Math.floor(nextX), fy + 1, Math.floor(nextZ));

      if (blocked) {
        if (mob.onGround && !this.isSolid(Math.floor(nextX), fy + 2, Math.floor(nextZ))) {
          mob.vy = 7;
          mob.onGround = false;
        }
      } else {
        mob.mesh.position.x = nextX;
        mob.mesh.position.z = nextZ;
      }
      mob.vx = moveX;
      mob.vz = moveZ;
    }

    if (dist <= mob.def.attackRange && mob.attackTimer <= 0) {
      mob.attackTimer = mob.def.attackCooldown;
      if (onPlayerHit) onPlayerHit(mob.def.damage, mob.mesh.position);
    }
  }

  _updateSkeletonAI(mob, dt, playerPos, dist, angle, onPlayerHit) {
    if (dist < 6) {
      const speed = mob.def.speed * 0.6;
      const awayX = Math.cos(angle + Math.PI) * speed;
      const awayZ = Math.sin(angle + Math.PI) * speed;
      mob.mesh.position.x += awayX * dt;
      mob.mesh.position.z += awayZ * dt;
      mob.vx = awayX; mob.vz = awayZ;
    } else if (dist > 16) {
      const speed = mob.def.speed;
      mob.mesh.position.x += Math.cos(angle) * speed * dt;
      mob.mesh.position.z += Math.sin(angle) * speed * dt;
      mob.vx = Math.cos(angle) * speed;
      mob.vz = Math.sin(angle) * speed;
    } else {
      mob.vx = 0; mob.vz = 0;
    }

    if (mob.attackTimer <= 0 && dist <= mob.def.attackRange) {
      mob.attackTimer = mob.def.attackCooldown;
      this._shootArrow(mob.mesh.position, playerPos, mob.def.damage, onPlayerHit);
    }
  }

  _shootArrow(from, to, damage, onPlayerHit) {
    const dir = new THREE.Vector3(
      to.x - from.x,
      to.y + 1.2 - from.y - 0.5,
      to.z - from.z
    ).normalize();

    const geo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const arrow = new THREE.Mesh(geo, mat);
    arrow.position.copy(from);
    arrow.position.y += 1.2;
    arrow.lookAt(new THREE.Vector3(
      from.x + dir.x, from.y + 1.2 + dir.y, from.z + dir.z
    ));
    this.scene.add(arrow);

    this._arrowPool.push({
      mesh: arrow,
      vel: dir.multiplyScalar(18),
      damage,
      onPlayerHit,
      life: 3,
    });
  }

  _updateArrows(dt, playerPos, onPlayerHit) {
    for (let i = this._arrowPool.length - 1; i >= 0; i--) {
      const a = this._arrowPool[i];
      a.life -= dt;
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this._arrowPool.splice(i, 1);
        continue;
      }

      a.vel.y -= 12 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);

      const ax = a.mesh.position.x, ay = a.mesh.position.y, az = a.mesh.position.z;

      if (this.isSolid(Math.floor(ax), Math.floor(ay), Math.floor(az))) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this._arrowPool.splice(i, 1);
        continue;
      }

      const pdx = ax - playerPos.x;
      const pdy = ay - (playerPos.y + 0.8);
      const pdz = az - playerPos.z;
      if (pdx * pdx + pdy * pdy + pdz * pdz < 0.6) {
        if (a.onPlayerHit) a.onPlayerHit(a.damage, a.mesh.position);
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this._arrowPool.splice(i, 1);
      }
    }
  }

  _applyGravity(mob, dt) {
    mob.vy -= 22 * dt;
    const newY = mob.mesh.position.y + mob.vy * dt;
    const fx = Math.floor(mob.mesh.position.x);
    const fz = Math.floor(mob.mesh.position.z);
    const fy = Math.floor(newY);

    if (mob.vy < 0 && this.isSolid(fx, fy, fz)) {
      mob.mesh.position.y = fy + 1 + 0.001;
      mob.vy = 0;
      mob.onGround = true;
    } else {
      mob.mesh.position.y = newY;
      mob.onGround = false;
    }

    if (mob.mesh.position.y < -10) {
      mob.hp = 0;
    }
  }

  _animateLegs(mob, dt) {
    const speed = Math.sqrt(mob.vx * mob.vx + mob.vz * mob.vz);
    if (speed < 0.1) return;
    mob.walkAnim += dt * speed * 4;
    const swing = Math.sin(mob.walkAnim) * 0.4;

    const children = mob.mesh.children;
    let legIdx = 0;
    for (const child of children) {
      if (!child.geometry) continue;
      const params = child.geometry.parameters;
      if (!params) continue;
      const isLeg = params.height > 0.1 && params.height < 0.55 &&
                    params.width < 0.2 && child.position.y < 0.4;
      if (isLeg) {
        child.rotation.x = (legIdx % 2 === 0 ? swing : -swing);
        legIdx++;
      }
    }
  }

  _deathEffect(mob) {
    const pos = mob.mesh.position;
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshLambertMaterial({
        color: mob.def.hostile ? 0x555555 : 0x888888,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + Math.random() * 0.5 + 0.2,
        pos.z + (Math.random() - 0.5) * 0.6
      );
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 3
      );

      const startTime = performance.now();
      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > 0.8) {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
          return;
        }
        vel.y -= 18 * (1 / 60);
        p.position.addScaledVector(vel, 1 / 60);
        p.rotation.x += 0.15;
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }

  getMobCount() {
    return this.mobs.length;
  }

  getHostileCount() {
    return this.mobs.filter(m => m.def.hostile).length;
  }

  dispose() {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      this._removeMob(i);
    }
    for (const a of this._arrowPool) {
      this.scene.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mesh.material.dispose();
    }
    this._arrowPool.length = 0;
  }
}
