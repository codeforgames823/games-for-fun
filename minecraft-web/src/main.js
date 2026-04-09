import * as THREE from 'three';
import {
  CHUNK_SIZE, RENDER_DISTANCE, SKY_COLOR,
  FOG_NEAR_FACTOR, FOG_FAR_FACTOR,
  BlockType, PLAYER_HEIGHT, PLAYER_WIDTH,
  BLOCK_NAMES, BLOCK_COLORS,
} from './config.js';
import { ChunkStore } from './world/chunkStore.js';
import { ChunkMesher } from './world/mesher.js';
import { Player } from './world/player.js';
import { raycastBlock } from './world/raycast.js';
import { Hotbar } from './ui/hotbar.js';
import { saveWorld, loadWorld, hasSavedWorld } from './world/persistence.js';
import { buildTextureAtlas } from './world/textureAtlas.js';
import { MultiplayerClient } from './world/multiplayer.js';
import { AmbientMusic } from './audio/music.js';
import { MobManager } from './mobs/mobManager.js';

let scene, camera, renderer, player, chunkStore, mesher, hotbar;
let chunkMeshes = new Map();
let highlightMesh;
let lastSaveTime = 0;
const SAVE_INTERVAL = 30000;
const CHUNKS_PER_FRAME = 3;

const particles = [];
let audioCtx = null;
let cloudGroup;

const ambientMusic = new AmbientMusic();
let mobManager = null;
let playerHealth = 20;
const MAX_HEALTH = 20;
let damageFlashTimer = 0;
let dead = false;

const mp = new MultiplayerClient();
let chatOpen = false;

const debugEl = document.getElementById('debug');
const crosshair = document.getElementById('crosshair');
const menuOverlay = document.getElementById('menu-overlay');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const inputName = document.getElementById('input-name');
const inputCode = document.getElementById('input-code');
const mpError = document.getElementById('mp-error');
const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatInputWrap = document.getElementById('chat-input-wrap');
const chatInput = document.getElementById('chat-input');
const playerListEl = document.getElementById('player-list');
const healthBar = document.getElementById('health-bar');
const heartsEl = document.getElementById('hearts');
const damageOverlay = document.getElementById('damage-overlay');
const deathScreen = document.getElementById('death-screen');
const btnRespawn = document.getElementById('btn-respawn');
const worldPicker = document.getElementById('world-picker');
const wpGrid = document.getElementById('wp-grid');
const wpBack = document.getElementById('wp-back');

let chosenSpawnBiome = null;
let gameMode = 'survival';

const WORLD_TYPES = [
  { id: 'random',       name: 'Random',          desc: 'Spawn in a random location with any biome',         colors: null },
  { id: 'plains',       name: 'Plains',           desc: 'Rolling green hills with gentle terrain',           colors: ['#5da83a','#8b6914','#87ceeb'] },
  { id: 'forest',       name: 'Forest',           desc: 'Dense woodlands full of oak trees',                 colors: ['#3a8c1f','#2e7d18','#6b4423'] },
  { id: 'dark_forest',  name: 'Dark Forest',      desc: 'Thick canopy of dark oak trees',                    colors: ['#1a4a10','#143a0a','#2a1c0a'] },
  { id: 'jungle',       name: 'Jungle',           desc: 'Towering trees with vines and lush vegetation',     colors: ['#1a6a10','#165a0c','#5a4020'] },
  { id: 'desert',       name: 'Desert',           desc: 'Endless sand dunes with cacti',                     colors: ['#dbc67b','#d4b96a','#e8c860'] },
  { id: 'mesa',         name: 'Mesa',             desc: 'Red sand plateaus with layered clay cliffs',        colors: ['#c0783a','#a05030','#b87030'] },
  { id: 'savanna',      name: 'Savanna',          desc: 'Open grasslands with flat-topped acacia trees',     colors: ['#8aaa30','#6a8a20','#9a7050'] },
  { id: 'snow',         name: 'Snow',             desc: 'Frozen tundra with snow-capped trees',              colors: ['#f0f0f0','#e8e8e8','#a0c0d0'] },
  { id: 'mountains',    name: 'Mountains',        desc: 'Towering peaks with stone and snow caps',           colors: ['#888888','#f0f0f0','#5da83a'] },
  { id: 'swamp',        name: 'Swamp',            desc: 'Muddy marshlands with lily pads and vines',         colors: ['#5a4020','#2a7a20','#3070d0'] },
  { id: 'mushroom',     name: 'Mushroom Island',  desc: 'Magical land of giant mushroom trees',              colors: ['#c02020','#8a6040','#e0d8c8'] },
  { id: 'ocean',        name: 'Ocean',            desc: 'Vast waters with coral and seagrass below',         colors: ['#2050b0','#3070d0','#dbc67b'] },
  { id: 'frozen_ocean', name: 'Frozen Ocean',     desc: 'Icy seas with packed ice on the surface',           colors: ['#9abade','#88aad0','#2050b0'] },
  { id: 'beach',        name: 'Beach',            desc: 'Sandy shores at the edge of the water',            colors: ['#dbc67b','#3070d0','#87ceeb'] },
];

