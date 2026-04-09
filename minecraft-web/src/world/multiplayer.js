import * as THREE from 'three';
import { PLAYER_HEIGHT } from '../config.js';

const SEND_RATE = 50;

export class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.myId = null;
    this.roomCode = null;
    this.connected = false;
    this.remotePlayers = new Map();
    this.scene = null;
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onError = null;
    this.onChat = null;
    this.onBlockChange = null;
    this.onPlayerListChanged = null;
    this._lastSendTime = 0;
    this._lastPos = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  }

  setScene(scene) {
    this.scene = scene;
  }

  connect(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onclose = () => {
        this.connected = false;
        this._cleanupAllRemote();
      };
      this.ws.onmessage = (e) => this._handleMessage(JSON.parse(e.data));
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.roomCode = null;
    this.myId = null;
    this._cleanupAllRemote();
  }

  _send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  createRoom(name, seed) {
    this._send({ type: 'create_room', name, seed });
  }

  joinRoom(name, code) {
    this._send({ type: 'join_room', name, code });
  }

  sendPosition(x, y, z, yaw, pitch) {
    const now = performance.now();
    if (now - this._lastSendTime < SEND_RATE) return;
    const dx = x - this._lastPos.x;
    const dy = y - this._lastPos.y;
    const dz = z - this._lastPos.z;
    const dYaw = yaw - this._lastPos.yaw;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && Math.abs(dz) < 0.01 && Math.abs(dYaw) < 0.005) return;
    this._lastSendTime = now;
    this._lastPos = { x, y, z, yaw, pitch };
    this._send({ type: 'position', x, y, z, yaw, pitch });
  }

  sendBlockChange(x, y, z, block) {
    this._send({ type: 'block_change', x, y, z, block });
  }

  sendChat(text) {
    this._send({ type: 'chat', text });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'room_created':
        this.myId = msg.id;
        this.roomCode = msg.code;
        if (this.onRoomCreated) this.onRoomCreated(msg);
        break;

      case 'room_joined':
        this.myId = msg.id;
        this.roomCode = msg.code;
        if (msg.players) {
          for (const p of msg.players) {
            this._addRemotePlayer(p.id, p.name, p.color);
          }
        }
        if (this.onRoomJoined) this.onRoomJoined(msg);
        break;

      case 'player_join':
        this._addRemotePlayer(msg.id, msg.name, msg.color);
        if (this.onPlayerListChanged) this.onPlayerListChanged();
        break;

      case 'player_leave':
        this._removeRemotePlayer(msg.id);
        if (this.onPlayerListChanged) this.onPlayerListChanged();
        break;

      case 'player_move':
        this._updateRemotePlayer(msg.id, msg.x, msg.y, msg.z, msg.yaw, msg.pitch);
        break;

      case 'block_change':
        if (this.onBlockChange) this.onBlockChange(msg.x, msg.y, msg.z, msg.block);
        break;

      case 'chat':
        if (this.onChat) this.onChat(msg.from, msg.text);
        break;

      case 'error':
        if (this.onError) this.onError(msg.text);
        break;
    }
  }

  _addRemotePlayer(id, name, color) {
    if (this.remotePlayers.has(id)) return;

    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.45;
    group.add(head);

    const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.35);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x3a5ca0 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, -0.3, 0);
    body.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, -0.3, 0);
    body.add(rightLeg);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 42);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 2.1;
    group.add(sprite);

    if (this.scene) this.scene.add(group);

    this.remotePlayers.set(id, {
      group,
      name,
      color,
      targetPos: new THREE.Vector3(0, 40, 0),
      targetYaw: 0,
      materials: [bodyMat, headMat, legMat, spriteMat],
    });
  }

  _removeRemotePlayer(id) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    if (this.scene) this.scene.remove(rp.group);
    rp.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    for (const mat of rp.materials) mat.dispose();
    this.remotePlayers.delete(id);
  }

  _updateRemotePlayer(id, x, y, z, yaw) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    rp.targetPos.set(x, y, z);
    rp.targetYaw = yaw;
  }

  updateRemotePlayers(dt) {
    for (const [, rp] of this.remotePlayers) {
      rp.group.position.lerp(rp.targetPos, Math.min(1, dt * 10));
      const currentY = rp.group.rotation.y;
      let diff = rp.targetYaw - currentY;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      rp.group.rotation.y = currentY + diff * Math.min(1, dt * 10);
    }
  }

  _cleanupAllRemote() {
    for (const [id] of this.remotePlayers) {
      this._removeRemotePlayer(id);
    }
    this.remotePlayers.clear();
  }

  getPlayerList() {
    const list = [];
    for (const [id, rp] of this.remotePlayers) {
      list.push({ id, name: rp.name, color: rp.color });
    }
    return list;
  }

  get isInRoom() {
    return this.connected && this.roomCode !== null;
  }
}
