import * as THREE from 'three';
import { CONFIG } from './config.js';

const NPC_STATE = { WALKING: 0, FLEEING: 1, DEAD: 2 };

export class NPCSystem {
    constructor(scene, city) {
        this.scene = scene;
        this.city = city;
        this.npcs = [];
        this.alertRadius = 30;
    }

    spawn(playerPosition) {
        while (this.npcs.length < CONFIG.NPC_COUNT) {
            const point = this.city.getRandomSidewalkPoint();
            const dist = new THREE.Vector2(point.x - playerPosition.x, point.z - playerPosition.z).length();
            if (dist > CONFIG.NPC_DESPAWN_RADIUS) continue;

            this._spawnNPC(point.x, point.z);
        }
    }

    _spawnNPC(x, z) {
        const color = CONFIG.COLORS.npcColors[Math.floor(Math.random() * CONFIG.COLORS.npcColors.length)];
        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.8, 0.3),
            new THREE.MeshLambertMaterial({ color })
        );
        body.position.y = 1.0;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshLambertMaterial({ color: 0xffcc99 })
        );
        head.position.y = 1.6;
        head.castShadow = true;
        group.add(head);

        const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.2);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const lLeg = new THREE.Mesh(legGeo, legMat);
        lLeg.position.set(-0.12, 0.25, 0);
        group.add(lLeg);
        const rLeg = new THREE.Mesh(legGeo, legMat);
        rLeg.position.set(0.12, 0.25, 0);
        group.add(rLeg);

        group.position.set(x, 0, z);
        this.scene.add(group);

        const walkDir = Math.random() * Math.PI * 2;
        this.npcs.push({
            mesh: group,
            body, lLeg, rLeg,
            state: NPC_STATE.WALKING,
            health: CONFIG.NPC_HEALTH,
            alive: true,
            speed: CONFIG.NPC_SPEED * (0.7 + Math.random() * 0.6),
            direction: new THREE.Vector3(Math.sin(walkDir), 0, Math.cos(walkDir)),
            turnTimer: Math.random() * 5,
            fleeDir: new THREE.Vector3(),
            deathTimer: 0,
            takeDamage(amount) {
                this.health -= amount;
                if (this.health <= 0) {
                    this.health = 0;
                    this.state = NPC_STATE.DEAD;
                    this.alive = false;
                    this.deathTimer = 8;
                }
            }
        });
    }

    update(dt, playerPosition, shotsFired) {
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];

            if (npc.state === NPC_STATE.DEAD) {
                npc.deathTimer -= dt;
                npc.mesh.rotation.z = Math.PI / 2;
                npc.mesh.position.y = -0.3;
                if (npc.deathTimer <= 0) {
                    this.scene.remove(npc.mesh);
                    this.npcs.splice(i, 1);
                }
                continue;
            }

            const distToPlayer = npc.mesh.position.distanceTo(playerPosition);

            if (distToPlayer > CONFIG.NPC_DESPAWN_RADIUS) {
                this.scene.remove(npc.mesh);
                this.npcs.splice(i, 1);
                continue;
            }

            if (shotsFired && distToPlayer < this.alertRadius) {
                npc.state = NPC_STATE.FLEEING;
                npc.fleeDir.copy(npc.mesh.position).sub(playerPosition).normalize();
                npc.fleeDir.y = 0;
            }

            if (npc.state === NPC_STATE.WALKING) {
                this._updateWalking(npc, dt);
            } else if (npc.state === NPC_STATE.FLEEING) {
                this._updateFleeing(npc, dt, playerPosition);
            }

            const speed = npc.state === NPC_STATE.FLEEING ? CONFIG.NPC_FLEE_SPEED : npc.speed;
            const t = performance.now() * 0.006 * (speed / CONFIG.NPC_SPEED);
            const swing = Math.sin(t) * 0.4;
            npc.lLeg.rotation.x = swing;
            npc.rLeg.rotation.x = -swing;
        }

        while (this.npcs.length < CONFIG.NPC_COUNT) {
            const angle = Math.random() * Math.PI * 2;
            const dist = CONFIG.NPC_SPAWN_RADIUS * (0.5 + Math.random() * 0.5);
            const x = playerPosition.x + Math.cos(angle) * dist;
            const z = playerPosition.z + Math.sin(angle) * dist;
            this._spawnNPC(x, z);
        }
    }

    _updateWalking(npc, dt) {
        npc.turnTimer -= dt;
        if (npc.turnTimer <= 0) {
            const angle = (Math.random() - 0.5) * Math.PI * 0.5;
            npc.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            npc.turnTimer = 2 + Math.random() * 5;
        }

        const move = npc.direction.clone().multiplyScalar(npc.speed * dt);
        npc.mesh.position.add(move);
        npc.mesh.rotation.y = Math.atan2(npc.direction.x, npc.direction.z);

        if (this.city.checkCollision(npc.mesh.position, 0.5)) {
            npc.mesh.position.sub(move);
            npc.direction.negate();
        }
    }

    _updateFleeing(npc, dt, playerPosition) {
        const dist = npc.mesh.position.distanceTo(playerPosition);
        if (dist > this.alertRadius * 2) {
            npc.state = NPC_STATE.WALKING;
            return;
        }

        npc.fleeDir.copy(npc.mesh.position).sub(playerPosition).normalize();
        npc.fleeDir.y = 0;

        const move = npc.fleeDir.clone().multiplyScalar(CONFIG.NPC_FLEE_SPEED * dt);
        npc.mesh.position.add(move);
        npc.mesh.rotation.y = Math.atan2(npc.fleeDir.x, npc.fleeDir.z);

        if (this.city.checkCollision(npc.mesh.position, 0.5)) {
            npc.mesh.position.sub(move);
            const angle = (Math.random() - 0.5) * Math.PI;
            npc.fleeDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        }
    }

    getTargets() {
        return this.npcs.filter(n => n.alive);
    }
}
