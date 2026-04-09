# Flip Master 3-D

A hill-climbing flip-trick racing game built as a single-page HTML5 canvas game.

## Architecture
- **Single file**: `index.html` contains all HTML, CSS, JS
- **Server**: `server.js` — Express + PostgreSQL for leaderboard, cloud saves, player stats
- **Physics**: Custom 2D rigid body with spring-damper suspension, wheel friction, torque, air angular damping
- **Terrain**: Procedural generation using layered sine waves per stage with ramps and dips
- **Vehicles**: Jeep, Sports Car, Monster Truck, Moon Buggy — each with unique stats and detailed canvas art
- **Stages**: Countryside, Desert, Arctic, Moon — each with unique terrain, gravity, visuals, decorations
- **Economy**: Coins collected in-game fund upgrades (Engine, Suspension, Tires, Fuel)
- **Controls**: Arrow keys / WASD / on-screen gas+brake+nitro buttons (touch-friendly)

## Features
- **Pause system** (Escape key, auto-pauses on tab switch)
- **Procedural music** that intensifies with speed
- **Volume controls** (Master, Music, SFX) with persistence
- **Achievement system** (10 achievements with toast notifications)
- **Daily challenge** mode (same terrain seed for all players each day)
- **Tutorial overlay** on first play
- **Wheelie detection** with coin bonuses
- **Fuel warnings** and speed milestone popups
- **Distance markers** every 100m with flags at 500m intervals
- **Environmental decorations** (trees, cacti, snowmen, craters per stage)
- **Sky decorations** (clouds for day stages, stars + planet for moon)
- **Crash effects** (particles, screen shake, roll-over detection)
- **Leaderboard** with XSS protection
- **Cloud saves** with input validation

## Server Security
- Rate limiting on all API endpoints
- Input sanitization (username regex, vehicle/stage whitelist, value clamping)
- No internal error message leaking
- Save data size limits

## How to Run
Open `index.html` in any modern browser for offline play. For online features:
```
npm install
DATABASE_URL=postgres://... npm start
```

## Game Loop
1. Main Menu → select vehicle + stage, buy upgrades
2. Drive: gas/brake/nitro, collect coins, manage fuel
3. Do flips, wheelies, combos for bonus coins
4. Game Over on crash (head/rollover) or fuel empty
5. Earn coins → upgrade vehicle → drive further
6. Unlock achievements as you progress
