import * as THREE from 'three';
import { CONFIG } from './config.js';

export class City {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.colliders = [];
        this.sidewalkPaths = [];
        this.vehicleSpawns = [];
        this.weaponSpawns = [];
        this.gridSize = CONFIG.CITY_GRID_SIZE;
        this.blockSize = CONFIG.BLOCK_SIZE;
        this.roadWidth = CONFIG.ROAD_WIDTH;
        this.totalSize = this.gridSize * this.blockSize;
        this.halfSize = this.totalSize / 2;
    }

    generate() {
        this._createGround();
        this._createRoads();
        this._createBuildings();
        this._createStreetLights();
        this._createParks();
        this._createWeaponPickupLocations();
        this._createVehicleSpawnPoints();
    }

    _createGround() {
        const size = this.totalSize + 200;
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.grass });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    _createRoads() {
        const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.road });
        const sidewalkMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.sidewalk });
        const lineMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.roadLine });

        for (let i = 0; i <= this.gridSize; i++) {
            const pos = i * this.blockSize - this.halfSize;

            const hRoad = new THREE.Mesh(
                new THREE.BoxGeometry(this.totalSize, 0.1, this.roadWidth),
                roadMat
            );
            hRoad.position.set(0, 0.01, pos);
            hRoad.receiveShadow = true;
            this.scene.add(hRoad);

            const vRoad = new THREE.Mesh(
                new THREE.BoxGeometry(this.roadWidth, 0.1, this.totalSize),
                roadMat
            );
            vRoad.position.set(pos, 0.01, 0);
            vRoad.receiveShadow = true;
            this.scene.add(vRoad);

            const sw = CONFIG.SIDEWALK_WIDTH;
            const sidewalkPositions = [
                [0, pos - this.roadWidth / 2 - sw / 2, this.totalSize, sw],
                [0, pos + this.roadWidth / 2 + sw / 2, this.totalSize, sw],
                [pos - this.roadWidth / 2 - sw / 2, 0, sw, this.totalSize],
                [pos + this.roadWidth / 2 + sw / 2, 0, sw, this.totalSize],
            ];

            for (const [sx, sz, swidth, sdepth] of sidewalkPositions) {
                const sidewalk = new THREE.Mesh(
                    new THREE.BoxGeometry(swidth, 0.2, sdepth),
                    sidewalkMat
                );
                sidewalk.position.set(sx, 0.1, sz);
                sidewalk.receiveShadow = true;
                this.scene.add(sidewalk);
            }

            this.sidewalkPaths.push(
                { axis: 'x', z: pos - this.roadWidth / 2 - sw / 2, minX: -this.halfSize, maxX: this.halfSize },
                { axis: 'x', z: pos + this.roadWidth / 2 + sw / 2, minX: -this.halfSize, maxX: this.halfSize },
                { axis: 'z', x: pos - this.roadWidth / 2 - sw / 2, minZ: -this.halfSize, maxZ: this.halfSize },
                { axis: 'z', x: pos + this.roadWidth / 2 + sw / 2, minZ: -this.halfSize, maxZ: this.halfSize }
            );

            for (let seg = 0; seg < this.totalSize / 8; seg++) {
                const lineH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.15), lineMat);
                lineH.position.set(-this.halfSize + seg * 8 + 4, 0.07, pos);
                this.scene.add(lineH);

                const lineV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 3), lineMat);
                lineV.position.set(pos, 0.07, -this.halfSize + seg * 8 + 4);
                this.scene.add(lineV);
            }
        }
    }

    _createBuildings() {
        const rng = this._seededRandom(42);

        for (let gx = 0; gx < this.gridSize; gx++) {
            for (let gz = 0; gz < this.gridSize; gz++) {
                if (rng() < 0.12) continue;

                const blockX = gx * this.blockSize - this.halfSize + this.blockSize / 2;
                const blockZ = gz * this.blockSize - this.halfSize + this.blockSize / 2;
                const usable = this.blockSize - this.roadWidth - CONFIG.SIDEWALK_WIDTH * 2 - CONFIG.BUILDING_PADDING * 2;

                const subdivisions = rng() < 0.3 ? 1 : rng() < 0.6 ? 2 : Math.floor(rng() * 3) + 2;

                if (subdivisions === 1) {
                    this._placeBuilding(blockX, blockZ, usable * 0.8, usable * 0.8, rng);
                } else {
                    const cellSize = usable / subdivisions;
                    for (let sx = 0; sx < subdivisions; sx++) {
                        for (let sz = 0; sz < subdivisions; sz++) {
                            if (rng() < 0.15) continue;
                            const cx = blockX - usable / 2 + cellSize * sx + cellSize / 2;
                            const cz = blockZ - usable / 2 + cellSize * sz + cellSize / 2;
                            const bw = cellSize * (0.6 + rng() * 0.35);
                            const bd = cellSize * (0.6 + rng() * 0.35);
                            this._placeBuilding(cx, cz, bw, bd, rng);
                        }
                    }
                }
            }
        }
    }

    _placeBuilding(x, z, w, d, rng) {
        const height = CONFIG.BUILDING_MIN_HEIGHT + rng() * (CONFIG.BUILDING_MAX_HEIGHT - CONFIG.BUILDING_MIN_HEIGHT);
        const colorIdx = Math.floor(rng() * CONFIG.COLORS.buildingColors.length);
        const color = CONFIG.COLORS.buildingColors[colorIdx];

        const geo = new THREE.BoxGeometry(w, height, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        this.buildings.push(mesh);
        this.colliders.push(new THREE.Box3().setFromObject(mesh));

        if (height > 15) {
            const roofGeo = new THREE.BoxGeometry(w * 0.3, 3, d * 0.3);
            const roofMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.set(x, height + 1.5, z);
            roof.castShadow = true;
            this.scene.add(roof);
        }

        if (height > 20 && rng() < 0.4) {
            const antennaGeo = new THREE.CylinderGeometry(0.1, 0.1, 5);
            const antennaMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const antenna = new THREE.Mesh(antennaGeo, antennaMat);
            antenna.position.set(x, height + 2.5, z);
            this.scene.add(antenna);
        }

        const windowColor = 0xaaddff;
        const windowMat = new THREE.MeshBasicMaterial({ color: windowColor });
        const floors = Math.floor(height / 4);
        const windowsPerFloor = Math.max(1, Math.floor(w / 4));

        for (let f = 0; f < Math.min(floors, 8); f++) {
            for (let wi = 0; wi < windowsPerFloor; wi++) {
                const wy = f * 4 + 3;
                const wx = x - w / 2 + (wi + 0.5) * (w / windowsPerFloor);

                const winF = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), windowMat);
                winF.position.set(wx, wy, z + d / 2 + 0.01);
                this.scene.add(winF);

                const winB = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), windowMat);
                winB.position.set(wx, wy, z - d / 2 - 0.01);
                winB.rotation.y = Math.PI;
                this.scene.add(winB);
            }
        }
    }

    _createStreetLights() {
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

        for (let i = 0; i <= this.gridSize; i++) {
            const pos = i * this.blockSize - this.halfSize;
            for (let j = 0; j < this.totalSize / 20; j++) {
                const along = -this.halfSize + j * 20 + 10;

                this._addStreetLight(along, pos + this.roadWidth / 2 + 1.5, poleMat, lightMat);
                this._addStreetLight(pos + this.roadWidth / 2 + 1.5, along, poleMat, lightMat);
            }
        }
    }

    _addStreetLight(x, z, poleMat, lightMat) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6), poleMat);
        pole.position.set(x, 3, z);
        pole.castShadow = true;
        this.scene.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.1), poleMat);
        arm.position.set(x + 1, 5.9, z);
        this.scene.add(arm);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3), lightMat);
        lamp.position.set(x + 2, 5.8, z);
        this.scene.add(lamp);
    }

    _createParks() {
        const rng = this._seededRandom(99);
        const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
        const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x228833 });

        for (let gx = 0; gx < this.gridSize; gx++) {
            for (let gz = 0; gz < this.gridSize; gz++) {
                if (rng() > 0.12) continue;

                const blockX = gx * this.blockSize - this.halfSize + this.blockSize / 2;
                const blockZ = gz * this.blockSize - this.halfSize + this.blockSize / 2;
                const parkSize = this.blockSize - this.roadWidth - CONFIG.SIDEWALK_WIDTH * 2 - 4;

                for (let t = 0; t < 6; t++) {
                    const tx = blockX + (rng() - 0.5) * parkSize;
                    const tz = blockZ + (rng() - 0.5) * parkSize;
                    const treeH = 4 + rng() * 4;

                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, treeH), treeTrunkMat);
                    trunk.position.set(tx, treeH / 2, tz);
                    trunk.castShadow = true;
                    this.scene.add(trunk);

                    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2 + rng() * 1.5, 6, 5), treeLeafMat);
                    canopy.position.set(tx, treeH + 1, tz);
                    canopy.castShadow = true;
                    this.scene.add(canopy);
                }
            }
        }
    }

    _createWeaponPickupLocations() {
        const rng = this._seededRandom(77);
        const weapons = ['pistol', 'shotgun', 'smg'];
        for (let i = 0; i < 30; i++) {
            const x = (rng() - 0.5) * this.totalSize * 0.8;
            const z = (rng() - 0.5) * this.totalSize * 0.8;
            this.weaponSpawns.push({ x, z, type: weapons[Math.floor(rng() * weapons.length)] });
        }
    }

    _createVehicleSpawnPoints() {
        const rng = this._seededRandom(55);
        for (let i = 0; i <= this.gridSize; i++) {
            const pos = i * this.blockSize - this.halfSize;
            for (let j = 0; j < this.gridSize; j++) {
                const along = j * this.blockSize - this.halfSize + this.blockSize / 2;
                if (rng() < 0.6) {
                    this.vehicleSpawns.push({
                        x: along, z: pos + this.roadWidth / 2 - 2,
                        rotation: 0,
                        type: Math.floor(rng() * 4)
                    });
                }
                if (rng() < 0.6) {
                    this.vehicleSpawns.push({
                        x: pos + this.roadWidth / 2 - 2, z: along,
                        rotation: Math.PI / 2,
                        type: Math.floor(rng() * 4)
                    });
                }
            }
        }
    }

    checkCollision(position, radius) {
        const playerBox = new THREE.Box3(
            new THREE.Vector3(position.x - radius, position.y, position.z - radius),
            new THREE.Vector3(position.x + radius, position.y + CONFIG.PLAYER_HEIGHT, position.z + radius)
        );
        for (const box of this.colliders) {
            if (playerBox.intersectsBox(box)) return true;
        }
        return false;
    }

    isOnRoad(x, z) {
        const localX = ((x + this.halfSize) % this.blockSize);
        const localZ = ((z + this.halfSize) % this.blockSize);
        return localX < this.roadWidth || localZ < this.roadWidth;
    }

    getRandomSidewalkPoint(rng) {
        if (this.sidewalkPaths.length === 0) return { x: 0, z: 0 };
        const path = this.sidewalkPaths[Math.floor((rng ? rng() : Math.random()) * this.sidewalkPaths.length)];
        if (path.axis === 'x') {
            return { x: path.minX + (rng ? rng() : Math.random()) * (path.maxX - path.minX), z: path.z };
        } else {
            return { x: path.x, z: path.minZ + (rng ? rng() : Math.random()) * (path.maxZ - path.minZ) };
        }
    }

    _seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
}
