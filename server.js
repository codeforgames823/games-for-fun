const express = require('express');
const path = require('path');
const { execSync, spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;
const ROOT = __dirname;

app.use(express.static(ROOT, { index: 'index.html' }));

const staticGames = [
  { route: '/games/hill-climb-race',    dir: 'hill-climb-race' },
  { route: '/games/geometry-dash',      dir: 'geometry-dash-game' },
  { route: '/games/gta',               dir: 'gta-game' },
  { route: '/games/annex-escape-room',  dir: 'annex-escape-room' },
  { route: '/games/plaything-factory',  dir: 'plaything-factory' },
];

for (const g of staticGames) {
  app.use(g.route, express.static(path.join(ROOT, g.dir)));
}

app.get('/games/polytrack', (_req, res) => {
  res.sendFile(path.join(ROOT, 'polytrack-game.html'));
});

let viteProcess = null;
const VITE_PORT = 5173;

function startMinecraftVite() {
  const mcDir = path.join(ROOT, 'minecraft-web');
  try {
    execSync('npm ls vite', { cwd: mcDir, stdio: 'ignore' });
  } catch {
    console.log('[portal] Installing minecraft-web dependencies...');
    execSync('npm install', { cwd: mcDir, stdio: 'inherit' });
  }

  console.log(`[portal] Starting Minecraft Web (Vite) on port ${VITE_PORT}...`);
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

app.listen(PORT, () => {
  console.log(`\n  ====================================`);
  console.log(`    Games for Fun`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`  ====================================\n`);
  startMinecraftVite();
});

process.on('SIGINT', () => {
  if (viteProcess) viteProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  if (viteProcess) viteProcess.kill();
  process.exit();
});
