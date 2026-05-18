# Games for Fun

One local portal for all browser games. Run everything from a single server.

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:4000** (or your machine’s LAN IP on port 4000).

## Games included

| Game | Path |
|------|------|
| Flip Master 3-D | `/games/hill-climb-race/` |
| Neon Dash | `/games/geometry-dash/` |
| Vice Town | `/games/gta/` |
| Annex B Escape Room | `/games/annex-escape-room/` |
| Plaything Factory | `/games/plaything-factory/` |
| Polytrack | `/games/polytrack` |
| Battle Bots | `/games/battle-bots/` |
| Hot Dog Tycoon | `/games/hot-dog-tycoon/` |
| Minecraft Web | `/games/minecraft-web/` |

## Optional: Battle Bots online

Battle Bots works offline (Vs AI). For online multiplayer, set `DATABASE_URL` (Postgres) then restart the portal. The API is proxied at `/battle-bots-api`. In the game, set `localStorage.bb_api` to your portal origin + `/battle-bots-api` (e.g. `http://localhost:4000/battle-bots-api`).

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Portal HTTP port |
| `HOST` | `0.0.0.0` | Bind address (use for LAN access) |
| `MINECRAFT_PORT` | `5173` | Internal Vite port for Minecraft Web |
| `DATABASE_URL` | — | Postgres for Battle Bots API |
