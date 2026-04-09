export class Audio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }

    _ensureCtx() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return this.initialized;
    }

    playGunshot(type) {
        if (!this._ensureCtx()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
        }
        noise.buffer = buf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        switch (type) {
            case 'pistol':
                filter.frequency.value = 3000;
                break;
            case 'shotgun':
                filter.frequency.value = 1500;
                gain.gain.setValueAtTime(0.8, now);
                break;
            case 'smg':
                filter.frequency.value = 4000;
                gain.gain.setValueAtTime(0.3, now);
                break;
            default:
                filter.frequency.value = 2000;
        }

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.15);
    }

    playPunch() {
        if (!this._ensureCtx()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playEngineLoop(speed) {
        if (!this._ensureCtx()) return;
        if (this._engineOsc) {
            this._engineOsc.frequency.value = 60 + speed * 3;
            return;
        }

        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;

        const gain = ctx.createGain();
        gain.gain.value = 0.08;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        this._engineOsc = osc;
        this._engineGain = gain;
    }

    stopEngine() {
        if (this._engineOsc) {
            this._engineOsc.stop();
            this._engineOsc = null;
            this._engineGain = null;
        }
    }

    playSiren() {
        if (!this._ensureCtx()) return;
        if (this._sirenOsc) return;

        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sine';

        const gain = ctx.createGain();
        gain.gain.value = 0.1;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 2;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 200;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.frequency.value = 600;

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        lfo.start();

        this._sirenOsc = osc;
        this._sirenLfo = lfo;
        this._sirenGain = gain;
    }

    stopSiren() {
        if (this._sirenOsc) {
            this._sirenOsc.stop();
            this._sirenLfo.stop();
            this._sirenOsc = null;
            this._sirenLfo = null;
        }
    }

    playPickup() {
        if (!this._ensureCtx()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playMissionComplete() {
        if (!this._ensureCtx()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const notes = [523, 659, 784, 1047];

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.4);
        });
    }
}
