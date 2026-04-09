import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.COLORS.sky);
        this.scene.fog = new THREE.Fog(CONFIG.COLORS.sky, 150, 400);

        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 500);
        this.camera.position.set(0, 10, 20);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        const sun = new THREE.DirectionalLight(CONFIG.COLORS.sunLight, 1.8);
        sun.position.set(100, 150, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -120;
        sun.shadow.camera.right = 120;
        sun.shadow.camera.top = 120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 400;
        sun.shadow.bias = -0.001;
        this.sun = sun;
        this.scene.add(sun);
        this.scene.add(sun.target);

        const ambient = new THREE.AmbientLight(CONFIG.COLORS.ambientLight, 0.6);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.4);
        this.scene.add(hemi);

        this.clock = new THREE.Clock();
        this.callbacks = [];
        this.running = false;

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onUpdate(fn) { this.callbacks.push(fn); }

    start() {
        this.running = true;
        this.clock.start();
        this._loop();
    }

    _loop() {
        if (!this.running) return;
        requestAnimationFrame(() => this._loop());
        const dt = Math.min(this.clock.getDelta(), 0.05);
        for (const fn of this.callbacks) fn(dt);
        this.renderer.render(this.scene, this.camera);
    }

    stop() { this.running = false; }
}
