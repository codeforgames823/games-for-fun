# CLAUDE.md

## Project Overview

Minecraft Web is a browser-based voxel sandbox game built with Three.js. Players explore an infinite procedurally generated world, break and place blocks, fight mobs, fly or walk, and save their progress locally via IndexedDB.

## Commands

```bash
npm run dev      # Start Vite dev server on port 5173
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

No test suite. Uses Vite + vanilla JS (ESM), no framework or build-time transpilation.

For multiplayer, run the WebSocket server alongside Vite:

```bash
npm run server   # Start WebSocket server on port 3001 (required for multiplayer)
```

## Architecture

### Entry (`src/main.js`)
- Scene setup (Three.js renderer, camera, lighting, fog)
- Menu (New World / Continue)
- Game loop: player update, chunk load/unload, mob update, raycast highlight, auto-save, render
- Click handler for break/attack (left) / place (D key)
- Health system with damage, death screen, and respawn

### Module Map

| Module | Path | Purpose |
|--------|------|---------|
| config | `src/config.js` | Block types, colors, sizes, physics constants, hotbar palette |
| noise | `src/world/noise.js` | Seeded 2D value noise with fBm for terrain height |
| terrainGen | `src/world/terrainGen.js` | Heightmap terrain + tree placement per chunk |
| chunkStore | `src/world/chunkStore.js` | `Map<key, Uint8Array>` of loaded chunks; get/set block; dirty tracking; ring-based load/unload |
| mesher | `src/world/mesher.js` | Per-chunk face-culled mesh builder (vertex colors, `MeshLambertMaterial`) |
| player | `src/world/player.js` | First-person controller with AABB collision, fly/walk toggle |
| raycast | `src/world/raycast.js` | Step-based ray march to find targeted block + placement face |
| persistence | `src/world/persistence.js` | IndexedDB save/load for seed, player pose, and per-chunk block edits |
| hotbar | `src/ui/hotbar.js` | DOM hotbar with scroll/number-key selection |
| multiplayer | `src/world/multiplayer.js` | WebSocket client: room join/create, position sync, block change relay, remote player meshes with name tags |
| server | `server.js` | WebSocket server: room management with 5-char codes, player sync, block change history, chat broadcast |
| music | `src/audio/music.js` | Procedural ambient music using Web Audio API with calming melodies, scale changes, and pad chords |
| mobModels | `src/mobs/mobModels.js` | 3D block-based mob models: cow, pig, sheep, chicken, zombie, skeleton, spider |
| mobManager | `src/mobs/mobManager.js` | Mob spawning, AI (wander for passive, chase/attack for hostile), gravity, combat, arrows, death effects |

### Key Patterns

- **Chunk key**: `"cx,cz"` string used as Map key everywhere.
- **Block index**: `lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz` within a chunk's `Uint8Array`.
- **Dirty chunks**: When a block is set, the chunk and its edge-adjacent neighbors are marked dirty; `main.js` rebuilds their meshes next frame.
- **Modified blocks**: Only player edits are serialized (as `Map<chunkKey, Map<index, blockType>>`); unmodified chunks regenerate from the seed.
- **Auto-save**: Every 30 seconds to IndexedDB.

### Controls

| Key | Action |
|-----|--------|
| WASD/E or Arrow Keys | Move (forward/back/left/right) |
| Mouse | Look |
| Left click | Break block / Attack mob |
| D | Place block |
| 1–9 / Scroll | Select hotbar slot |
| Space | Jump (walk) / Fly up (fly) |
| Shift | Fly down |
| F | Toggle fly/walk |
| T | Open chat (multiplayer) |
| Enter | Send chat message |
| Escape | Close chat |

### Terrain and World

- **Biomes**: plains, forest, dark forest, desert, snow, jungle, ocean, frozen ocean, swamp, mountains, mushroom island, savanna, mesa, beach
- **Biome terrain**: each biome has unique height curves — oceans carve deep, mountains spike high, swamps are flat, mesas have plateaus
- **Biome trees**: oak (plains/forest), jungle (tall w/ vines), acacia (savanna), dark oak (dark forest), swamp (oaks w/ vines), giant mushrooms (mushroom biome), spruce (snow)
- **Desert/mesa features**: cacti, layered mesa cliffs (red sand + clay stripes)
- **Ocean features**: coral, seagrass on ocean floor; packed ice caps on frozen oceans
- **Swamp features**: mud surface, lily pads on water, vine-draped trees
- **Mountain features**: stone/snow peaks above treeline
- **Caves**: 3D noise carves underground tunnels
- **Ores**: coal (y5-50), iron (y2-40), gold (y2-25), diamond (y2-15) embedded in stone
- **Flora**: biome-specific — tall grass everywhere, dense in savanna/jungle; flowers in plains/mushroom
- **Materials**: gravel pockets underground, clay near water edges

### Mobs

- **Passive**: cow, pig, sheep, chicken — wander randomly, block-built 3D models with leg animation
- **Hostile**: zombie (melee chase), skeleton (ranged bow with arrows, keeps distance), spider (fast melee)
- **Spawning**: mobs spawn within 20-40 blocks of the player on valid ground; despawn beyond 70 blocks; max 30 mobs
- **Combat**: left-click to attack mobs (5 damage per hit, knockback); hostile mobs deal damage to player
- **Health**: player has 20 HP (10 hearts); damage flashes red overlay; death shows respawn screen
- **Flying immunity**: hostile mobs don't damage the player while flying

### Music

- **Ambient music**: procedural calming melodies generated with Web Audio API
- **Scales**: randomly shifts between calm major, minor, and pentatonic scales
- **Pad chord**: continuous low drone adds atmosphere
- **Phrasing**: notes follow musical phrases with rests and harmonic intervals

### Multiplayer

- **Rooms**: Create a room (generates a 5-character code) or join with a code. Max 8 players per room.
- **Sync**: All players share the same world seed. Block changes are broadcast in real-time and replayed for late joiners.
- **Remote players**: Rendered as colored block characters (body, head, legs) with floating name tags.
- **Chat**: Press T to open, Enter to send, Escape to cancel. Server messages (join/leave) shown in yellow.
- **Server**: `server.js` is a standalone WebSocket server (ws on port 3001). Rooms are in-memory; they persist until all players leave.
