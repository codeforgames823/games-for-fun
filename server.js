const express = require('express');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const VITE_PORT = Number(process.env.MINECRAFT_PORT) || 5173;
const BATTLE_BOTS_API_PORT = Number(process.env.BATTLE_BOTS_PORT) || 8080;

app.use(express.static(ROOT, { index: 'index.html' }));

const staticGames = [
  { route: '/games/hill-climb-race', dir: 'hill-climb-race' },
  { route: '/games/geometry-dash', dir: 'geometry-dash-game' },
  { route: '/games/gta', dir: 'gta-game' },
  { route: '/games/annex-escape-room', dir: 'annex-escape-room' },
  { route: '/games/plaything-factory', dir: 'plaything-factory' },
  { route: '/games/battle-bots', dir: 'battle-bots' },
  { route: '/games/hot-dog-tycoon', dir: 'hot-dog-tycoon' },
];

for (const g of staticGames) {
  app.use(g.route, express.static(path.join(ROOT, g.dir)));
}

app.get('/games/polytrack', (_req, res) => {
  res.sendFile(path.join(ROOT, 'polytrack-game.html'));
});

app.use(
  '/games/minecraft-web',
  createProxyMiddleware({
    target: `http://127.0.0.1:${VITE_PORT}`,
    changeOrigin: true,
    ws: true,
  })
);

app.use(
  '/battle-bots-api',
  createProxyMiddleware({
    target: `http://127.0.0.1:${BATTLE_BOTS_API_PORT}`,
    changeOrigin: true,
    pathRewrite: { '^/battle-bots-api': '' },
  })
);

let viteProcess = null;
let battleBotsApiProcess = null;

function startMinecraftVite() {
  const mcDir = path.join(ROOT, 'minecraft-web');
  try {
    execSync('npm ls vite', { cwd: mcDir, stdio: 'ignore' });
  } catch {
    console.log('[portal] Installing minecraft-web dependencies...');
    execSync('npm install', { cwd: mcDir, stdio: 'inherit' });
  }

  console.log(`[portal] Minecraft Web (Vite) on http://127.0.0.1:${VITE_PORT} → /games/minecraft-web/`);
  viteProcess = spawn('npx', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
    cwd: mcDir,
    stdio: 'inherit',
    shell: true,
  });

  viteProcess.on('error', (err) => console.error('[portal] Vite error:', err.message));
  viteProcess.on('exit', (code) => {
    if (code !== null) console.log(`[portal] Vite exited with code ${code}`);
    viteProcess = null;
  });
}

function startBattleBotsApi() {
  const apiDir = path.join(ROOT, 'battle-bots', 'server');
  if (!process.env.DATABASE_URL) {
    console.log('[portal] Battle Bots API skipped (set DATABASE_URL for online multiplayer)');
    return;
  }

  try {
    execSync('npm ls express', { cwd: apiDir, stdio: 'ignore' });
  } catch {
    console.log('[portal] Installing battle-bots server dependencies...');
    execSync('npm install', { cwd: apiDir, stdio: 'inherit' });
  }

  console.log(`[portal] Battle Bots API on http://127.0.0.1:${BATTLE_BOTS_API_PORT} → /battle-bots-api/`);
  battleBotsApiProcess = spawn('node', ['server.js'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: String(BATTLE_BOTS_API_PORT) },
  });

  battleBotsApiProcess.on('error', (err) =>
    console.error('[portal] Battle Bots API error:', err.message)
  );
  battleBotsApiProcess.on('exit', (code) => {
    if (code !== null) console.log(`[portal] Battle Bots API exited with code ${code}`);
    battleBotsApiProcess = null;
  });
}

app.listen(PORT, HOST, () => {
  const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n  ====================================');
  console.log('    Games for Fun — local portal');
  console.log(`    http://${hostLabel}:${PORT}`);
  console.log('  ====================================\n');
  startMinecraftVite();
  startBattleBotsApi();
});

function shutdown() {
  if (viteProcess) viteProcess.kill();
  if (battleBotsApiProcess) battleBotsApiProcess.kill();
  process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
