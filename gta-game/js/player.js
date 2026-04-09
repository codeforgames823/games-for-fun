import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player {
    constructor(scene, input, city) {
        this.scene = scene;
        this.input = input;
        this.city = city;

        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3();
        this.rotation = 0;
        this.cameraYaw = 0;
        this.cameraPitch = -0.3;
        this.onGround = true;

        this.health = CONFIG.PLAYER_MAX_HEALTH;
        this.armor = 0;
        this.cash = 500;
        this.lastDamageTime = 0;

        this.inVehicle = null;
        this.currentWeapon = 'fists';
        this.ammo = { pistol: 0, shotgun: 0, smg: 0 };
        this.weapons = ['fists'];

        this.mesh = this._createPlayerMesh();
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    _createPlayerMesh() {
        const group = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.35);
        const bodyMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.player });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.05;
        body.castShadow = true;
        group.add(body);

        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.7;
        head.castShadow = true;
        group.add(head);

        const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.25);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x333355 });
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.15, 0.3, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);
        this.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.15, 0.3, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);
        this.rightLeg = rightLeg;

        const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.2);
        const armMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.player });
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(-0.42, 1.05, 0);
        leftArm.castShadow = true;
        group.add(leftArm);
        this.leftArm = leftArm;

        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(0.42, 1.05, 0);
        rightArm.castShadow = true;
        group.add(rightArm);
        this.rightArm = rightArm;

        return group;
    }

    update(dt, camera) {
        if (this.inVehicle) {
            this._updateInVehicle(dt, camera);
            return;
        }

        this._updateCamera(dt, camera);
        this._updateMovement(dt);
        this._updateAnimation(dt);
        this._updateHealth(dt);

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }

    _updateCamera(dt, camera) {
        const mouse = this.input.consumeMouse();
        this.cameraYaw -= mouse.dx * 0.003;
        this.cameraPitch -= mouse.dy * 0.003;
        this.cameraPitch = Math.max(-1.2, Math.min(0.5, this.cameraPitch));

        const dist = CONFIG.CAM_DISTANCE;
        const height = CONFIG.CAM_HEIGHT;

        const idealX = this.position.x + Math.sin(this.cameraYaw) * dist * Math.cos(this.cameraPitch);
        const idealY = this.position.y + height - Math.sin(this.cameraPitch) * dist;
        const idealZ = this.position.z + Math.cos(this.cameraYaw) * dist * Math.cos(this.cameraPitch);

        const lerp = 1 - Math.pow(1 - CONFIG.CAM_LERP, dt * 60);
        camera.position.lerp(new THREE.Vector3(idealX, idealY, idealZ), lerp);

        const lookTarget = new THREE.Vector3(
            this.position.x, this.position.y + CONFIG.PLAYER_HEIGHT * 0.7, this.position.z
        );
        camera.lookAt(lookTarget);
    }

    _updateMovement(dt) {
        const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
        const right = new THREE.Vector3(forward.z, 0, -forward.x);

        let moveDir = new THREE.Vector3();
        if (this.input.isDown('KeyW')) moveDir.add(forward);
        if (this.input.isDown('KeyS')) moveDir.sub(forward);
        if (this.input.isDown('KeyA')) moveDir.sub(right);
        if (this.input.isDown('KeyD')) moveDir.add(right);

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            const speed = CONFIG.PLAYER_SPEED * (this.input.isDown('ShiftLeft') ? CONFIG.PLAYER_SPRINT_MULT : 1);
            this.velocity.x = moveDir.x * speed;
            this.velocity.z = moveDir.z * speed;
            this.rotation = Math.atan2(moveDir.x, moveDir.z);
        } else {
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
        }

        if (this.input.isDown('Space') && this.onGround) {
            this.velocity.y = CONFIG.PLAYER_JUMP_FORCE;
            this.onGround = false;
        }

        this.velocity.y -= CONFIG.GRAVITY * dt;

        const newPos = this.position.clone();
        newPos.x += this.velocity.x * dt;
        if (!this.city.checkCollision(newPos, CONFIG.PLAYER_RADIUS)) {
            this.position.x = newPos.x;
        } else {
            this.velocity.x = 0;
        }

        newPos.copy(this.position);
        newPos.z += this.velocity.z * dt;
        if (!this.city.checkCollision(newPos, CONFIG.PLAYER_RADIUS)) {
            this.position.z = newPos.z;
        } else {
            this.velocity.z = 0;
        }

        this.position.y += this.velocity.y * dt;
        if (this.position.y <= CONFIG.GROUND_Y) {
            this.position.y = CONFIG.GROUND_Y;
            this.velocity.y = 0;
            this.onGround = true;
        }
    }

    _updateAnimation(dt) {
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (speed > 0.5) {
            const t = performance.now() * 0.008 * (speed / CONFIG.PLAYER_SPEED);
            const swing = Math.sin(t) * 0.5;
            this.leftLeg.rotation.x = swing;
            this.rightLeg.rotation.x = -swing;
            this.leftArm.rotation.x = -swing * 0.7;
            this.rightArm.rotation.x = swing * 0.7;
        } else {
            this.leftLeg.rotation.x *= 0.9;
            this.rightLeg.rotation.x *= 0.9;
            this.leftArm.rotation.x *= 0.9;
            this.rightArm.rotation.x *= 0.9;
        }
    }

    _updateInVehicle(dt, camera) {
        this.mesh.visible = false;
        const v = this.inVehicle;
        this.position.copy(v.mesh.position);

        const mouse = this.input.consumeMouse();
        this.cameraYaw -= mouse.dx * 0.003;

        const dist = CONFIG.CAM_DRIVE_DISTANCE;
        const height = CONFIG.CAM_DRIVE_HEIGHT;
        const idealX = v.mesh.position.x + Math.sin(this.cameraYaw) * dist;
        const idealY = v.mesh.position.y + height;
        const idealZ = v.mesh.position.z + Math.cos(this.cameraYaw) * dist;

        const lerp = 1 - Math.pow(1 - CONFIG.CAM_LERP, dt * 60);
        camera.position.lerp(new THREE.Vector3(idealX, idealY, idealZ), lerp);
        camera.lookAt(v.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    }

    _updateHealth(dt) {
        const now = performance.now() / 1000;
        if (now - this.lastDamageTime > CONFIG.PLAYER_HEALTH_REGEN_DELAY && this.health < CONFIG.PLAYER_MAX_HEALTH) {
            this.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, this.health + CONFIG.PLAYER_HEALTH_REGEN_RATE * dt);
        }
    }

    takeDamage(amount) {
        this.lastDamageTime = performance.now() / 1000;
        if (this.armor > 0) {
            const absorbed = Math.min(this.armor, amount * 0.6);
            this.armor -= absorbed;
            amount -= absorbed;
        }
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    die() {
        this.health = CONFIG.PLAYER_MAX_HEALTH;
        this.armor = 0;
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.cash = Math.max(0, this.cash - 100);
        if (this.inVehicle) {
            this.exitVehicle();
        }
        this.weapons = ['fists'];
        this.currentWeapon = 'fists';
        this.ammo = { pistol: 0, shotgun: 0, smg: 0 };
    }

    enterVehicle(vehicle) {
        this.inVehicle = vehicle;
        vehicle.occupied = true;
        this.mesh.visible = false;
    }

    exitVehicle() {
        if (!this.inVehicle) return;
        const v = this.inVehicle;
        this.position.set(
            v.mesh.position.x + Math.cos(v.mesh.rotation.y) * 3,
            0,
            v.mesh.position.z + Math.sin(v.mesh.rotation.y) * 3
        );
        v.velocity = 0;
        v.occupied = false;
        this.inVehicle = null;
        this.mesh.visible = true;
        this.mesh.position.copy(this.position);
    }

    giveWeapon(type, ammoAmount) {
        if (!this.weapons.includes(type)) this.weapons.push(type);
        if (type !== 'fists') this.ammo[type] = (this.ammo[type] || 0) + ammoAmount;
    }
}
