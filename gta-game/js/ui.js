import { CONFIG } from './config.js';

export class UI {
    constructor() {
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.briefingEl = document.getElementById('briefing');
        this.briefingTitle = document.getElementById('briefing-title');
        this.briefingText = document.getElementById('briefing-text');
        this.briefingVisible = false;
        this.briefingTimer = 0;

        this.deathScreen = document.getElementById('death-screen');
        this.deathVisible = false;

        document.getElementById('briefing-ok').addEventListener('click', () => {
            this.hideBriefing();
        });
    }

    update(player, policeSystem, missionSystem, combat) {
        this._updateHealth(player);
        this._updateArmor(player);
        this._updateWanted(policeSystem.wantedLevel);
        this._updateWeapon(player, combat);
        this._updateCash(player);
        this._updateObjective(missionSystem);
        this._updateMinimap(player, missionSystem, policeSystem);
        this._updateBriefing();
        this._updateSpeed(player);
    }

    _updateHealth(player) {
        const bar = document.getElementById('health-fill');
        const pct = (player.health / CONFIG.PLAYER_MAX_HEALTH) * 100;
        bar.style.width = pct + '%';
        if (pct < 25) bar.style.background = '#ff2222';
        else if (pct < 50) bar.style.background = '#ff8800';
        else bar.style.background = '#22cc44';
    }

    _updateArmor(player) {
        const bar = document.getElementById('armor-fill');
        const pct = (player.armor / CONFIG.PLAYER_MAX_ARMOR) * 100;
        bar.style.width = pct + '%';
        const container = document.getElementById('armor-bar');
        container.style.display = player.armor > 0 ? 'block' : 'none';
    }

    _updateWanted(level) {
        const stars = document.getElementById('wanted-stars');
        let html = '';
        for (let i = 0; i < 5; i++) {
            html += `<span class="star ${i < level ? 'active' : ''}">\u2605</span>`;
        }
        stars.innerHTML = html;
    }

    _updateWeapon(player, combat) {
        const el = document.getElementById('weapon-info');
        const w = CONFIG.WEAPONS[player.currentWeapon];
        const ammoText = player.currentWeapon === 'fists' ? '' : ` | ${player.ammo[player.currentWeapon]}`;
        el.textContent = `${w.name}${ammoText}`;
    }

    _updateCash(player) {
        document.getElementById('cash').textContent = `$${player.cash.toLocaleString()}`;
    }

    _updateObjective(missionSystem) {
        document.getElementById('objective').textContent = missionSystem.getObjectiveText();
    }

    _updateSpeed(player) {
        const el = document.getElementById('speed');
        if (player.inVehicle) {
            const speed = Math.abs(player.inVehicle.velocity);
            el.textContent = `${Math.round(speed * 2.2)} mph`;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    _updateMinimap(player, missionSystem, policeSystem) {
        const ctx = this.minimapCtx;
        const size = this.minimapCanvas.width;
        const scale = 0.25;

        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);

        const city = CONFIG.CITY_GRID_SIZE;
        const block = CONFIG.BLOCK_SIZE;
        const totalSize = city * block;
        const half = totalSize / 2;

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let i = 0; i <= city; i++) {
            const pos = (i * block - half - player.position.x) * scale;
            const posZ = (i * block - half - player.position.z) * scale;
            ctx.beginPath();
            ctx.moveTo(-size, pos);
            ctx.lineTo(size, pos);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(posZ, -size);
            ctx.lineTo(posZ, size);
            ctx.stroke();
        }

        const markerPos = missionSystem.getMissionMarkerPosition();
        if (markerPos) {
            const mx = (markerPos.x - player.position.x) * scale;
            const mz = (markerPos.z - player.position.z) * scale;
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(mx, mz, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const cop of policeSystem.officers) {
            const cx = (cop.mesh.position.x - player.position.x) * scale;
            const cz = (cop.mesh.position.z - player.position.z) * scale;
            if (Math.abs(cx) < size / 2 && Math.abs(cz) < size / 2) {
                ctx.fillStyle = '#4444ff';
                ctx.beginPath();
                ctx.arc(cx, cz, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const dirX = -Math.sin(player.inVehicle ? player.inVehicle.mesh.rotation.y : player.rotation);
        const dirZ = -Math.cos(player.inVehicle ? player.inVehicle.mesh.rotation.y : player.rotation);
        ctx.moveTo(0, 0);
        ctx.lineTo(dirX * 8, dirZ * 8);
        ctx.stroke();

        ctx.restore();
    }

    showBriefing(title, text) {
        this.briefingTitle.textContent = title;
        this.briefingText.textContent = text;
        this.briefingEl.style.display = 'flex';
        this.briefingVisible = true;
    }

    hideBriefing() {
        this.briefingEl.style.display = 'none';
        this.briefingVisible = false;
    }

    _updateBriefing() {
        // auto-hide handled by button click
    }

    showDeath() {
        this.deathScreen.style.display = 'flex';
        this.deathVisible = true;
        setTimeout(() => {
            this.deathScreen.style.display = 'none';
            this.deathVisible = false;
        }, 2000);
    }

    showMissionComplete(mission) {
        this.showBriefing('Mission Complete!', `${mission.title}\nReward: $${mission.reward}`);
    }
}
