import { BlockType } from '../config.js';

const TILE = 16;
const ATLAS_COLS = 8;

const FACE_MAP = {};
let atlasTexture = null;
let tileCount = 0;

function tileIndex() { return tileCount++; }

function seededRand(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function fillSolid(ctx, tx, ty, r, g, b) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = 0.9 + seededRand(x, y, tx * 17 + ty * 31) * 0.2;
      ctx.fillStyle = `rgb(${(r * v) | 0},${(g * v) | 0},${(b * v) | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawGrassTop(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 7777);
      const r = 70 + n * 30, g = 140 + n * 40, b = 40 + n * 20;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawGrassSide(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 8888);
      if (y < 3) {
        const blade = seededRand(x, y, 9090);
        const extend = y < 1 ? blade > 0.5 : blade > 0.7;
        if (extend) {
          const r = 70 + n * 30, g = 140 + n * 40, b = 40 + n * 20;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        } else {
          const r = 130 + n * 20, g = 95 + n * 15, b = 50 + n * 10;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        }
      } else {
        const r = 130 + n * 20, g = 95 + n * 15, b = 50 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      }
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawDirt(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 1111);
      const dark = seededRand(x + 3, y + 7, 2222) > 0.75;
      const r = dark ? 100 + n * 15 : 130 + n * 20;
      const g = dark ? 72 + n * 10 : 95 + n * 15;
      const b = dark ? 35 + n * 8 : 50 + n * 10;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawStone(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 3333);
      const crack = seededRand(x * 3 + 1, y * 5 + 2, 4444) > 0.88;
      const base = crack ? 90 : 128;
      const v = base + n * 30;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawWoodSide(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 5555);
      const ring = (y + Math.floor(seededRand(x, 0, 6666) * 2)) % 4 < 1;
      const r = ring ? 80 + n * 15 : 107 + n * 15;
      const g = ring ? 52 + n * 10 : 68 + n * 10;
      const b = ring ? 25 + n * 8 : 35 + n * 8;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawWoodTop(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const cx = x - 8, cy = y - 8;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const ring = (dist | 0) % 3 < 1;
      const n = seededRand(x, y, 7070);
      const r = ring ? 120 + n * 15 : 160 + n * 15;
      const g = ring ? 85 + n * 10 : 128 + n * 10;
      const b = ring ? 50 + n * 8 : 80 + n * 8;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawLeaves(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 9999);
      const gap = seededRand(x + 5, y + 3, 1010) > 0.82;
      const r = gap ? 30 + n * 20 : 50 + n * 30;
      const g = gap ? 90 + n * 30 : 120 + n * 40;
      const b = gap ? 15 + n * 10 : 25 + n * 15;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawSand(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 2020);
      const speck = seededRand(x * 7, y * 11, 3030) > 0.9;
      const r = speck ? 190 + n * 15 : 219 + n * 15;
      const g = speck ? 170 + n * 10 : 198 + n * 10;
      const b = speck ? 100 + n * 8 : 123 + n * 10;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawWater(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 4040);
      const wave = Math.sin((x + y) * 0.8) * 0.15;
      const r = (40 + n * 15 + wave * 20) | 0;
      const g = (90 + n * 20 + wave * 30) | 0;
      const b = (180 + n * 30 + wave * 20) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawGlass(ctx, tx, ty) {
  ctx.fillStyle = 'rgba(200,230,240,0.3)';
  ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
  ctx.strokeStyle = 'rgba(180,210,220,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
  ctx.beginPath();
  ctx.moveTo(tx * TILE + 2, ty * TILE + 2);
  ctx.lineTo(tx * TILE + 5, ty * TILE + 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.stroke();
}

function drawBedrock(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 5050);
      const v = 40 + n * 40;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawCobblestone(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 6060);
      const region = ((x * 3 + y * 5 + seededRand(x >> 2, y >> 2, 7171) * 8) | 0) % 5;
      const base = 100 + region * 12;
      const v = base + n * 20;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawPlanks(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 8080);
      const plank = (y >> 2) % 2;
      const grain = (x + seededRand(y >> 2, plank, 9191) * 3) % 8 < 1;
      const r = plank ? (grain ? 155 : 188) + n * 12 : (grain ? 145 : 178) + n * 12;
      const g = plank ? (grain ? 110 : 132) + n * 8 : (grain ? 100 : 125) + n * 8;
      const b = plank ? (grain ? 60 : 82) + n * 6 : (grain ? 50 : 72) + n * 6;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawBrick(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const row = y >> 2;
      const offset = (row & 1) ? 8 : 0;
      const bx = (x + offset) % 16;
      const isMortar = (y % 4 === 0) || (bx % 8 === 0);
      const n = seededRand(x, y, 1212);
      if (isMortar) {
        const v = 180 + n * 30;
        ctx.fillStyle = `rgb(${v | 0},${v | 0},${(v - 10) | 0})`;
      } else {
        const r = 150 + n * 30, g = 55 + n * 15, b = 40 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      }
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawSnow(ctx, tx, ty) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 1313);
      const sparkle = seededRand(x * 11, y * 13, 1414) > 0.92;
      const v = sparkle ? 255 : 230 + n * 20;
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawOre(ctx, tx, ty, baseR, baseG, baseB, oreR, oreG, oreB) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = seededRand(x, y, 3333);
      const isOre = seededRand(x * 5 + 1, y * 7 + 3, 1515) > 0.82;
      const r = isOre ? oreR + n * 20 : baseR + n * 30;
      const g = isOre ? oreG + n * 15 : baseG + n * 30;
      const b = isOre ? oreB + n * 10 : baseB + n * 30;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
    }
  }
}

function drawFlower(ctx, tx, ty, petalR, petalG, petalB) {
  ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
  for (let y = 8; y < 15; y++) {
    const x = 7 + Math.floor(seededRand(0, y, 1616) * 2);
    ctx.fillStyle = '#3a7a20';
    ctx.fillRect(tx * TILE + x, ty * TILE + y, 2, 1);
  }
  const cx = 8, cy = 5;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      if (dx === 0 && dy === 0) {
        ctx.fillStyle = '#ffe040';
      } else {
        const n = seededRand(dx + 3, dy + 3, 1717);
        ctx.fillStyle = `rgb(${(petalR + n * 30) | 0},${(petalG + n * 20) | 0},${(petalB + n * 10) | 0})`;
      }
      ctx.fillRect(tx * TILE + cx + dx, ty * TILE + cy + dy, 1, 1);
    }
  }
}

export function buildTextureAtlas() {
  tileCount = 0;

  const entries = {};
  function reg(block, topDraw, sideDraw, bottomDraw) {
    const t = tileIndex(), s = sideDraw ? tileIndex() : t, b = bottomDraw ? tileIndex() : t;
    entries[block] = { top: { idx: t, draw: topDraw }, side: { idx: s, draw: sideDraw || topDraw }, bottom: { idx: b, draw: bottomDraw || topDraw } };
  }

  reg(BlockType.GRASS, drawGrassTop, drawGrassSide, drawDirt);
  reg(BlockType.DIRT, drawDirt, null, null);
  reg(BlockType.STONE, drawStone, null, null);
  reg(BlockType.WOOD, drawWoodTop, drawWoodSide, drawWoodTop);
  reg(BlockType.LEAVES, drawLeaves, null, null);
  reg(BlockType.SAND, drawSand, null, null);
  reg(BlockType.WATER, drawWater, null, null);
  reg(BlockType.GLASS, drawGlass, null, null);
  reg(BlockType.BEDROCK, drawBedrock, null, null);
  reg(BlockType.COBBLESTONE, drawCobblestone, null, null);
  reg(BlockType.PLANKS, drawPlanks, null, null);
  reg(BlockType.BRICK, drawBrick, null, null);
  reg(BlockType.SNOW, drawSnow, null, null);

  reg(BlockType.COAL_ORE, (c, x, y) => drawOre(c, x, y, 128, 128, 128, 30, 30, 30), null, null);
  reg(BlockType.IRON_ORE, (c, x, y) => drawOre(c, x, y, 128, 128, 128, 200, 170, 130), null, null);
  reg(BlockType.GOLD_ORE, (c, x, y) => drawOre(c, x, y, 128, 128, 128, 240, 210, 50), null, null);
  reg(BlockType.DIAMOND_ORE, (c, x, y) => drawOre(c, x, y, 128, 128, 128, 80, 220, 230), null, null);
  reg(BlockType.FLOWER_RED, (c, x, y) => drawFlower(c, x, y, 200, 40, 30), null, null);
  reg(BlockType.FLOWER_YELLOW, (c, x, y) => drawFlower(c, x, y, 240, 210, 40), null, null);
  reg(BlockType.TALL_GRASS, (ctx, tx, ty) => {
    ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
    for (let i = 0; i < 7; i++) {
      const bx = 2 + Math.floor(seededRand(i, 0, 1818) * 12);
      const h = 6 + Math.floor(seededRand(i, 1, 1919) * 8);
      const n = seededRand(i, 2, 2020);
      ctx.fillStyle = `rgb(${(60 + n * 30) | 0},${(120 + n * 40) | 0},${(30 + n * 20) | 0})`;
      ctx.fillRect(tx * TILE + bx, ty * TILE + TILE - h, 1, h);
    }
  }, null, null);
  reg(BlockType.GRAVEL, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2121);
        const pebble = seededRand(x * 3 + 1, y * 5 + 2, 2222) > 0.7;
        const v = pebble ? 110 + n * 25 : 140 + n * 20;
        ctx.fillStyle = `rgb(${v | 0},${(v - 5) | 0},${(v - 5) | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);
  reg(BlockType.CLAY, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2323);
        const r = 155 + n * 15, g = 155 + n * 12, b = 170 + n * 12;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);
  reg(BlockType.JUNGLE_WOOD, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2525);
        const ring = (y + Math.floor(seededRand(x, 0, 2626) * 3)) % 5 < 1;
        const r = ring ? 70 + n * 12 : 90 + n * 12;
        const g = ring ? 48 + n * 8 : 60 + n * 10;
        const b = ring ? 18 + n * 6 : 28 + n * 6;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.JUNGLE_LEAVES, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2727);
        const dense = seededRand(x + 2, y + 5, 2828) > 0.7;
        const r = dense ? 15 + n * 15 : 25 + n * 25;
        const g = dense ? 80 + n * 30 : 100 + n * 35;
        const b = dense ? 8 + n * 8 : 12 + n * 12;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.CACTUS, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2929);
        const edge = x === 0 || x === 15;
        const stripe = y % 4 === 0;
        const r = edge ? 20 + n * 10 : stripe ? 30 + n * 15 : 45 + n * 20;
        const g = edge ? 80 + n * 20 : stripe ? 100 + n * 25 : 120 + n * 30;
        const b = edge ? 10 + n * 8 : stripe ? 15 + n * 10 : 20 + n * 12;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.MUSHROOM_STEM, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3030);
        const v = 210 + n * 25;
        ctx.fillStyle = `rgb(${v | 0},${(v - 5) | 0},${(v - 15) | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.MUSHROOM_RED, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3131);
        const spot = seededRand(x * 3 + 2, y * 3 + 1, 3232) > 0.85;
        if (spot) {
          const v = 230 + n * 20;
          ctx.fillStyle = `rgb(${v | 0},${v | 0},${(v - 10) | 0})`;
        } else {
          const r = 180 + n * 30, g = 25 + n * 15, b = 20 + n * 10;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        }
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.MUSHROOM_BROWN, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3333);
        const r = 130 + n * 20, g = 90 + n * 15, b = 55 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.DARK_WOOD, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3434);
        const ring = (y + Math.floor(seededRand(x, 0, 3535) * 2)) % 3 < 1;
        const r = ring ? 30 + n * 10 : 50 + n * 12;
        const g = ring ? 18 + n * 6 : 30 + n * 8;
        const b = ring ? 5 + n * 4 : 10 + n * 5;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.DARK_LEAVES, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3636);
        const gap = seededRand(x + 3, y + 7, 3737) > 0.85;
        const r = gap ? 15 + n * 10 : 25 + n * 20;
        const g = gap ? 50 + n * 20 : 70 + n * 30;
        const b = gap ? 8 + n * 5 : 12 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.MOSSY_COBBLE, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 3838);
        const region = ((x * 3 + y * 5 + seededRand(x >> 2, y >> 2, 3939) * 8) | 0) % 5;
        const mossy = seededRand(x + 1, y + 2, 4040) > 0.55;
        if (mossy) {
          const r = 60 + region * 5 + n * 15, g = 100 + region * 6 + n * 20, b = 50 + n * 10;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        } else {
          const base = 100 + region * 12;
          const v = base + n * 20;
          ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
        }
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.MUD, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 4141);
        const wet = seededRand(x * 5, y * 7, 4242) > 0.8;
        const r = wet ? 60 + n * 12 : 85 + n * 15;
        const g = wet ? 40 + n * 8 : 58 + n * 10;
        const b = wet ? 20 + n * 5 : 30 + n * 8;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.LILY_PAD, (ctx, tx, ty) => {
    ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
    const cxp = 8, cyp = 8;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const dx = x - cxp, dy = y - cyp;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 6) continue;
        if (dx > 0 && Math.abs(dy) < dx * 0.3) continue;
        const n = seededRand(x, y, 4343);
        const r = 30 + n * 20, g = 100 + n * 30, b = 15 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.VINES, (ctx, tx, ty) => {
    ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
    for (let i = 0; i < 5; i++) {
      const vx = 1 + Math.floor(seededRand(i, 0, 4444) * 13);
      for (let y = 0; y < TILE; y++) {
        const wiggle = Math.floor(seededRand(i, y, 4545) * 2);
        const n = seededRand(vx + wiggle, y, 4646);
        if (seededRand(i, y, 4747) > 0.85) continue;
        const r = 25 + n * 20, g = 90 + n * 30, b = 12 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + vx + wiggle, ty * TILE + y, 1, 1);
        ctx.fillRect(tx * TILE + vx + wiggle + 1, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.ACACIA_WOOD, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 4848);
        const ring = (y + Math.floor(seededRand(x, 0, 4949) * 2)) % 4 < 1;
        const r = ring ? 90 + n * 12 : 120 + n * 15;
        const g = ring ? 55 + n * 8 : 72 + n * 10;
        const b = ring ? 25 + n * 5 : 38 + n * 6;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.ACACIA_LEAVES, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 5050);
        const gap = seededRand(x + 1, y + 3, 5151) > 0.8;
        const r = gap ? 70 + n * 20 : 95 + n * 25;
        const g = gap ? 100 + n * 25 : 130 + n * 30;
        const b = gap ? 15 + n * 8 : 22 + n * 10;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.PACKED_ICE, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 5252);
        const crack = seededRand(x * 5, y * 3, 5353) > 0.92;
        const r = crack ? 120 + n * 15 : 150 + n * 15;
        const g = crack ? 160 + n * 15 : 185 + n * 12;
        const b = crack ? 200 + n * 15 : 220 + n * 12;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.CORAL, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 5454);
        const kind = ((x * 3 + y * 7) | 0) % 3;
        let r, g, b;
        if (kind === 0) { r = 200 + n * 30; g = 60 + n * 20; b = 120 + n * 20; }
        else if (kind === 1) { r = 60 + n * 20; g = 150 + n * 30; b = 200 + n * 20; }
        else { r = 220 + n * 20; g = 120 + n * 25; b = 40 + n * 15; }
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.SEAGRASS, (ctx, tx, ty) => {
    ctx.clearRect(tx * TILE, ty * TILE, TILE, TILE);
    for (let i = 0; i < 6; i++) {
      const bx = 2 + Math.floor(seededRand(i, 0, 5555) * 11);
      const h = 8 + Math.floor(seededRand(i, 1, 5656) * 6);
      const n = seededRand(i, 2, 5757);
      ctx.fillStyle = `rgb(${(20 + n * 20) | 0},${(100 + n * 40) | 0},${(30 + n * 15) | 0})`;
      for (let sy = 0; sy < h; sy++) {
        const sway = Math.floor(Math.sin(sy * 0.6) * 1.5);
        ctx.fillRect(tx * TILE + bx + sway, ty * TILE + TILE - 1 - sy, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.RED_SAND, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 5858);
        const speck = seededRand(x * 7, y * 11, 5959) > 0.9;
        const r = speck ? 170 + n * 15 : 192 + n * 15;
        const g = speck ? 95 + n * 10 : 112 + n * 10;
        const b = speck ? 40 + n * 8 : 55 + n * 8;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, null, null);

  reg(BlockType.SNOW_GRASS, drawSnow, (ctx, tx, ty) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = seededRand(x, y, 2424);
        if (y < 3) {
          const v = 230 + n * 20;
          ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
        } else {
          const r = 130 + n * 20, g = 95 + n * 15, b = 50 + n * 10;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        }
        ctx.fillRect(tx * TILE + x, ty * TILE + y, 1, 1);
      }
    }
  }, drawDirt);

  const atlasRows = Math.ceil(tileCount / ATLAS_COLS);
  const atlasSize = Math.max(ATLAS_COLS, atlasRows) * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (const block in entries) {
    const e = entries[block];
    for (const face of ['top', 'side', 'bottom']) {
      const { idx, draw } = e[face];
      const tx = idx % ATLAS_COLS;
      const ty = Math.floor(idx / ATLAS_COLS);
      draw(ctx, tx, ty);
    }
  }

  const uvMap = {};
  for (const block in entries) {
    const e = entries[block];
    uvMap[block] = {};
    for (const face of ['top', 'side', 'bottom']) {
      const idx = e[face].idx;
      const col = idx % ATLAS_COLS;
      const row = Math.floor(idx / ATLAS_COLS);
      uvMap[block][face] = {
        u0: (col * TILE) / atlasSize,
        v0: 1 - ((row + 1) * TILE) / atlasSize,
        u1: ((col + 1) * TILE) / atlasSize,
        v1: 1 - (row * TILE) / atlasSize,
      };
    }
  }

  return { canvas, uvMap, atlasSize };
}
