import * as THREE from 'three';
import { CONFIG } from './config.js';

const VEHICLE_TYPES = [
    { name: 'Sedan', w: 2, h: 1.4, d: 4.5, maxSpeed: 40, accel: 25, color: null },
    { name: 'Sports', w: 1.9, h: 1.1, d: 4.2, maxSpeed: 55, accel: 35, color: null },
    { name: 'Truck', w: 2.4, h: 2.0, d: 5.5, maxSpeed: 30, accel: 18, color: null },
    { name: 'Motorcycle', w: 0.8, h: 1.2, d: 2.5, maxSpeed: 50, accel: 30, color: null },
];

export class VehicleSystem {
    constructor(scene, city) {
        this.scene = scene;
        this.city = city;
        this.vehicles = [];
    }

    spawnVehicles() {
        const spawns = this.city.vehicleSpawns;
        const maxVehicles = Math.min(spawns.length, 80);
        for (let i = 0; i < maxVehicles; i++) {
            const sp = spawns[i];
            this.spawnVehicle(sp.x, sp.z, sp.rotation, sp.type);
        }
    }

    spawnVehicle(x, z, rotation, typeIdx, colorOverride) {
        const type = VEHICLE_TYPES[typeIdx % VEHICLE_TYPES.length];
        const color = colorOverride || CONFIG.COLORS.vehicleColors[Math.floor(Math.random() * CONFIG.COLORS.vehicleColors.length)];

        const group = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(type.w, type.h * 0.5, type.d);
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = type.h * 0.4;
        body.castShadow = true;
        group.add(body);

        if (typeIdx !== 3) {
            const cabinGeo = new THREE.BoxGeometry(type.w * 0.85, type.h * 0.4, type.d * 0.45);
            const cabinMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.6 });
            const cabin = new THREE.Mesh(cabinGeo, cabinMat);
            cabin.position.y = type.h * 0.7;
            cabin.position.z = -type.d * 0.05;
            group.add(cabin);
        }

        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const wheelPositions = typeIdx === 3
            ? [[0, 0.35, type.d * 0.35], [0, 0.35, -type.d * 0.35]]
            : [
                [-type.w / 2, 0.35, type.d * 0.3],
                [type.w / 2, 0.35, type.d * 0.3],
                [-type.w / 2, 0.35, -type.d * 0.3],
                [type.w / 2, 0.35, -type.d * 0.3],
            ];

        const wheels = [];
        for (const [wx, wy, wz] of wheelPositions) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx, wy, wz);
            group.add(wheel);
            wheels.push(wheel);
        }

        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        for (const side of [-1, 1]) {
            const hl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), headlightMat);
            hl.position.set(side * type.w * 0.35, type.h * 0.35, -type.d / 2);
            group.add(hl);
        }

        const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        for (const side of [-1, 1]) {
            const tl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), taillightMat);
            tl.position.set(side * type.w * 0.35, type.h * 0.35, type.d / 2);
            group.add(tl);
        }

        group.position.set(x, 0, z);
        group.rotation.y = rotation;
        this.scene.add(group);

        const vehicle = {
            mesh: group,
            wheels,
            type,
            typeIdx,
            velocity: 0,
            steerAngle: 0,
            occupied: false,
            isPolice: false,
            health: 100,
        };
        this.vehicles.push(vehicle);
        return vehicle;
    }

    spawnPoliceVehicle(x, z, rotation) {
        const v = this.spawnVehicle(x, z, rotation, 0, CONFIG.COLORS.policeCar);
        v.isPolice = true;
        v.type = { ...v.type, maxSpeed: CONFIG.POLICE_CAR_SPEED, accel: 30 };

        const lightBar = new THREE.Group();
        const redLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.25, 0.3),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        redLight.position.set(-0.4, 0, 0);
        lightBar.add(redLight);

        const blueLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.25, 0.3),
            new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        blueLight.position.set(0.4, 0, 0);
        lightBar.add(blueLight);

        lightBar.position.y = v.type.h * 0.95;
        v.mesh.add(lightBar);
        v.lightBar = lightBar;
        v.redLight = redLight;
        v.blueLight = blueLight;

        return v;
    }

    update(dt, playerInput, playerInVehicle) {
        for (const v of this.vehicles) {
            if (v.occupied && playerInVehicle === v) {
                this._driveVehicle(v, dt, playerInput);
            }
            for (const w of v.wheels) {
                w.rotation.x += v.velocity * dt * 2;
            }
            if (v.lightBar) {
                const t = performance.now() * 0.005;
                v.redLight.visible = Math.sin(t) > 0;
                v.blueLight.visible = Math.sin(t) <= 0;
            }
        }
    }

    _driveVehicle(v, dt, input) {
        const accel = v.type.accel;
        const maxSpeed = v.type.maxSpeed;

        if (input.isDown('KeyW')) {
            v.velocity = Math.min(maxSpeed, v.velocity + accel * dt);
        } else if (input.isDown('KeyS')) {
            v.velocity = Math.max(-maxSpeed * 0.3, v.velocity - CONFIG.VEHICLE_BRAKE * dt);
        } else {
            v.velocity *= CONFIG.VEHICLE_FRICTION;
            if (Math.abs(v.velocity) < 0.1) v.velocity = 0;
        }

        if (Math.abs(v.velocity) > 0.5) {
            const steerInput = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
            const steerAmount = steerInput * CONFIG.VEHICLE_STEER_SPEED * dt * Math.sign(v.velocity);
            v.mesh.rotation.y += steerAmount;
        }

        const dir = new THREE.Vector3(
            -Math.sin(v.mesh.rotation.y),
            0,
            -Math.cos(v.mesh.rotation.y)
        );

        const newX = v.mesh.position.x + dir.x * v.velocity * dt;
        const newZ = v.mesh.position.z + dir.z * v.velocity * dt;

        const testPos = new THREE.Vector3(newX, 0, newZ);
        if (!this.city.checkCollision(testPos, v.type.w)) {
            v.mesh.position.x = newX;
            v.mesh.position.z = newZ;
        } else {
            v.velocity *= -0.3;
        }

        if (input.isDown('Space')) {
            v.velocity *= 0.95;
        }
    }

    getNearestVehicle(position, maxRange) {
        let nearest = null;
        let nearestDist = maxRange;
        for (const v of this.vehicles) {
            if (v.occupied) continue;
            const dist = position.distanceTo(v.mesh.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = v;
            }
        }
        return nearest;
    }

    removeVehicle(v) {
        this.scene.remove(v.mesh);
        const idx = this.vehicles.indexOf(v);
        if (idx >= 0) this.vehicles.splice(idx, 1);
    }
}
