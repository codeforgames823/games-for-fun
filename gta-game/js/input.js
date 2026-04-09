export class Input {
    constructor(canvas) {
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.mouseDown = false;
        this.rightMouseDown = false;
        this.locked = false;
        this.canvas = canvas;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });

        const requestLock = () => {
            if (!this.locked) canvas.requestPointerLock();
        };

        canvas.addEventListener('mousedown', e => {
            if (e.button === 0) this.mouseDown = true;
            if (e.button === 2) this.rightMouseDown = true;
            requestLock();
        });
        document.addEventListener('mousedown', e => {
            requestLock();
        });
        canvas.addEventListener('mouseup', e => {
            if (e.button === 0) this.mouseDown = false;
            if (e.button === 2) this.rightMouseDown = false;
        });
        document.addEventListener('mouseup', e => {
            if (e.button === 0) this.mouseDown = false;
            if (e.button === 2) this.rightMouseDown = false;
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('contextmenu', e => {
            if (this.locked) e.preventDefault();
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', e => {
            if (this.locked) {
                this.mouseDX += e.movementX;
                this.mouseDY += e.movementY;
            }
        });

        window.addEventListener('wheel', e => {
            this.wheelDelta = e.deltaY;
        });
    }

    isDown(code) { return !!this.keys[code]; }
    justPressed(code) { return false; }

    consumeMouse() {
        const dx = this.mouseDX;
        const dy = this.mouseDY;
        this.mouseDX = 0;
        this.mouseDY = 0;
        return { dx, dy };
    }

    consumeWheel() {
        const d = this.wheelDelta || 0;
        this.wheelDelta = 0;
        return d;
    }
}
