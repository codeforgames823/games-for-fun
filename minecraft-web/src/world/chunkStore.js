import {
  CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE, BlockType,
  NON_SOLID_BLOCKS,
} from '../config.js';
import { TerrainGenerator } from './terrainGen.js';

function chunkKey(cx, cz) { return `${cx},${cz}`; }

export class ChunkStore {
  constructor(seed) {
    this.seed = seed;
    this.gen = new TerrainGenerator(seed);
    this.chunks = new Map();
    this.dirtyChunks = new Set();
    this.modifiedBlocks = new Map();
  }

  _index(lx, y, lz) {
    return lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = this.gen.generateChunk(cx, cz);

    const mods = this.modifiedBlocks.get(key);
    if (mods) {
      for (const [idx, blockType] of mods) {
        data[idx] = blockType;
      }
    }

    this.chunks.set(key, data);
    return data;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = chunkKey(cx, cz);
    const data = this.chunks.get(key);
    if (!data) return BlockType.AIR;
    return data[this._index(lx, wy, lz)];
  }

  setBlock(wx, wy, wz, blockType) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = chunkKey(cx, cz);
    const data = this.chunks.get(key);
    if (!data) return;
    const idx = this._index(lx, wy, lz);
    data[idx] = blockType;

    if (!this.modifiedBlocks.has(key)) this.modifiedBlocks.set(key, new Map());
    this.modifiedBlocks.get(key).set(idx, blockType);

    this.dirtyChunks.add(key);

    if (lx === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  isSolid(wx, wy, wz) {
    return !NON_SOLID_BLOCKS.has(this.getBlock(wx, wy, wz));
  }

  updateLoadedChunks(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const needed = new Set();
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;
        needed.add(chunkKey(pcx + dx, pcz + dz));
      }
    }

    const toLoad = [];
    for (const key of needed) {
      if (!this.chunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        toLoad.push({ cx, cz, key });
      }
    }

    const toUnload = [];
    for (const key of this.chunks.keys()) {
      if (!needed.has(key)) toUnload.push(key);
    }

    return { toLoad, toUnload, needed };
  }

  unloadChunk(key) {
    this.chunks.delete(key);
  }

  getModifiedBlocksForSave() {
    const result = {};
    for (const [key, mods] of this.modifiedBlocks) {
      const arr = [];
      for (const [idx, bt] of mods) arr.push([idx, bt]);
      if (arr.length > 0) result[key] = arr;
    }
    return result;
  }

  loadModifiedBlocks(saved) {
    for (const key in saved) {
      const map = new Map();
      for (const [idx, bt] of saved[key]) map.set(idx, bt);
      this.modifiedBlocks.set(key, map);
    }
  }
}
