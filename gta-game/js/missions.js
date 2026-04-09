import * as THREE from 'three';
import { CONFIG } from './config.js';

const MISSION_DEFS = [
    {
        id: 'intro',
        title: 'Welcome to Vice Town',
        briefing: 'Get to know the city. Walk to the marker to meet your contact.',
        type: 'goto',
        targetX: 30, targetZ: 30,
        reward: 200,
        nextMission: 'first_ride',
    },
    {
        id: 'first_ride',
        title: 'First Ride',
        briefing: 'Steal a car and drive to the warehouse on the east side.',
        type: 'drive_to',
        targetX: 200, targetZ: 50,
        reward: 500,
        rewardWeapon: 'pistol',
        rewardAmmo: 30,
        nextMission: 'clean_up',
    },
    {
        id: 'clean_up',
        title: 'Clean Up',
        briefing: 'Some thugs are causing trouble. Take out 3 of them near the park.',
        type: 'eliminate',
        targetX: -100, targetZ: -80,
        killsRequired: 3,
        reward: 800,
        nextMission: 'hot_pursuit',
    },
    {
        id: 'hot_pursuit',
        title: 'Hot Pursuit',
        briefing: 'The cops are onto us. Get to the safehouse before they catch you!',
        type: 'escape',
        targetX: -200, targetZ: 150,
        reward: 1000,
        rewardWeapon: 'shotgun',
        rewardAmmo: 20,
        nextMission: 'arms_deal',
    },
    {
        id: 'arms_deal',
        title: 'Arms Deal',
        briefing: 'Pick up the package at the docks and deliver it across town.',
        type: 'drive_to',
        targetX: 250, targetZ: -200,
        reward: 1500,
        rewardWeapon: 'smg',
        rewardAmmo: 60,
        nextMission: 'turf_war',
    },
    {
        id: 'turf_war',
        title: 'Turf War',
        briefing: 'Take out 5 rival gang members to claim this territory.',
        type: 'eliminate',
        targetX: -150, targetZ: -200,
        killsRequired: 5,
        reward: 2000,
        nextMission: 'grand_heist',
    },
    {
        id: 'grand_heist',
        title: 'The Grand Heist',
        briefing: 'This is the big one. Drive to the bank, grab the loot, and escape!',
        type: 'drive_to',
        targetX: 0, targetZ: -250,
        reward: 5000,
        nextMission: null,
    },
];

export class MissionSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.missions = MISSION_DEFS;
        this.currentMissionId = 'intro';
        this.activeMission = null;
        this.missionActive = false;
        this.missionMarker = null;
        this.targetMarker = null;
        this.killCount = 0;
        this.completed = new Set();

        this.onMissionStart = null;
        this.onMissionComplete = null;
        this.onBriefing = null;

        this._createMissionMarker();
    }

    _createMissionMarker() {
        const geo = new THREE.CylinderGeometry(0, 1.5, 3, 4);
        const mat = new THREE.MeshBasicMaterial({ color: CONFIG.MISSION_MARKER_COLOR, transparent: true, opacity: 0.8 });
        this.missionMarker = new THREE.Mesh(geo, mat);
        this.missionMarker.position.y = 4;
        this.scene.add(this.missionMarker);

        const targetGeo = new THREE.CylinderGeometry(0, 1, 2, 4);
        const targetMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
        this.targetMarker = new THREE.Mesh(targetGeo, targetMat);
        this.targetMarker.position.y = 4;
        this.targetMarker.visible = false;
        this.scene.add(this.targetMarker);
    }

    update(dt) {
        const mission = this._getCurrentMission();
        if (!mission) {
            this.missionMarker.visible = false;
            return;
        }

        this.missionMarker.rotation.y += dt * 2;
        this.missionMarker.position.y = 4 + Math.sin(performance.now() * 0.003) * 0.5;

        if (!this.missionActive) {
            this.missionMarker.visible = true;
            this.missionMarker.position.x = mission.targetX;
            this.missionMarker.position.z = mission.targetZ;

            const dist = this.player.position.distanceTo(
                new THREE.Vector3(mission.targetX, 0, mission.targetZ)
            );
            if (dist < CONFIG.MISSION_RADIUS * 2) {
                this._startMission(mission);
            }
        } else {
            this._updateActiveMission(dt, mission);
        }
    }

    _getCurrentMission() {
        if (!this.currentMissionId) return null;
        return this.missions.find(m => m.id === this.currentMissionId);
    }

    _startMission(mission) {
        this.missionActive = true;
        this.activeMission = mission;
        this.killCount = 0;
        this.missionMarker.visible = false;

        if (mission.type === 'drive_to' || mission.type === 'escape') {
            this.targetMarker.visible = true;
            this.targetMarker.position.x = mission.targetX;
            this.targetMarker.position.z = mission.targetZ;
        }

        if (mission.type === 'escape') {
            if (this.onTriggerPolice) this.onTriggerPolice(3);
        }

        if (this.onBriefing) this.onBriefing(mission.title, mission.briefing);
    }

    _updateActiveMission(dt, mission) {
        this.targetMarker.rotation.y += dt * 3;
        this.targetMarker.position.y = 4 + Math.sin(performance.now() * 0.004) * 0.5;

        switch (mission.type) {
            case 'goto':
            case 'drive_to':
            case 'escape': {
                const dist = this.player.position.distanceTo(
                    new THREE.Vector3(mission.targetX, 0, mission.targetZ)
                );
                if (dist < CONFIG.MISSION_RADIUS * 2) {
                    this._completeMission(mission);
                }
                break;
            }
            case 'eliminate': {
                if (this.killCount >= mission.killsRequired) {
                    this._completeMission(mission);
                }
                break;
            }
        }
    }

    reportKill() {
        if (this.missionActive && this.activeMission && this.activeMission.type === 'eliminate') {
            this.killCount++;
        }
    }

    _completeMission(mission) {
        this.missionActive = false;
        this.activeMission = null;
        this.targetMarker.visible = false;
        this.completed.add(mission.id);

        this.player.cash += mission.reward;
        if (mission.rewardWeapon) {
            this.player.giveWeapon(mission.rewardWeapon, mission.rewardAmmo || 20);
        }

        this.currentMissionId = mission.nextMission;

        if (this.onMissionComplete) this.onMissionComplete(mission);
    }

    getObjectiveText() {
        if (!this.missionActive || !this.activeMission) {
            const next = this._getCurrentMission();
            if (next) return `Go to the mission marker (${next.title})`;
            return 'All missions complete! Free roam.';
        }
        const m = this.activeMission;
        switch (m.type) {
            case 'goto': return `Walk to the destination`;
            case 'drive_to': return `Drive to the destination`;
            case 'escape': return `Escape to the safehouse!`;
            case 'eliminate': return `Eliminate targets: ${this.killCount}/${m.killsRequired}`;
            default: return m.briefing;
        }
    }

    getMissionMarkerPosition() {
        const mission = this._getCurrentMission();
        if (!mission) return null;
        if (this.missionActive && this.activeMission) {
            return new THREE.Vector3(this.activeMission.targetX, 0, this.activeMission.targetZ);
        }
        return new THREE.Vector3(mission.targetX, 0, mission.targetZ);
    }
}