// --- Menu ---

async function init() {
  const saved = await hasSavedWorld();
  if (saved) btnContinue.style.display = 'block';

  const storedName = localStorage.getItem('mc-player-name') || '';
  if (storedName) inputName.value = storedName;

  btnNew.addEventListener('click', openWorldPicker);
  btnContinue.addEventListener('click', async () => {
    const data = await loadWorld();
    startGame(data, false);
  });
  btnCreateRoom.addEventListener('click', handleCreateRoom);
  btnJoinRoom.addEventListener('click', handleJoinRoom);

  wpBack.addEventListener('click', closeWorldPicker);
  buildWorldCards();

  for (const btn of document.querySelectorAll('.mode-btn')) {
    btn.addEventListener('click', () => {
      for (const b of document.querySelectorAll('.mode-btn')) b.classList.remove('active');
      btn.classList.add('active');
      gameMode = btn.dataset.mode;
    });
  }
}

function openWorldPicker() {
  menuOverlay.style.display = 'none';
  worldPicker.style.display = 'flex';
}

function closeWorldPicker() {
  worldPicker.style.display = 'none';
  menuOverlay.style.display = 'flex';
}

function buildWorldCards() {
  wpGrid.innerHTML = '';
  for (const wt of WORLD_TYPES) {
    const card = document.createElement('div');
    card.className = 'world-card' + (wt.id === 'random' ? ' random-card' : '');

    const preview = document.createElement('div');
    preview.className = 'wc-preview';
    if (wt.colors) {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 100;
      drawBiomePreview(canvas, wt.colors, wt.id);
      preview.appendChild(canvas);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    } else {
      const q = document.createElement('span');
      q.textContent = '?';
      preview.appendChild(q);
    }

    const info = document.createElement('div');
    info.className = 'wc-info';
    const name = document.createElement('div');
    name.className = 'wc-name';
    name.textContent = wt.name;
    const desc = document.createElement('div');
    desc.className = 'wc-desc';
    desc.textContent = wt.desc;
    info.appendChild(name);
    info.appendChild(desc);

    card.appendChild(preview);
    card.appendChild(info);
    card.addEventListener('click', () => {
      chosenSpawnBiome = wt.id === 'random' ? null : wt.id;
      worldPicker.style.display = 'none';
      startGame(null, false);
    });
    wpGrid.appendChild(card);
  }
}

