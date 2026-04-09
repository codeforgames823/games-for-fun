import { Engine } from './engine.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { VehicleSystem } from './vehicles.js';
import { Combat } from './combat.js';
import { NPCSystem } from './npcs.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { CONFIG } from './config.js';

class Game {
    constructor() {
        this.started = false;
    }

    start() {
        if (this.started) return;
        this.started = true;

        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        const canvas = document.getElementById('game-canvas');
        this.engine = new Engine(canvas);
        this.input = new Input(canvas);
        this.audio = new Audio();

        this.city = new City(this.engine.scene);
        this.city.generate();

        this.player = new Player(this.engine.scene, this.input, this.city);

        this.vehicles = new VehicleSystem(this.engine.scene, this.city);
        this.vehicles.spawnVehicles();

        this.combat = new Combat(this.engine.scene, this.player, this.input);
        this.combat.spawnPickups(this.city.weaponSpawns);

        this.npcs = new NPCSystem(this.engine.scene, this.city);
        this.npcs.spawn(this.player.position);

        this.police = new PoliceSystem(this.engine.scene, this.city, this.vehicles);

        this.missions = new MissionSystem(this.engine.scene, this.player);
        this.missions.onBriefing = (title, text) => this.ui.showBriefing(title, text);
        this.missions.onMissionComplete = (m) => {
            this.ui.showMissionComplete(m);
            this.audio.playMissionComplete();
        };
        this.missions.onTriggerPolice = (level) => {
            this.police.wantedLevel = level;
            this.police.lastCrimeTime = performance.now() / 1000;
        };

        this.ui = new UI();

        this.paused = false;
        this.lastShotFired = false;
        this.fKeyWasDown = false;
        this.pauseWasDown = false;
        this.gameTime = 0;
        this.crosshairEl = document.getElementById('crosshair');

        this.engine.onUpdate((dt) => this.update(dt));
        this.engine.start();

        this.audio.init();

        this.clickHint = document.getElementById('click-hint');

        const tryLock = () => {
            if (!this.input.locked) canvas.requestPointerLock().catch(() => {});
        };
        canvas.requestPointerLock().catch(() => {});
        canvas.addEventListener('click', tryLock);
        this.clickHint.addEventListener('click', () => {
            tryLock();
            this.clickHint.style.display = 'none';
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement !== canvas && this.started) {
                this.clickHint.style.display = 'flex';
            } else {
                this.clickHint.style.display = 'none';
            }
        });
    }

    update(dt) {
        this.crosshairEl.style.display = this.input.locked && !this.player.inVehicle ? 'block' : 'none';

        const pauseDown = this.input.isDown('KeyP') || this.input.isDown('Tab');
        if (pauseDown && !this.pauseWasDown) {
            this.paused = !this.paused;
            document.getElementById('pause-menu').style.display = this.paused ? 'flex' : 'none';
        }
        this.pauseWasDown = pauseDown;

        if (this.ui.briefingVisible) return;
        if (this.paused) return;

        this.gameTime += dt;
        this._updateDayNight();

        this.player.update(dt, this.engine.camera);

        const fDown = this.input.isDown('KeyF');
        if (fDown && !this.fKeyWasDown) {
            if (this.player.inVehicle) {
                this.player.exitVehicle();
                this.audio.stopEngine();
            } else {
                const nearest = this.vehicles.getNearestVehicle(
                    this.player.position, CONFIG.VEHICLE_ENTER_RANGE
                );
                if (nearest) {
                    this.player.enterVehicle(nearest);
                    if (!nearest.isPolice) {
                        // no crime for entering non-police vehicles... unless occupied
                    } else {
                        this.police.reportCrime(2);
                    }
                }
            }
        }
        this.fKeyWasDown = fDown;

        this.vehicles.update(dt, this.input, this.player.inVehicle);

        const allTargets = [...this.npcs.getTargets(), ...this.police.getTargets()];
        const prevWeaponPickups = this.combat.weaponPickups.filter(p => !p.collected).length;
        this.combat.update(dt, allTargets);
        const newWeaponPickups = this.combat.weaponPickups.filter(p => !p.collected).length;
        if (newWeaponPickups < prevWeaponPickups) this.audio.playPickup();

        const shotFired = this.input.mouseDown && this.player.currentWeapon !== 'fists' && !this.player.inVehicle;
        if (shotFired && !this.lastShotFired) {
            this.audio.playGunshot(this.player.currentWeapon);
        }
        if (this.input.mouseDown && this.player.currentWeapon === 'fists' && !this.player.inVehicle) {
            this.audio.playPunch();
        }
        this.lastShotFired = shotFired;

        const npcAliveSet = new Set(this.npcs.npcs.filter(n => n.alive));
        this.npcs.update(dt, this.player.position, shotFired);
        let npcsKilled = 0;
        for (const n of npcAliveSet) {
            if (!n.alive) npcsKilled++;
        }
        if (npcsKilled > 0) {
            this.police.reportCrime(1);
            for (let i = 0; i < npcsKilled; i++) this.missions.reportKill();
            this.player.cash += npcsKilled * 10;
        }

        const copAliveSet = new Set(this.police.officers.filter(o => o.alive));
        this.police.update(dt, this.player.position);
        let copsKilled = 0;
        for (const c of copAliveSet) {
            if (!c.alive) copsKilled++;
        }
        if (copsKilled > 0) {
            this.police.reportCrime(2);
        }

        const policeDamage = this._checkPoliceDamage(dt);
        if (policeDamage) {
            this.player.takeDamage(policeDamage.damage);
            if (this.player.health <= 0) {
                this.ui.showDeath();
                this.police.wantedLevel = 0;
                this.police._despawnAll();
            }
        }

        if (this.player.inVehicle) {
            this.audio.playEngineLoop(Math.abs(this.player.inVehicle.velocity));
        }

        if (this.police.wantedLevel > 0) {
            this.audio.playSiren();
        } else {
            this.audio.stopSiren();
        }

        this.missions.update(dt);

        this.engine.sun.position.set(
            this.player.position.x + 100,
            150,
            this.player.position.z + 80
        );
        this.engine.sun.target.position.copy(this.player.position);
        this.engine.sun.target.updateMatrixWorld();

        this.ui.update(this.player, this.police, this.missions, this.combat);
    }

    _updateDayNight() {
        const cycleLength = 300;
        const t = (this.gameTime % cycleLength) / cycleLength;
        const sunAngle = t * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);
        const isNight = sunHeight < -0.1;

        const intensity = Math.max(0.1, sunHeight * 1.5 + 0.5);
        this.engine.sun.intensity = intensity * 1.8;

        if (isNight) {
            const nightColor = 0x0a0a2e;
            this.engine.scene.background.setHex(nightColor);
            this.engine.scene.fog.color.setHex(nightColor);
        } else {
            const dayProgress = Math.max(0, sunHeight);
            const r = Math.floor(0x87 + (0xff - 0x87) * dayProgress * 0.3);
            const g = Math.floor(0xce * dayProgress + 0x40 * (1 - dayProgress));
            const b = Math.floor(0xeb * dayProgress + 0x60 * (1 - dayProgress));
            const skyColor = (r << 16) | (g << 8) | b;
            this.engine.scene.background.setHex(skyColor);
            this.engine.scene.fog.color.setHex(skyColor);
        }
    }

    _checkPoliceDamage(dt) {
        for (const cop of this.police.officers) {
            if (!cop.alive) continue;
            const dist = cop.mesh.position.distanceTo(this.player.position);
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
}

const game = new Game();

document.getElementById('start-btn').addEventListener('click', () => {
    game.start();
});

document.getElementById('resume-btn')?.addEventListener('click', () => {
    game.paused = false;
    document.getElementById('pause-menu').style.display = 'none';
});
