import { createNoise } from './noise.js';
import {
  CHUNK_SIZE, CHUNK_HEIGHT, TERRAIN_SCALE, TERRAIN_HEIGHT,
  BASE_HEIGHT, SEA_LEVEL, BlockType,
} from '../config.js';

export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed;
    this.noise = createNoise(seed);
    this.treeNoise = createNoise(seed ^ 0x5a5a5a5a);
    this.caveNoise = createNoise(seed ^ 0x3c3c3c3c);
    this.caveNoise2 = createNoise(seed ^ 0x1d1d1d1d);
    this.oreNoise = createNoise(seed ^ 0x2b2b2b2b);
    this.biomeNoise = createNoise(seed ^ 0x4e4e4e4e);
    this.floraNoise = createNoise(seed ^ 0x7f7f7f7f);
    this.biomeNoise2 = createNoise(seed ^ 0x6d6d6d6d);
  }

  getBiome(wx, wz) {
    const temp = this.biomeNoise.fbm(wx * 0.003, wz * 0.003, 3, 2, 0.5);
    const humid = this.biomeNoise.fbm(wx * 0.003 + 500, wz * 0.003 + 500, 3, 2, 0.5);
    const weird = this.biomeNoise2.noise2d(wx * 0.006, wz * 0.006);

    if (temp < -0.4) return 'frozen_ocean';
    if (temp < -0.2) return 'snow';
    if (temp > 0.45 && humid < -0.2) return 'mesa';
    if (temp > 0.3 && humid < 0.0) return 'desert';
    if (temp > 0.3 && humid > 0.3) return 'jungle';
    if (humid > 0.4) return 'swamp';
    if (humid < -0.35) return 'savanna';
    if (weird > 0.55) return 'mushroom';
    if (weird < -0.4) return 'mountains';

    const oceanVal = this.biomeNoise2.fbm(wx * 0.004, wz * 0.004, 2, 2, 0.5);
    if (oceanVal < -0.35) return 'ocean';

    const coastal = this.biomeNoise2.noise2d(wx * 0.01, wz * 0.01);
    if (oceanVal < -0.2 && coastal < 0) return 'beach';

    if (humid > 0.15) return 'dark_forest';
    if (humid > 0.0) return 'forest';
    return 'plains';
  }

  getHeight(wx, wz) {
    const biome = this.getBiome(wx, wz);
    const base = this.noise.fbm(wx * TERRAIN_SCALE, wz * TERRAIN_SCALE, 4, 2, 0.5);
    const baseHeight = BASE_HEIGHT + ((base + 1) / 2) * TERRAIN_HEIGHT;

    switch (biome) {
      case 'ocean':
      case 'frozen_ocean': {
        const depth = this.noise.fbm(wx * 0.01, wz * 0.01, 2, 2, 0.5);
        return Math.floor(SEA_LEVEL - 6 - Math.max(0, depth + 0.5) * 12);
      }
      case 'beach':
        return Math.floor(SEA_LEVEL + (base + 1) * 1.5);
      case 'mountains': {
        const peak = this.noise.fbm(wx * 0.008, wz * 0.008, 3, 2.2, 0.45);
        return Math.floor(baseHeight + Math.max(0, peak) * 30);
      }
      case 'mesa': {
        const plateau = this.noise.fbm(wx * 0.015, wz * 0.015, 2, 2, 0.5);
        const flat = Math.floor(baseHeight + 4);
        return plateau > 0.1 ? flat + 6 : flat;
      }
      case 'swamp': {
        const flat = SEA_LEVEL + 1 + ((base + 1) / 2) * 4;
        return Math.floor(flat);
      }
      case 'jungle': {
        const hilly = this.noise.fbm(wx * 0.012, wz * 0.012, 3, 2, 0.5);
        return Math.floor(baseHeight + Math.max(0, hilly) * 8);
      }
      case 'mushroom':
        return Math.floor(SEA_LEVEL + 2 + ((base + 1) / 2) * 6);
      default: {
        const mountains = this.noise.fbm(wx * 0.008, wz * 0.008, 3, 2.2, 0.45);
        const mountainFactor = Math.max(0, mountains) * 16;
        return Math.floor(baseHeight + mountainFactor);
      }
    }
  }

  _isCave(wx, wy, wz) {
    if (wy <= 1 || wy >= CHUNK_HEIGHT - 1) return false;
    const scale = 0.04;
    const n1 = this.caveNoise.fbm(wx * scale, wy * scale + wz * 0.01, 2, 2, 0.5);
    const n2 = this.caveNoise2.fbm(wz * scale, wy * scale + wx * 0.01, 2, 2, 0.5);
    return Math.abs(n1) < 0.08 && Math.abs(n2) < 0.08;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const height = this.getHeight(wx, wz);
        const biome = this.getBiome(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
          let block = BlockType.AIR;

          if (y === 0) {
            block = BlockType.BEDROCK;
          } else if (y < height - 4) {
            block = BlockType.STONE;
          } else if (y < height) {
            block = this._getSubsurface(biome);
          } else if (y === height) {
            block = this._getSurface(biome, height);
          } else if (y <= SEA_LEVEL && height < SEA_LEVEL) {
            if (biome === 'frozen_ocean' && y === SEA_LEVEL) {
              block = BlockType.PACKED_ICE;
            } else {
              block = BlockType.WATER;
            }
          }

          if (block === BlockType.STONE && y > 1 && y < height - 1 && this._isCave(wx, y, wz)) {
            block = BlockType.AIR;
          }

          data[idx] = block;
        }

        this._placeOres(data, lx, lz, wx, wz, height);
        this._placeBiomeExtras(data, lx, lz, wx, wz, height, biome);
      }
    }

    this._placeTrees(cx, cz, data);
    this._placeFlora(cx, cz, data);
    return data;
  }

  _getSurface(biome, height) {
    if (height < SEA_LEVEL - 1) return BlockType.SAND;
    switch (biome) {
      case 'desert': return BlockType.SAND;
      case 'mesa': return BlockType.RED_SAND;
      case 'snow': case 'frozen_ocean': return BlockType.SNOW_GRASS;
      case 'beach': return BlockType.SAND;
      case 'ocean': return BlockType.SAND;
      case 'jungle': return BlockType.GRASS;
      case 'swamp': return height <= SEA_LEVEL + 1 ? BlockType.MUD : BlockType.GRASS;
      case 'mushroom': return BlockType.GRASS;
      case 'dark_forest': return BlockType.GRASS;
      case 'savanna': return BlockType.GRASS;
      case 'mountains': return height > BASE_HEIGHT + TERRAIN_HEIGHT ? BlockType.STONE : BlockType.GRASS;
      default: return BlockType.GRASS;
    }
  }

  _getSubsurface(biome) {
    switch (biome) {
      case 'desert': case 'beach': return BlockType.SAND;
      case 'mesa': return BlockType.RED_SAND;
      case 'swamp': return BlockType.MUD;
      case 'ocean': case 'frozen_ocean': return BlockType.SAND;
      default: return BlockType.DIRT;
    }
  }

  _placeBiomeExtras(data, lx, lz, wx, wz, height, biome) {
    if (height > SEA_LEVEL && biome !== 'desert' && biome !== 'mesa') {
      const gravelChance = this.oreNoise.noise2d(wx * 0.08 + 1000, wz * 0.08 + 1000);
      if (gravelChance > 0.6) {
        const gIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + (height - 1) * CHUNK_SIZE + lz;
        if (data[gIdx] === BlockType.DIRT) data[gIdx] = BlockType.GRAVEL;
      }
    }

    if (height < SEA_LEVEL && height > SEA_LEVEL - 4) {
      const clayChance = this.oreNoise.noise2d(wx * 0.1 + 2000, wz * 0.1 + 2000);
      if (clayChance > 0.5) {
        const cIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
        if (data[cIdx] === BlockType.SAND) data[cIdx] = BlockType.CLAY;
      }
    }

    if (biome === 'ocean' || biome === 'frozen_ocean') {
      if (height >= SEA_LEVEL - 8 && height < SEA_LEVEL) {
        const coralChance = this.floraNoise.noise2d(wx * 0.15, wz * 0.15);
        if (coralChance > 0.5) {
          const aboveIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + (height + 1) * CHUNK_SIZE + lz;
          if (data[aboveIdx] === BlockType.WATER) {
            data[aboveIdx] = coralChance > 0.65 ? BlockType.CORAL : BlockType.SEAGRASS;
          }
        }
      }
    }

    if (biome === 'swamp') {
      if (height === SEA_LEVEL) {
        const lilyChance = this.floraNoise.noise2d(wx * 0.2 + 300, wz * 0.2 + 300);
        if (lilyChance > 0.4) {
          const surfIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
          if (data[surfIdx] === BlockType.WATER || data[surfIdx] === BlockType.MUD) {
            const aboveIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + (height + 1) * CHUNK_SIZE + lz;
            if (data[aboveIdx] === BlockType.AIR) {
              data[aboveIdx] = BlockType.LILY_PAD;
            }
          }
        }
      }
    }

    if (biome === 'mountains') {
      if (height > 40) {
        const surfIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
        if (data[surfIdx] === BlockType.GRASS || data[surfIdx] === BlockType.DIRT) {
          data[surfIdx] = BlockType.STONE;
        }
        if (height > 48) {
          const snowIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
          if (data[snowIdx] === BlockType.STONE) data[snowIdx] = BlockType.SNOW;
        }
      }
    }

    if (biome === 'mesa') {
      for (let y = Math.max(1, height - 8); y < height; y++) {
        const idx = lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
        if (data[idx] !== BlockType.RED_SAND && data[idx] !== BlockType.STONE) continue;
        const layer = y % 6;
        if (layer < 2) data[idx] = BlockType.RED_SAND;
        else if (layer < 4) data[idx] = BlockType.CLAY;
        else data[idx] = BlockType.RED_SAND;
      }
    }
  }

  _placeOres(data, lx, lz, wx, wz, height) {
    const ores = [
      { type: BlockType.COAL_ORE, minY: 5, maxY: 50, threshold: 0.72, seed: 100 },
      { type: BlockType.IRON_ORE, minY: 2, maxY: 40, threshold: 0.78, seed: 200 },
      { type: BlockType.GOLD_ORE, minY: 2, maxY: 25, threshold: 0.84, seed: 300 },
      { type: BlockType.DIAMOND_ORE, minY: 2, maxY: 15, threshold: 0.90, seed: 400 },
    ];

    for (const ore of ores) {
      for (let y = ore.minY; y < Math.min(ore.maxY, height - 4); y++) {
        const idx = lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
        if (data[idx] !== BlockType.STONE) continue;
        const n = this.oreNoise.noise2d(
          (wx + ore.seed) * 0.15,
          (y * 7 + wz + ore.seed) * 0.15
        );
        if (n > ore.threshold) {
          data[idx] = ore.type;
        }
      }
    }
  }

  _placeTrees(cx, cz, data) {
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.getBiome(wx, wz);
        if (biome === 'desert' || biome === 'mesa' || biome === 'ocean' || biome === 'frozen_ocean' || biome === 'beach') continue;

        const treeVal = this.treeNoise.noise2d(wx * 0.5, wz * 0.5);
        const threshold = this._getTreeThreshold(biome);
        if (treeVal < threshold) continue;

        const height = this.getHeight(wx, wz);
        if (height <= SEA_LEVEL) continue;

        const surfIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
        const surfBlock = data[surfIdx];
        const validSurface = surfBlock === BlockType.GRASS || surfBlock === BlockType.SNOW_GRASS ||
                             surfBlock === BlockType.MUD || surfBlock === BlockType.DIRT;
        if (!validSurface) continue;

        const aboveIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + (height + 1) * CHUNK_SIZE + lz;
        if (data[aboveIdx] !== BlockType.AIR) continue;

        switch (biome) {
          case 'jungle':
            this._placeJungleTree(data, lx, lz, height);
            break;
          case 'savanna':
            this._placeAcaciaTree(data, lx, lz, height, wx, wz);
            break;
          case 'swamp':
            this._placeSwampTree(data, lx, lz, height, wx, wz);
            break;
          case 'mushroom':
            this._placeMushroomTree(data, lx, lz, height, wx, wz);
            break;
          case 'dark_forest':
            this._placeDarkTree(data, lx, lz, height, wx, wz);
            break;
          case 'mountains':
            if (height < 40) this._placeOakTree(data, lx, lz, height, wx, wz);
            break;
          default:
            this._placeOakTree(data, lx, lz, height, wx, wz);
            break;
        }
      }
    }

    this._placeCacti(cx, cz, data);
  }

  _getTreeThreshold(biome) {
    switch (biome) {
      case 'jungle': return -0.1;
      case 'dark_forest': return 0.05;
      case 'forest': return 0.2;
      case 'swamp': return 0.25;
      case 'mushroom': return 0.3;
      case 'savanna': return 0.45;
      case 'snow': return 0.4;
      case 'mountains': return 0.45;
      default: return 0.35;
    }
  }

  _placeOakTree(data, lx, lz, height, wx, wz) {
    const trunkHeight = 4 + ((wx * 7 + wz * 13) & 3);
    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.WOOD;
    }
    this._placeLeafCanopy(data, lx, lz, height + trunkHeight, BlockType.LEAVES, 2);
  }

  _placeJungleTree(data, lx, lz, height) {
    const trunkHeight = 8 + ((lx * 13 + lz * 7) & 5);
    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.JUNGLE_WOOD;
    }
    this._placeLeafCanopy(data, lx, lz, height + trunkHeight, BlockType.JUNGLE_LEAVES, 3);

    for (let dy = 3; dy < trunkHeight - 2; dy += 3) {
      const y = height + dy;
      if (y >= CHUNK_HEIGHT) break;
      for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = lx + dx, nz = lz + dz;
        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
        const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + nz;
        if (data[idx] === BlockType.AIR) data[idx] = BlockType.VINES;
      }
    }
  }

  _placeAcaciaTree(data, lx, lz, height, wx, wz) {
    const trunkHeight = 5 + ((wx * 11 + wz * 17) & 3);
    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.ACACIA_WOOD;
    }

    const topY = height + trunkHeight;
    for (let ly = topY; ly <= topY + 1; ly++) {
      if (ly >= CHUNK_HEIGHT) break;
      const radius = ly === topY ? 3 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
          const nx = lx + dx, nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + nz;
          if (data[idx] === BlockType.AIR) data[idx] = BlockType.ACACIA_LEAVES;
        }
      }
    }
  }

  _placeSwampTree(data, lx, lz, height, wx, wz) {
    const trunkHeight = 4 + ((wx * 3 + wz * 11) & 3);
    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.WOOD;
    }
    this._placeLeafCanopy(data, lx, lz, height + trunkHeight, BlockType.LEAVES, 2);

    for (let dy = trunkHeight - 1; dy >= 1; dy--) {
      const y = height + dy;
      for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = lx + dx, nz = lz + dz;
        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
        const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + nz;
        if (data[idx] === BlockType.AIR) {
          const vineChance = ((wx * 7 + wz * 13 + dy * 3) & 7);
          if (vineChance < 3) data[idx] = BlockType.VINES;
        }
      }
    }
  }

  _placeMushroomTree(data, lx, lz, height, wx, wz) {
    const stemHeight = 5 + ((wx * 7 + wz * 3) & 3);
    const isRed = ((wx * 13 + wz * 7) & 1) === 0;

    for (let ty = 1; ty <= stemHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.MUSHROOM_STEM;
    }

    const capType = isRed ? BlockType.MUSHROOM_RED : BlockType.MUSHROOM_BROWN;
    const topY = height + stemHeight;
    const capRadius = isRed ? 2 : 3;
    for (let ly = topY; ly <= topY + 1; ly++) {
      if (ly >= CHUNK_HEIGHT) break;
      const r = ly === topY + 1 ? Math.max(0, capRadius - 1) : capRadius;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && ly === topY) continue;
          const nx = lx + dx, nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + nz;
          if (data[idx] === BlockType.AIR) data[idx] = capType;
        }
      }
    }
  }

  _placeDarkTree(data, lx, lz, height, wx, wz) {
    const trunkHeight = 5 + ((wx * 7 + wz * 11) & 3);
    for (let ty = 1; ty <= trunkHeight; ty++) {
      const y = height + ty;
      if (y >= CHUNK_HEIGHT) break;
      data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.DARK_WOOD;
    }
    this._placeLeafCanopy(data, lx, lz, height + trunkHeight, BlockType.DARK_LEAVES, 2);
  }

  _placeLeafCanopy(data, lx, lz, topY, leafType, maxRadius) {
    const leafStart = topY - 2;
    const leafEnd = topY + 1;
    for (let ly = leafStart; ly <= leafEnd; ly++) {
      if (ly >= CHUNK_HEIGHT) break;
      const radius = ly >= leafEnd ? 1 : ly === leafStart ? 1 : maxRadius;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && ly < leafEnd) continue;
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && ly < leafEnd - 1) continue;
          const nx = lx + dx, nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          const idx = nx * CHUNK_HEIGHT * CHUNK_SIZE + ly * CHUNK_SIZE + nz;
          if (data[idx] === BlockType.AIR) data[idx] = leafType;
        }
      }
    }
  }

  _placeCacti(cx, cz, data) {
    for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
      for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.getBiome(wx, wz);
        if (biome !== 'desert' && biome !== 'mesa') continue;

        const cactusVal = this.treeNoise.noise2d(wx * 0.8, wz * 0.8);
        if (cactusVal < 0.45) continue;

        const height = this.getHeight(wx, wz);
        if (height <= SEA_LEVEL) continue;

        const surfIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
        if (data[surfIdx] !== BlockType.SAND && data[surfIdx] !== BlockType.RED_SAND) continue;

        let blocked = false;
        for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const aboveIdx = (lx + dx) * CHUNK_HEIGHT * CHUNK_SIZE + (height + 1) * CHUNK_SIZE + (lz + dz);
          if (aboveIdx >= 0 && aboveIdx < data.length && data[aboveIdx] !== BlockType.AIR) blocked = true;
        }
        if (blocked) continue;

        const cactusHeight = 2 + ((wx * 3 + wz * 7) & 3);
        for (let cy = 1; cy <= cactusHeight; cy++) {
          const y = height + cy;
          if (y >= CHUNK_HEIGHT) break;
          data[lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = BlockType.CACTUS;
        }
      }
    }
  }

  _placeFlora(cx, cz, data) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const height = this.getHeight(wx, wz);
        if (height <= SEA_LEVEL) continue;

        const biome = this.getBiome(wx, wz);
        if (biome === 'desert' || biome === 'mesa' || biome === 'snow' || biome === 'ocean' ||
            biome === 'frozen_ocean' || biome === 'beach') continue;

        const surfIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + height * CHUNK_SIZE + lz;
        if (data[surfIdx] !== BlockType.GRASS && data[surfIdx] !== BlockType.MUD) continue;

        const aboveIdx = lx * CHUNK_HEIGHT * CHUNK_SIZE + (height + 1) * CHUNK_SIZE + lz;
        if (data[aboveIdx] !== BlockType.AIR) continue;

        const floraVal = this.floraNoise.noise2d(wx * 0.8, wz * 0.8);

        if (biome === 'savanna') {
          if (floraVal > 0.45) data[aboveIdx] = BlockType.TALL_GRASS;
          continue;
        }

        if (biome === 'jungle') {
          if (floraVal > 0.35) data[aboveIdx] = BlockType.TALL_GRASS;
          else if (floraVal > 0.28) {
            data[aboveIdx] = BlockType.FLOWER_RED;
          }
          continue;
        }

        if (biome === 'mushroom') {
          if (floraVal > 0.3) {
            data[aboveIdx] = floraVal > 0.5 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
          }
          continue;
        }

        if (floraVal > 0.55) {
          data[aboveIdx] = BlockType.TALL_GRASS;
        } else if (floraVal > 0.48) {
          const flowerType = this.floraNoise.noise2d(wx * 2.0, wz * 2.0);
          data[aboveIdx] = flowerType > 0 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
        }
      }
    }
  }
}
