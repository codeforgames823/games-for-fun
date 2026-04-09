import { HOTBAR_BLOCKS, BLOCK_COLORS, BLOCK_NAMES } from '../config.js';

export class Hotbar {
  constructor() {
    this.selectedIndex = 0;
    this.container = document.getElementById('hotbar');
    this._build();
    this._bindInput();
  }

  _build() {
    this.container.innerHTML = '';
    this.slots = [];
    for (let i = 0; i < HOTBAR_BLOCKS.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === this.selectedIndex ? ' active' : '');

      const num = document.createElement('span');
      num.className = 'slot-num';
      num.textContent = i + 1;
      slot.appendChild(num);

      const preview = document.createElement('div');
      preview.className = 'block-preview';
      const color = BLOCK_COLORS[HOTBAR_BLOCKS[i]];
      const hex = '#' + color.top.toString(16).padStart(6, '0');
      preview.style.background = hex;
      preview.title = BLOCK_NAMES[HOTBAR_BLOCKS[i]] || '';
      slot.appendChild(preview);

      this.container.appendChild(slot);
      this.slots.push(slot);
    }
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= HOTBAR_BLOCKS.length) {
        this.select(n - 1);
      }
    });
    document.addEventListener('wheel', (e) => {
      if (!document.pointerLockElement) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.select((this.selectedIndex + dir + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length);
    });
  }

  select(index) {
    this.slots[this.selectedIndex].classList.remove('active');
    this.selectedIndex = index;
    this.slots[this.selectedIndex].classList.add('active');
  }

  getSelectedBlock() {
    return HOTBAR_BLOCKS[this.selectedIndex];
  }

  show() { this.container.style.display = 'flex'; }
  hide() { this.container.style.display = 'none'; }
}