function drawBiomePreview(canvas, colors, biomeId) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = colors[2] || '#87ceeb';
  ctx.fillRect(0, 0, w, h);

  const isWater = ['ocean','frozen_ocean','beach','swamp'].includes(biomeId);
  const groundY = isWater ? h * 0.65 : h * 0.5;
  const seed = biomeId.charCodeAt(0) * 137;

  if (isWater && biomeId !== 'swamp') {
    ctx.fillStyle = colors[1] || colors[0];
    ctx.fillRect(0, groundY - 8, w, h - groundY + 8);
    ctx.fillStyle = colors[0];
    for (let x = 0; x < w; x += 3) {
      const waveY = groundY - 8 + Math.sin(x * 0.08 + seed) * 3;
      ctx.fillRect(x, waveY, 3, 2);
    }
    ctx.fillStyle = colors[2] || '#dbc67b';
    ctx.fillRect(0, h - 12, w, 12);
  } else {
    for (let x = 0; x < w; x += 2) {
      const terrainH = groundY + Math.sin(x * 0.03 + seed * 0.1) * 10 + Math.sin(x * 0.08) * 5;
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, terrainH, 2, h - terrainH);
      ctx.fillStyle = colors[1];
      ctx.fillRect(x, terrainH + 4, 2, h - terrainH - 4);
    }
  }

  const treeTypes = {
    forest: { trunk: '#6b4423', leaves: '#2e7d18', count: 6, tall: 18, wide: 10 },
    dark_forest: { trunk: '#2a1c0a', leaves: '#143a0a', count: 7, tall: 20, wide: 12 },
    jungle: { trunk: '#5a4020', leaves: '#165a0c', count: 5, tall: 28, wide: 8 },
    snow: { trunk: '#6b4423', leaves: '#2e7d18', count: 4, tall: 16, wide: 8 },
    savanna: { trunk: '#6a4828', leaves: '#6a8a20', count: 2, tall: 14, wide: 16 },
    plains: { trunk: '#6b4423', leaves: '#3a8c1f', count: 2, tall: 14, wide: 8 },
    swamp: { trunk: '#6b4423', leaves: '#2e7d18', count: 3, tall: 14, wide: 10 },
    mountains: { trunk: '#6b4423', leaves: '#3a8c1f', count: 2, tall: 10, wide: 6 },
  };

  const treeDef = treeTypes[biomeId];
  if (treeDef) {
    for (let i = 0; i < treeDef.count; i++) {
      const tx = 15 + ((seed * (i + 1) * 7) % (w - 30));
      const baseY = groundY + Math.sin(tx * 0.03 + seed * 0.1) * 10 + Math.sin(tx * 0.08) * 5;
      ctx.fillStyle = treeDef.trunk;
      ctx.fillRect(tx, baseY - treeDef.tall, 3, treeDef.tall);
      ctx.fillStyle = treeDef.leaves;
      const lw = treeDef.wide;
      const lh = biomeId === 'savanna' ? 5 : treeDef.tall * 0.5;
      ctx.fillRect(tx - lw / 2, baseY - treeDef.tall - (biomeId === 'savanna' ? 2 : lh * 0.3), lw, lh);
    }
  }

  if (biomeId === 'mushroom') {
    for (let i = 0; i < 3; i++) {
      const mx = 30 + ((seed * (i + 3) * 11) % (w - 60));
      const baseY = groundY + Math.sin(mx * 0.03 + seed * 0.1) * 10;
      ctx.fillStyle = '#e0d8c8';
      ctx.fillRect(mx, baseY - 22, 3, 22);
      ctx.fillStyle = i % 2 === 0 ? '#c02020' : '#8a6040';
      ctx.beginPath();
      ctx.ellipse(mx + 1, baseY - 22, 12, 7, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  if (biomeId === 'desert' || biomeId === 'mesa') {
    ctx.fillStyle = '#2a7a20';
    for (let i = 0; i < 3; i++) {
      const cx = 20 + ((seed * (i + 5) * 13) % (w - 40));
      const baseY = groundY + Math.sin(cx * 0.03 + seed * 0.1) * 10;
      ctx.fillRect(cx, baseY - 16, 3, 16);
      ctx.fillRect(cx - 3, baseY - 10, 3, 3);
      ctx.fillRect(cx + 3, baseY - 13, 3, 3);
    }
  }

  if (biomeId === 'frozen_ocean') {
    ctx.fillStyle = 'rgba(180,210,240,0.6)';
    for (let x = 0; x < w; x += 20) {
      ctx.fillRect(x, groundY - 10, 16, 4);
    }
  }
}

function findBiomeSpawn(gen, targetBiome) {
  const searchRadius = 2000;
  const step = 16;
  let bestDist = Infinity;
  let bestX = 0, bestZ = 0;

  for (let r = 0; r < searchRadius; r += step) {
    const samples = Math.max(8, Math.floor(r / step) * 4);
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const wx = Math.floor(Math.cos(angle) * r);
      const wz = Math.floor(Math.sin(angle) * r);
      const biome = gen.getBiome(wx, wz);
      if (biome === targetBiome) {
        const dist = r;
        if (dist < bestDist) {
          bestDist = dist;
          bestX = wx;
          bestZ = wz;
        }
      }
    }
    if (bestDist < Infinity) break;
  }
  return { x: bestX, z: bestZ };
}

function getPlayerName() {
  const name = (inputName.value || '').trim() || 'Player';
  localStorage.setItem('mc-player-name', name);
  return name;
}

async function handleCreateRoom() {
  mpError.textContent = '';
  const name = getPlayerName();
  const seed = (Math.random() * 2147483647) | 0;
  try {
    const wsUrl = `ws://${location.hostname}:3001`;
    await mp.connect(wsUrl);
  } catch {
    mpError.textContent = 'Cannot connect to server. Run: npm run server';
    return;
  }
  mp.onRoomCreated = (msg) => {
    startGame(null, true, msg.seed);
    showRoomCode(msg.code);
  };
  mp.onError = (text) => { mpError.textContent = text; };
  mp.createRoom(name, seed);
}

async function handleJoinRoom() {
  mpError.textContent = '';
  const name = getPlayerName();
  const code = (inputCode.value || '').toUpperCase().trim();
  if (code.length < 3) {
    mpError.textContent = 'Enter a room code';
    return;
  }
  try {
    const wsUrl = `ws://${location.hostname}:3001`;
    await mp.connect(wsUrl);
  } catch {
    mpError.textContent = 'Cannot connect to server. Run: npm run server';
    return;
  }
  mp.onRoomJoined = (msg) => {
    startGame(null, true, msg.seed, msg.blockChanges);
    showRoomCode(msg.code);
  };
  mp.onError = (text) => { mpError.textContent = text; };
  mp.joinRoom(name, code);
}

function showRoomCode(code) {
  const existing = document.getElementById('room-code-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'room-code-toast';
  toast.style.cssText = 'position:fixed;top:50px;right:8px;background:rgba(0,0,0,0.7);color:#4fc3f7;padding:8px 14px;border-radius:4px;font-family:monospace;font-size:14px;z-index:20;letter-spacing:3px;';
  toast.textContent = `Room: ${code}`;
  document.body.appendChild(toast);
}

function startGame(savedData, isMultiplayer, mpSeed, mpBlockChanges) {
  menuOverlay.style.display = 'none';
  crosshair.style.display = 'block';
  debugEl.style.display = 'block';

  let seed;
  if (isMultiplayer) {
    seed = mpSeed;
  } else {
    seed = savedData ? savedData.seed : (Math.random() * 2147483647) | 0;
  }

  setupScene();
  chunkStore = new ChunkStore(seed);

  if (isMultiplayer && mpBlockChanges) {
    for (const bc of mpBlockChanges) {
      const cx = Math.floor(bc.x / CHUNK_SIZE);
      const cz = Math.floor(bc.z / CHUNK_SIZE);
      const key = `${cx},${cz}`;
      if (!chunkStore.modifiedBlocks.has(key)) chunkStore.modifiedBlocks.set(key, new Map());
      const lx = ((bc.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((bc.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lx * 64 * 16 + bc.y * 16 + lz;
      chunkStore.modifiedBlocks.get(key).set(idx, bc.block);
    }
  }

  const atlas = buildTextureAtlas();
  const atlasTexture = new THREE.CanvasTexture(atlas.canvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  mesher = new ChunkMesher(atlasTexture, atlas.uvMap);

  hotbar = new Hotbar();
  hotbar.show();

  player = new Player(camera);

  if (savedData && !isMultiplayer) {
    player.position.set(savedData.px, savedData.py, savedData.pz);
    player.yaw = savedData.yaw || 0;
    player.pitch = savedData.pitch || 0;
    player.flying = savedData.flying !== undefined ? savedData.flying : true;
    if (savedData.gameMode) gameMode = savedData.gameMode;
    chunkStore.loadModifiedBlocks(savedData.modifiedBlocks || {});
  } else if (!isMultiplayer && chosenSpawnBiome) {
    const spawn = findBiomeSpawn(chunkStore.gen, chosenSpawnBiome);
    const spawnHeight = chunkStore.gen.getHeight(spawn.x, spawn.z) + 3;
    player.position.set(spawn.x + 0.5, spawnHeight, spawn.z + 0.5);
    chosenSpawnBiome = null;
    player.flying = gameMode === 'creative';
  } else {
    const spawnHeight = chunkStore.gen.getHeight(0, 0) + 3;
    player.position.set(0.5, spawnHeight, 0.5);
    if (!savedData) player.flying = gameMode === 'creative';
  }

  document.body.addEventListener('click', () => {
    if (!document.pointerLockElement && !chatOpen) {
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    player.locked = !!document.pointerLockElement;
  });

  document.addEventListener('mousedown', (e) => {
    if (!player.locked) return;
    if (e.button === 0) handleBreak();
  });

  document.addEventListener('keydown', (e) => {
    if (chatOpen) return;
    if (!player.locked) return;
    if (e.code === 'KeyD') handlePlace();
  });

  if (isMultiplayer) {
    mp.setScene(scene);
    mp.onBlockChange = (x, y, z, block) => {
      chunkStore.setBlock(x, y, z, block);
    };
    mp.onChat = (from, text) => addChatMessage(from, text);
    mp.onPlayerListChanged = updatePlayerList;
    chatBox.style.display = 'flex';
    playerListEl.style.display = 'block';
    updatePlayerList();
    setupChat();
  }

  if (gameMode === 'survival') {
    mobManager = new MobManager(
      scene,
      (wx, wz) => chunkStore.gen.getHeight(wx, wz),
      (x, y, z) => chunkStore.isSolid(x, y, z),
      (x, y, z) => chunkStore.getBlock(x, y, z)
    );
    playerHealth = MAX_HEALTH;
    dead = false;
    healthBar.style.display = 'block';
    renderHearts();
  } else {
    mobManager = null;
    playerHealth = MAX_HEALTH;
    dead = false;
    healthBar.style.display = 'none';
  }

  btnRespawn.addEventListener('click', () => {
    respawnPlayer();
  });

  ambientMusic.start();

  createHighlightBox();
  createClouds();
  requestAnimationFrame(gameLoop);
}

// --- Chat ---

function setupChat() {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !chatOpen && player.locked) {
      e.preventDefault();
      openChat();
    } else if (e.code === 'Enter' && chatOpen) {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text) mp.sendChat(text);
      closeChat();
    } else if (e.code === 'Escape' && chatOpen) {
      closeChat();
    }
  });
}

function openChat() {
  chatOpen = true;
  chatInputWrap.classList.add('active');
  chatInput.value = '';
  chatInput.focus();
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeChat() {
  chatOpen = false;
  chatInputWrap.classList.remove('active');
  chatInput.blur();
}

function addChatMessage(from, text) {
  const line = document.createElement('div');
  line.className = 'chat-line' + (from === 'Server' ? ' server-msg' : '');
  if (from === 'Server') {
    line.textContent = text;
  } else {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = from + ': ';
    line.appendChild(nameSpan);
    line.appendChild(document.createTextNode(text));
  }
  chatMessages.appendChild(line);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  while (chatMessages.children.length > 50) chatMessages.removeChild(chatMessages.firstChild);
}

function updatePlayerList() {
  const players = mp.getPlayerList();
  let html = `<div class="pl-title">Players (${players.length + 1})</div>`;
  html += `<div class="pl-entry"><span class="pl-dot" style="background:#4fc3f7;"></span> ${getPlayerName()} (you)</div>`;
  for (const p of players) {
    html += `<div class="pl-entry"><span class="pl-dot" style="background:${p.color};"></span> ${p.name}</div>`;
  }
  playerListEl.innerHTML = html;
}

// --- Health & Damage ---

function renderHearts() {
  heartsEl.innerHTML = '';
  const fullHearts = Math.floor(playerHealth / 2);
  const halfHeart = playerHealth % 2 === 1;
  const totalHearts = MAX_HEALTH / 2;
  for (let i = 0; i < totalHearts; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart';
    if (i >= fullHearts) {
      heart.className += (i === fullHearts && halfHeart) ? ' half' : ' empty';
    }
    heartsEl.appendChild(heart);
  }
}

function damagePlayer(amount, fromPos) {
  if (dead || player.flying || gameMode === 'creative') return;
  playerHealth = Math.max(0, playerHealth - amount);
  renderHearts();
  damageFlashTimer = 0.3;
  damageOverlay.classList.add('active');
  playSound('hurt');

  if (fromPos) {
    const dx = player.position.x - fromPos.x;
    const dz = player.position.z - fromPos.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    player.velocity.x += (dx / len) * 5;
    player.velocity.y += 3;
    player.velocity.z += (dz / len) * 5;
  }

  if (playerHealth <= 0) {
    dead = true;
    deathScreen.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function respawnPlayer() {
  dead = false;
  deathScreen.style.display = 'none';
  playerHealth = MAX_HEALTH;
  renderHearts();
  const spawnHeight = chunkStore.gen.getHeight(0, 0) + 3;
  player.position.set(0.5, spawnHeight, 0.5);
  player.velocity.set(0, 0, 0);
}

// --- Scene ---

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);

  const fogDist = RENDER_DISTANCE * CHUNK_SIZE;
  scene.fog = new THREE.Fog(SKY_COLOR, fogDist * FOG_NEAR_FACTOR, fogDist * FOG_FAR_FACTOR);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, fogDist * 1.2);

  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8e0, 0.8);
  sun.position.set(100, 200, 80);
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function createHighlightBox() {
  const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
  const edges = new THREE.EdgesGeometry(geo);
  highlightMesh = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
  );
  highlightMesh.visible = false;
  scene.add(highlightMesh);
}

// --- Chunks ---

function updateChunks() {
  const { toLoad, toUnload, needed } = chunkStore.updateLoadedChunks(
    player.position.x, player.position.z
  );

  for (const key of toUnload) {
    chunkStore.unloadChunk(key);
    const group = chunkMeshes.get(key);
    if (group) {
      scene.remove(group);
      disposeGroup(group);
      chunkMeshes.delete(key);
    }
  }

  let built = 0;
  for (const { cx, cz, key } of toLoad) {
    if (built >= CHUNKS_PER_FRAME) break;
    chunkStore.ensureChunk(cx, cz);
    buildChunkMesh(cx, cz, key);
    built++;
  }

  for (const key of chunkStore.dirtyChunks) {
    if (!chunkStore.chunks.has(key)) continue;
    const [cx, cz] = key.split(',').map(Number);
    buildChunkMesh(cx, cz, key);
  }
  chunkStore.dirtyChunks.clear();
}

function buildChunkMesh(cx, cz, key) {
  const data = chunkStore.chunks.get(key);
  if (!data) return;

  const old = chunkMeshes.get(key);
  if (old) {
    scene.remove(old);
    disposeGroup(old);
    chunkMeshes.delete(key);
  }

  const mesh = mesher.buildMesh(cx, cz, data, (wx, wy, wz) => chunkStore.getBlock(wx, wy, wz));
  if (mesh) {
    scene.add(mesh);
    chunkMeshes.set(key, mesh);
  }
}

function disposeGroup(group) {
  for (const child of group.children) {
    if (child.geometry) child.geometry.dispose();
  }
}

// --- Interaction ---

function handleBreak() {
  if (dead) return;

  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(camera.quaternion);
  const camPos = camera.position;
  if (mobManager && mobManager.hitMob(camPos.x, camPos.y, camPos.z, dir.x, dir.y, dir.z)) {
    playSound('hit');
    return;
  }

  const hit = raycastBlock(camera, (x, y, z) => chunkStore.getBlock(x, y, z));
  if (!hit) return;
  if (hit.block === BlockType.BEDROCK) return;
  spawnBreakParticles(hit.x, hit.y, hit.z, hit.block);
  chunkStore.setBlock(hit.x, hit.y, hit.z, BlockType.AIR);
  if (mp.isInRoom) mp.sendBlockChange(hit.x, hit.y, hit.z, BlockType.AIR);
  playSound('break');
}

function handlePlace() {
  if (dead) return;
  const hit = raycastBlock(camera, (x, y, z) => chunkStore.getBlock(x, y, z));
  if (!hit) return;
  const bx = hit.placeX, by = hit.placeY, bz = hit.placeZ;
  if (wouldIntersectPlayer(bx, by, bz)) return;
  const blockType = hotbar.getSelectedBlock();
  chunkStore.setBlock(bx, by, bz, blockType);
  if (mp.isInRoom) mp.sendBlockChange(bx, by, bz, blockType);
  playSound('place');
}

function wouldIntersectPlayer(bx, by, bz) {
  const hw = PLAYER_WIDTH / 2;
  const px = player.position.x, py = player.position.y, pz = player.position.z;
  return (
    bx + 1 > px - hw && bx < px + hw &&
    by + 1 > py && by < py + PLAYER_HEIGHT &&
    bz + 1 > pz - hw && bz < pz + hw
  );
}

function updateHighlight() {
  const hit = raycastBlock(camera, (x, y, z) => chunkStore.getBlock(x, y, z));
  if (hit) {
    highlightMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    highlightMesh.visible = true;
  } else {
    highlightMesh.visible = false;
  }
}

// --- Save ---

async function autoSave() {
  if (mp.isInRoom) return;
  const now = performance.now();
  if (now - lastSaveTime < SAVE_INTERVAL) return;
  lastSaveTime = now;
  try {
    await saveWorld({
      seed: chunkStore.seed,
      px: player.position.x,
      py: player.position.y,
      pz: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
      flying: player.flying,
      gameMode,
      modifiedBlocks: chunkStore.getModifiedBlocksForSave(),
    });
  } catch { /* save silently fails */ }
}

// --- Particles ---

function spawnBreakParticles(bx, by, bz, blockType) {
  const colorSet = BLOCK_COLORS[blockType];
  if (!colorSet) return;
  const hex = colorSet.top;
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;

  for (let i = 0; i < 12; i++) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      bx + 0.2 + Math.random() * 0.6,
      by + 0.2 + Math.random() * 0.6,
      bz + 0.2 + Math.random() * 0.6
    );
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 5 + 1,
      (Math.random() - 0.5) * 4
    );
    scene.add(mesh);
    particles.push({ mesh, vel, life: 0.6 + Math.random() * 0.4, mat });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mat.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 18 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 5;
    p.mesh.rotation.z += dt * 3;
    p.mat.opacity = Math.min(1, p.life * 3);
  }
}

