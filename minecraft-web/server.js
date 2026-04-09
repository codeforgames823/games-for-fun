import { WebSocketServer } from 'ws';

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[(Math.random() * chars.length) | 0];
  return code;
}

function generateColor() {
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#e67e22', '#1abc9c', '#e84393',
    '#00cec9', '#fdcb6e', '#6c5ce7', '#ff7675',
  ];
  return colors[(Math.random() * colors.length) | 0];
}

let nextPlayerId = 1;

const wss = new WebSocketServer({ port: PORT });
console.log(`Multiplayer server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  let playerId = null;
  let roomCode = null;
  let playerName = 'Player';
  let playerColor = generateColor();

  function send(msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function broadcast(msg, excludeSelf = true) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const raw = JSON.stringify(msg);
    for (const [id, peer] of room.players) {
      if (excludeSelf && id === playerId) continue;
      if (peer.ws.readyState === 1) peer.ws.send(raw);
    }
  }

  function leaveRoom() {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players.delete(playerId);
    broadcast({ type: 'player_leave', id: playerId });
    broadcast({
      type: 'chat',
      from: 'Server',
      text: `${playerName} left the room`,
    });
    if (room.players.size === 0) {
      rooms.delete(roomCode);
    }
    roomCode = null;
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create_room': {
        if (roomCode) leaveRoom();
        playerId = nextPlayerId++;
        playerName = (msg.name || 'Player').slice(0, 16);
        let code;
        do { code = generateCode(); } while (rooms.has(code));
        roomCode = code;
        const room = {
          code,
          seed: msg.seed || ((Math.random() * 2147483647) | 0),
          players: new Map(),
          blockChanges: [],
        };
        room.players.set(playerId, { ws, name: playerName, color: playerColor });
        rooms.set(code, room);
        send({
          type: 'room_created',
          code,
          seed: room.seed,
          id: playerId,
          color: playerColor,
        });
        break;
      }

      case 'join_room': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          send({ type: 'error', text: 'Room not found' });
          return;
        }
        if (room.players.size >= 8) {
          send({ type: 'error', text: 'Room is full (max 8)' });
          return;
        }
        if (roomCode) leaveRoom();
        playerId = nextPlayerId++;
        playerName = (msg.name || 'Player').slice(0, 16);
        roomCode = code;
        room.players.set(playerId, { ws, name: playerName, color: playerColor });

        const existingPlayers = [];
        for (const [id, p] of room.players) {
          if (id !== playerId) {
            existingPlayers.push({ id, name: p.name, color: p.color });
          }
        }

        send({
          type: 'room_joined',
          code,
          seed: room.seed,
          id: playerId,
          color: playerColor,
          players: existingPlayers,
          blockChanges: room.blockChanges,
        });

        broadcast({
          type: 'player_join',
          id: playerId,
          name: playerName,
          color: playerColor,
        });
        broadcast({
          type: 'chat',
          from: 'Server',
          text: `${playerName} joined the room`,
        });
        break;
      }

      case 'position': {
        if (!roomCode) return;
        broadcast({
          type: 'player_move',
          id: playerId,
          x: msg.x, y: msg.y, z: msg.z,
          yaw: msg.yaw, pitch: msg.pitch,
        });
        break;
      }

      case 'block_change': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        const change = { x: msg.x, y: msg.y, z: msg.z, block: msg.block };
        room.blockChanges.push(change);
        if (room.blockChanges.length > 50000) {
          room.blockChanges = room.blockChanges.slice(-40000);
        }
        broadcast({
          type: 'block_change',
          id: playerId,
          ...change,
        });
        break;
      }

      case 'chat': {
        if (!roomCode) return;
        const text = (msg.text || '').slice(0, 200);
        if (!text) return;
        broadcast({ type: 'chat', from: playerName, text }, false);
        break;
      }
    }
  });

  ws.on('close', () => leaveRoom());
  ws.on('error', () => leaveRoom());
});
