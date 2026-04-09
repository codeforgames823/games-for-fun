import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Combat {
    constructor(scene, player, input) {
        this.scene = scene;
        this.player = player;
        this.input = input;
        this.lastFireTime = 0;
        this.muzzleFlashes = [];
        this.bulletTrails = [];
        this.weaponPickups = [];
        this.raycaster = new THREE.Raycaster();

        this.crosshair = null;
    }

    spawnPickups(weaponSpawns) {
        const pickupMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        for (const sp of weaponSpawns) {
            const geo = new THREE.OctahedronGeometry(0.5);
            const mesh = new THREE.Mesh(geo, pickupMat.clone());
            mesh.position.set(sp.x, 1, sp.z);
            this.scene.add(mesh);
            this.weaponPickups.push({ mesh, type: sp.type, collected: false });
        }
    }

    update(dt, targets) {
        const now = performance.now() / 1000;
        const weapon = CONFIG.WEAPONS[this.player.currentWeapon];

        if (this.player.inVehicle) return;

        if (this.input.mouseDown && now - this.lastFireTime > weapon.rate) {
            if (weapon.auto || now - this.lastFireTime > weapon.rate) {
                this._fire(weapon, targets);
                this.lastFireTime = now;
            }
        }

        this._updatePickups();
        this._updateEffects(dt);
        this._handleWeaponSwitch();
    }

    _fire(weapon, targets) {
        if (this.player.currentWeapon === 'fists') {
            this._meleeAttack(weapon, targets);
            return;
        }

        if (this.player.ammo[this.player.currentWeapon] <= 0) return;
        this.player.ammo[this.player.currentWeapon]--;

        const pellets = this.player.currentWeapon === 'shotgun' ? 6 : 1;
        for (let i = 0; i < pellets; i++) {
            this._shootRay(weapon, targets);
        }

        this._createMuzzleFlash();
    }

    _meleeAttack(weapon, targets) {
        const playerPos = this.player.position;
        const forward = new THREE.Vector3(
            -Math.sin(this.player.rotation), 0, -Math.cos(this.player.rotation)
        );

        for (const t of targets) {
            if (!t.mesh || !t.alive) continue;
            const dist = playerPos.distanceTo(t.mesh.position);
            if (dist < weapon.range) {
                const toTarget = t.mesh.position.clone().sub(playerPos).normalize();
                if (forward.dot(toTarget) > 0.5) {
                    t.takeDamage(weapon.damage);
                    return;
                }
            }
        }
    }

    _shootRay(weapon, targets) {
        const origin = this.player.position.clone();
        origin.y += CONFIG.PLAYER_HEIGHT * 0.7;

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.cameraYaw + Math.PI);
        forward.y = Math.sin(this.player.cameraPitch * 0.5);
        forward.normalize();

        forward.x += (Math.random() - 0.5) * weapon.spread;
        forward.y += (Math.random() - 0.5) * weapon.spread;
        forward.z += (Math.random() - 0.5) * weapon.spread;
        forward.normalize();

        let hitDist = weapon.range;
        let hitTarget = null;

        for (const t of targets) {
            if (!t.mesh || !t.alive) continue;
            const toTarget = t.mesh.position.clone().sub(origin);
            const proj = toTarget.dot(forward);
            if (proj < 0 || proj > weapon.range) continue;

            const closest = origin.clone().add(forward.clone().multiplyScalar(proj));
            const dist = closest.distanceTo(t.mesh.position);
            if (dist < 1.5 && proj < hitDist) {
                hitDist = proj;
                hitTarget = t;
            }
        }

        if (hitTarget) {
            hitTarget.takeDamage(weapon.damage);
            this._createHitEffect(origin.clone().add(forward.clone().multiplyScalar(hitDist)));
        }

        this._createBulletTrail(origin, forward, hitDist);
    }

    _createMuzzleFlash() {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        const pos = this.player.position.clone();
        pos.y += CONFIG.PLAYER_HEIGHT * 0.7;
        const forward = new THREE.Vector3(
            -Math.sin(this.player.rotation), 0, -Math.cos(this.player.rotation)
        );
        pos.add(forward.multiplyScalar(0.8));
        flash.position.copy(pos);
        this.scene.add(flash);
        this.muzzleFlashes.push({ mesh: flash, time: performance.now() });
    }

    _createBulletTrail(origin, direction, distance) {
        const points = [origin, origin.clone().add(direction.clone().multiplyScalar(distance))];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.bulletTrails.push({ mesh: line, time: performance.now() });
    }

    _createHitEffect(position) {
        const particles = new THREE.Group();
        for (let i = 0; i < 5; i++) {
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0xff4400 })
            );
            p.position.copy(position);
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.y += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;
            particles.add(p);
        }
        this.scene.add(particles);
        this.muzzleFlashes.push({ mesh: particles, time: performance.now() });
    }

    _updateEffects(dt) {
        const now = performance.now();

        this.muzzleFlashes = this.muzzleFlashes.filter(f => {
            if (now - f.time > 80) {
                this.scene.remove(f.mesh);
                return false;
            }
            return true;
        });

        this.bulletTrails = this.bulletTrails.filter(t => {
            if (now - t.time > 100) {
                this.scene.remove(t.mesh);
                return false;
            }
            t.mesh.material.opacity *= 0.9;
            return true;
        });
    }

    _updatePickups() {
        const playerPos = this.player.position;
        for (const pickup of this.weaponPickups) {
            if (pickup.collected) continue;
            pickup.mesh.rotation.y += 0.03;
            pickup.mesh.position.y = 1 + Math.sin(performance.now() * 0.003) * 0.3;

            if (playerPos.distanceTo(pickup.mesh.position) < 2.5) {
                pickup.collected = true;
                this.scene.remove(pickup.mesh);
                const ammoAmounts = { pistol: 24, shotgun: 12, smg: 60 };
                this.player.giveWeapon(pickup.type, ammoAmounts[pickup.type] || 20);
            }
        }
    }

    _handleWeaponSwitch() {
        const weapons = this.player.weapons;
        for (let i = 0; i < weapons.length && i < 4; i++) {
            if (this.input.isDown(`Digit${i + 1}`)) {
                this.player.currentWeapon = weapons[i];
            }
        }
    }
}
