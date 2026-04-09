import * as THREE from 'three';
import { CONFIG } from './config.js';

export class PoliceSystem {
    constructor(scene, city, vehicleSystem) {
        this.scene = scene;
        this.city = city;
        this.vehicleSystem = vehicleSystem;
        this.wantedLevel = 0;
        this.wantedTimer = 0;
        this.lastCrimeTime = 0;
        this.officers = [];
        this.policeCars = [];
        this.helicopter = null;
    }

    reportCrime(severity) {
        this.wantedLevel = Math.min(5, this.wantedLevel + severity);
        this.lastCrimeTime = performance.now() / 1000;
        this.wantedTimer = CONFIG.WANTED_DECAY_TIME;
    }

    update(dt, playerPosition) {
        const now = performance.now() / 1000;

        if (this.wantedLevel > 0 && now - this.lastCrimeTime > CONFIG.WANTED_DECAY_TIME) {
            this.wantedTimer -= dt;
            if (this.wantedTimer <= 0) {
                this.wantedLevel = Math.max(0, this.wantedLevel - 1);
                this.wantedTimer = CONFIG.WANTED_DECAY_TIME;
                if (this.wantedLevel === 0) this._despawnAll();
            }
        }

        const targetOfficers = this._targetOfficerCount();
        while (this.officers.length < targetOfficers) {
            this._spawnOfficer(playerPosition);
        }

        if (this.wantedLevel >= 2) {
            const targetCars = Math.min(this.wantedLevel - 1, 3);
            while (this.policeCars.length < targetCars) {
                this._spawnPoliceCar(playerPosition);
            }
        }

        if (this.wantedLevel >= 4 && !this.helicopter) {
            this._spawnHelicopter(playerPosition);
        }
        if (this.wantedLevel < 4 && this.helicopter) {
            this._despawnHelicopter();
        }

        this._updateOfficers(dt, playerPosition);
        this._updatePoliceCars(dt, playerPosition);
        this._updateHelicopter(dt, playerPosition);
    }

    _targetOfficerCount() {
        if (this.wantedLevel === 0) return 0;
        return this.wantedLevel * 2;
    }