// --- Sound ---

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'break') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch { /* audio silently fails */ }
}

// --- Clouds ---

function createClouds() {
  cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.7,
  });
  for (let i = 0; i < 40; i++) {
    const w = 8 + Math.random() * 20;
    const d = 6 + Math.random() * 14;
    const geo = new THREE.BoxGeometry(w, 2, d);
    const cloud = new THREE.Mesh(geo, cloudMat);
    cloud.position.set(
      (Math.random() - 0.5) * 400,
      52 + Math.random() * 8,
      (Math.random() - 0.5) * 400
    );
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);
}

function updateClouds(dt) {
  if (!cloudGroup) return;
  for (const cloud of cloudGroup.children) {
    cloud.position.x += dt * 2;
    if (cloud.position.x > player.position.x + 250) {
      cloud.position.x = player.position.x - 250;
      cloud.position.z = player.position.z + (Math.random() - 0.5) * 400;
    }
  }
  cloudGroup.position.x = 0;
}

// --- Debug HUD ---

let frameCount = 0, fpsTime = 0, fps = 0;

function updateDebug(dt) {
  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    fps = Math.round(frameCount / fpsTime);
    frameCount = 0;
    fpsTime = 0;
  }
  const p = player.position;
  const blockName = BLOCK_NAMES[hotbar.getSelectedBlock()] || '?';
  const biome = chunkStore.gen.getBiome(Math.floor(p.x), Math.floor(p.z));
  const biomeName = biome.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const mobCount = mobManager ? mobManager.getMobCount() : 0;
  const modeLabel = gameMode === 'creative' ? 'Creative' : 'Survival';
  let text =
    `FPS: ${fps}  [${modeLabel}]\n` +
    `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\n` +
    `Biome: ${biomeName}\n` +
    `Chunks: ${chunkMeshes.size}` + (gameMode === 'survival' ? `  Mobs: ${mobCount}` : '') + `\n` +
    (gameMode === 'survival' ? `HP: ${playerHealth}/${MAX_HEALTH}\n` : '') +
    `${player.flying ? 'Flying' : 'Walking'} [F]\n` +
    `Block: ${blockName}\n` +
    `LClick=Break` + (gameMode === 'survival' ? '/Attack' : '') + `  D=Place`;
  if (mp.isInRoom) {
    text += `\nRoom: ${mp.roomCode}  Players: ${mp.remotePlayers.size + 1}  T=Chat`;
  }
  debugEl.textContent = text;
}

// --- Game Loop ---

let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  if (dt <= 0) return;

  if (!dead) {
    player.update(dt, (x, y, z) => chunkStore.isSolid(x, y, z));
  }
  updateChunks();
  updateHighlight();
  updateParticles(dt);
  updateClouds(dt);
  updateDebug(dt);
  autoSave();

  if (mobManager) {
    mobManager.update(dt, player.position, (dmg, pos) => damagePlayer(dmg, pos));
  }

  ambientMusic.update(dt);

  if (damageFlashTimer > 0) {
    damageFlashTimer -= dt;
    if (damageFlashTimer <= 0) {
      damageOverlay.classList.remove('active');
    }
  }

  if (mp.isInRoom) {
    mp.sendPosition(
      player.position.x, player.position.y, player.position.z,
      player.yaw, player.pitch
    );
    mp.updateRemotePlayers(dt);
  }

  renderer.render(scene, camera);
}

document.addEventListener('contextmenu', (e) => e.preventDefault());

init();
