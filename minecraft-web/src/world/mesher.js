import * as THREE from 'three';
import {
  CHUNK_SIZE, CHUNK_HEIGHT, BlockType,
  TRANSPARENT_BLOCKS,
} from '../config.js';

const FACES = [
  { dir: [ 1,  0,  0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], face: 'side'   },
  { dir: [-1,  0,  0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], face: 'side'   },
  { dir: [ 0,  1,  0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], face: 'top'    },
  { dir: [ 0, -1,  0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], face: 'bottom' },
  { dir: [ 0,  0,  1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], face: 'side'   },
  { dir: [ 0,  0, -1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], face: 'side'   },
];

const UV_CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export class ChunkMesher {
  constructor(texture, uvMap) {
    this.material = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: false,
      transparent: false,
      alphaTest: 0.1,
    });
    this.uvMap = uvMap;

    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: false,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  buildMesh(cx, cz, chunkData, getNeighborBlock) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const tPositions = [];
    const tNormals = [];
    const tUvs = [];
    const tIndices = [];

    let vertexCount = 0;
    let tVertexCount = 0;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const idx = lx * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
          const block = chunkData[idx];
          if (block === BlockType.AIR) continue;

          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const isTransparent = TRANSPARENT_BLOCKS.has(block);
          const blockUVs = this.uvMap[block];
          if (!blockUVs) continue;

          const aPos = isTransparent ? tPositions : positions;
          const aNorm = isTransparent ? tNormals : normals;
          const aUv = isTransparent ? tUvs : uvs;
          const aIdx = isTransparent ? tIndices : indices;
          const vc = isTransparent ? tVertexCount : vertexCount;

          for (const { dir, corners, face } of FACES) {
            const nx = wx + dir[0];
            const ny = y + dir[1];
            const nz = wz + dir[2];
            const neighbor = getNeighborBlock(nx, ny, nz);

            const neighborTransparent = TRANSPARENT_BLOCKS.has(neighbor);
            if (!neighborTransparent) continue;
            if (isTransparent && block === neighbor) continue;

            const faceUV = blockUVs[face];
            if (!faceUV) continue;

            for (let ci = 0; ci < corners.length; ci++) {
              const corner = corners[ci];
              aPos.push(wx + corner[0], y + corner[1], wz + corner[2]);
              aNorm.push(dir[0], dir[1], dir[2]);
              const [cu, cv] = UV_CORNERS[ci];
              aUv.push(
                faceUV.u0 + cu * (faceUV.u1 - faceUV.u0),
                faceUV.v0 + cv * (faceUV.v1 - faceUV.v0)
              );
            }

            const base = isTransparent ? tVertexCount : vertexCount;
            aIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            if (isTransparent) tVertexCount += 4;
            else vertexCount += 4;
          }
        }
      }
    }

    const group = new THREE.Group();

    if (vertexCount > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }

    if (tVertexCount > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tPositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(tNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(tUvs, 2));
      geo.setIndex(tIndices);
      const mesh = new THREE.Mesh(geo, this.transparentMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 1;
      group.add(mesh);
    }

    if (group.children.length === 0) return null;
    return group;
  }
}