    _spawnOfficer(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = CONFIG.POLICE_SPAWN_DISTANCE;
        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;

        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.8, 0.3),
            new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.police })
        );
        body.position.y = 1.0;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshLambertMaterial({ color: 0xffcc99 })
        );
        head.position.y = 1.6;
        group.add(head);

        const hat = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.12, 0.35),
            new THREE.MeshLambertMaterial({ color: 0x111155 })
        );
        hat.position.y = 1.82;
        group.add(hat);

        const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.2);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x111133 });
        const lLeg = new THREE.Mesh(legGeo, legMat);
        lLeg.position.set(-0.12, 0.25, 0);
        group.add(lLeg);
        const rLeg = new THREE.Mesh(legGeo, legMat);
        rLeg.position.set(0.12, 0.25, 0);
        group.add(rLeg);

        group.position.set(x, 0, z);
        this.scene.add(group);

        this.officers.push({
            mesh: group,
            lLeg, rLeg,
            health: CONFIG.POLICE_HEALTH,
            alive: true,
            shootTimer: 2,
            takeDamage(amount) {
                this.health -= amount;
                if (this.health <= 0) {
                    this.alive = false;
                    this.health = 0;
                }
            }
        });
    }

    _spawnPoliceCar(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const dist = CONFIG.POLICE_SPAWN_DISTANCE + 20;
        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;
        const v = this.vehicleSystem.spawnPoliceVehicle(x, z, angle);
        this.policeCars.push(v);
    }

    _spawnHelicopter(playerPos) {
        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1.5, 4),
            new THREE.MeshLambertMaterial({ color: 0x222244 })
        );
        group.add(body);

        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 3),
            new THREE.MeshLambertMaterial({ color: 0x222244 })
        );
        tail.position.set(0, 0.3, 3);
        group.add(tail);

        const rotorGeo = new THREE.BoxGeometry(8, 0.05, 0.3);
        const rotorMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const rotor = new THREE.Mesh(rotorGeo, rotorMat);
        rotor.position.y = 1;
        group.add(rotor);
        this._heliRotor = rotor;

        const spotlight = new THREE.SpotLight(0xffffff, 2, 100, Math.PI / 8);
        spotlight.position.set(0, -0.5, 0);
        spotlight.target.position.set(0, -50, 0);
        group.add(spotlight);
        group.add(spotlight.target);

        group.position.set(playerPos.x, 50, playerPos.z);
        this.scene.add(group);
        this.helicopter = group;
    }

    _despawnHelicopter() {
        if (this.helicopter) {
            this.scene.remove(this.helicopter);
            this.helicopter = null;
        }
    }

    _updateOfficers(dt, playerPos) {
        for (let i = this.officers.length - 1; i >= 0; i--) {
            const cop = this.officers[i];
            if (!cop.alive) {
                cop.mesh.rotation.z = Math.PI / 2;
                cop.mesh.position.y = -0.3;
                setTimeout(() => {
                    this.scene.remove(cop.mesh);
                }, 5000);
                this.officers.splice(i, 1);
                continue;
            }

            const toPlayer = playerPos.clone().sub(cop.mesh.position);
            toPlayer.y = 0;
            const dist = toPlayer.length();

            if (dist > 3) {
                const dir = toPlayer.normalize();
                const speed = CONFIG.POLICE_SPEED * dt;
                const newPos = cop.mesh.position.clone().add(dir.clone().multiplyScalar(speed));
                if (!this.city.checkCollision(newPos, 0.5)) {
                    cop.mesh.position.copy(newPos);
                }
                cop.mesh.rotation.y = Math.atan2(dir.x, dir.z);

                const t = performance.now() * 0.008;
                cop.lLeg.rotation.x = Math.sin(t) * 0.5;
                cop.rLeg.rotation.x = -Math.sin(t) * 0.5;
            }

            if (dist < 2.5) {
                cop.shootTimer -= dt;
                if (cop.shootTimer <= 0) {
                    cop.shootTimer = 0.8;
                    return { damage: 8 };
                }
            }
        }
        return null;
    }

    _updatePoliceCars(dt, playerPos) {
        for (const car of this.policeCars) {
            if (!car.occupied) {
                const toPlayer = playerPos.clone().sub(car.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                if (dist > 8) {
                    const targetAngle = Math.atan2(-toPlayer.x, -toPlayer.z);
                    let angleDiff = targetAngle - car.mesh.rotation.y;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    car.mesh.rotation.y += angleDiff * 2 * dt;

                    const speed = CONFIG.POLICE_CAR_SPEED * dt;
                    const dir = new THREE.Vector3(
                        -Math.sin(car.mesh.rotation.y), 0, -Math.cos(car.mesh.rotation.y)
                    );
                    const newPos = car.mesh.position.clone().add(dir.multiplyScalar(speed));
                    if (!this.city.checkCollision(newPos, 2)) {
                        car.mesh.position.copy(newPos);
                    }
                }
            }
        }
    }

    _updateHelicopter(dt, playerPos) {
        if (!this.helicopter) return;
        const target = new THREE.Vector3(playerPos.x, 50, playerPos.z);
        this.helicopter.position.lerp(target, dt * 0.5);
        if (this._heliRotor) {
            this._heliRotor.rotation.y += dt * 20;
        }
    }

    _despawnAll() {
        for (const cop of this.officers) {
            this.scene.remove(cop.mesh);
        }
        this.officers = [];

        for (const car of this.policeCars) {
            this.vehicleSystem.removeVehicle(car);
        }
        this.policeCars = [];

        this._despawnHelicopter();
    }

    getTargets() {
        return this.officers.filter(o => o.alive);
    }
}
