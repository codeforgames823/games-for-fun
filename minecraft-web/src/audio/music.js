const SCALES = {
  calm: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16],
  minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],
  penta: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
};

const BASE_NOTE = 60;
const NOTE_FREQ = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class AmbientMusic {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.playing = false;
    this._nextNoteTime = 0;
    this._noteIndex = 0;
    this._currentScale = SCALES.calm;
    this._phraseLength = 8 + Math.floor(Math.random() * 8);
    this._phraseCurrent = 0;
    this._restChance = 0.25;
    this._tempo = 0.8 + Math.random() * 0.6;
    this._padOsc = null;
    this._padGain = null;
    this._volume = 0.12;
    this._changeTimer = 0;
  }

  start() {
    if (this.playing) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._volume;
    this.masterGain.connect(this.ctx.destination);
    this.playing = true;
    this._nextNoteTime = this.ctx.currentTime + 1;
    this._startPad();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this._padOsc) { this._padOsc.stop(); this._padOsc = null; }
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._volume;
  }

  update(dt) {
    if (!this.playing || !this.ctx) return;

    this._changeTimer += dt;
    if (this._changeTimer > 30 + Math.random() * 30) {
      this._changeTimer = 0;
      this._switchMood();
    }

    const now = this.ctx.currentTime;
    while (this._nextNoteTime < now + 0.2) {
      this._scheduleNote(this._nextNoteTime);
      this._nextNoteTime += this._tempo;
    }
  }

  _startPad() {
    if (!this.ctx) return;
    const padFreq = NOTE_FREQ(BASE_NOTE - 12);
    this._padGain = this.ctx.createGain();
    this._padGain.gain.value = 0;
    this._padGain.connect(this.masterGain);

    this._padOsc = this.ctx.createOscillator();
    this._padOsc.type = 'sine';
    this._padOsc.frequency.value = padFreq;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    this._padOsc.connect(filter);
    filter.connect(this._padGain);

    this._padGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this._padGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 4);

    this._padOsc.start();
  }

  _switchMood() {
    const scaleKeys = Object.keys(SCALES);
    this._currentScale = SCALES[scaleKeys[Math.floor(Math.random() * scaleKeys.length)]];
    this._tempo = 0.7 + Math.random() * 0.8;
    this._restChance = 0.15 + Math.random() * 0.3;
    this._phraseLength = 6 + Math.floor(Math.random() * 10);
    this._phraseCurrent = 0;

    if (this._padOsc && this._padGain) {
      const newRoot = BASE_NOTE - 12 + this._currentScale[Math.floor(Math.random() * 3)];
      this._padOsc.frequency.linearRampToValueAtTime(
        NOTE_FREQ(newRoot), this.ctx.currentTime + 3
      );
    }
  }

  _scheduleNote(time) {
    if (Math.random() < this._restChance) {
      this._advancePhrase();
      return;
    }

    const scaleIdx = this._pickNote();
    const midi = BASE_NOTE + this._currentScale[scaleIdx];
    const freq = NOTE_FREQ(midi);
    const duration = this._tempo * (0.6 + Math.random() * 0.8);

    this._playTone(freq, time, duration, 'sine', 0.08 + Math.random() * 0.04);

    if (Math.random() < 0.3) {
      const harmIdx = Math.min(scaleIdx + 2, this._currentScale.length - 1);
      const harmMidi = BASE_NOTE + this._currentScale[harmIdx];
      this._playTone(NOTE_FREQ(harmMidi), time, duration * 0.8, 'triangle', 0.03);
    }

    this._advancePhrase();
  }

  _pickNote() {
    const range = this._currentScale.length;
    const center = Math.floor(range / 2);
    let idx = center + Math.floor((Math.random() - 0.5) * 6);
    idx = Math.max(0, Math.min(range - 1, idx));

    if (this._phraseCurrent >= this._phraseLength - 2) {
      idx = Math.min(idx, 2);
    }
    return idx;
  }

  _advancePhrase() {
    this._phraseCurrent++;
    if (this._phraseCurrent >= this._phraseLength) {
      this._phraseCurrent = 0;
      this._phraseLength = 6 + Math.floor(Math.random() * 10);
      this._restChance = Math.min(0.5, this._restChance + 0.02 * (Math.random() - 0.3));
    }
  }

  _playTone(freq, startTime, duration, type, vol) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 1200 + Math.random() * 600;
    filter.Q.value = 0.5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    const attack = 0.08;
    const release = duration * 0.4;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + attack);
    gain.gain.setValueAtTime(vol, startTime + duration - release);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}
