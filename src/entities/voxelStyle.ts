// 복셀 스타일: 설계도를 작은 큐브들로 채워서 그린다 (크로시 로드 느낌).
import * as THREE from 'three';
import { makeCharacter } from './models';
import { insideBlob, shoulderOf, type Blob, type CharacterSpec, type Mark } from './shapeSpecs';

const VOXEL = 0.1;

export function buildVoxel(spec: CharacterSpec) {
  return makeCharacter((b) => {
    b.add(voxelMesh(spec.blobs.filter((bl) => !bl.part), spec.marks));
    // 팔: 따로 큐브로 채워서 어깨를 축으로 돌릴 수 있게
    for (const blob of spec.blobs.filter((bl) => bl.part)) {
      const pivot = new THREE.Group();
      pivot.name = blob.part!;
      pivot.position.set(...shoulderOf(blob));
      const mesh = voxelMesh([blob], []);
      mesh.position.sub(pivot.position);
      pivot.add(mesh);
      b.add(pivot);
    }
  });
}

/** 덩어리들을 같은 격자의 큐브로 채운 메쉬 */
function voxelMesh(blobs: Blob[], marks: Mark[]) {
  // 1) 격자 범위
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { c, r } of blobs) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], Math.floor((c[a] - r[a]) / VOXEL));
      max[a] = Math.max(max[a], Math.ceil((c[a] + r[a]) / VOXEL));
    }
  }
  min[1] = Math.max(min[1], 0); // 땅 아래는 자름

  // 2) 칸마다 색 결정 (뒤에 나온 덩어리가 이김)
  const grid = new Map<string, number>();
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  for (let i = min[0]; i <= max[0]; i++) {
    for (let j = min[1]; j <= max[1]; j++) {
      for (let k = min[2]; k <= max[2]; k++) {
        const p = [(i + 0.5) * VOXEL, (j + 0.5) * VOXEL, (k + 0.5) * VOXEL];
        for (const b of blobs) {
          if (insideBlob(b, p[0], p[1], p[2])) grid.set(key(i, j, k), b.color);
        }
      }
    }
  }

  // 3) 무늬: 해당 칸 열에서 가장 앞쪽 큐브를 칠함 (최소 1칸)
  // 중심이 무늬 범위 안에 드는 칸들. 하나도 없으면 가장 가까운 한 칸.
  const cells = (center: number, size: number) => {
    let lo = Math.ceil((center - size / 2) / VOXEL - 0.5);
    let hi = Math.floor((center + size / 2) / VOXEL - 0.5);
    if (hi < lo) lo = hi = Math.round(center / VOXEL - 0.5);
    return [lo, hi];
  };
  for (const m of marks) {
    const [i0, i1] = cells(m.x, m.w);
    const [j0, j1] = cells(m.y, m.h);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (let k = max[2]; k >= min[2]; k--) {
          if (grid.has(key(i, j, k))) {
            grid.set(key(i, j, k), m.color);
            break;
          }
        }
      }
    }
  }

  // 4) 겉에 보이는 큐브만 InstancedMesh로
  const visible: [number, number, number, number][] = [];
  for (const [kstr, color] of grid) {
    const [i, j, k] = kstr.split(',').map(Number);
    const hidden =
      grid.has(key(i + 1, j, k)) && grid.has(key(i - 1, j, k)) &&
      grid.has(key(i, j + 1, k)) && grid.has(key(i, j - 1, k)) &&
      grid.has(key(i, j, k + 1)) && grid.has(key(i, j, k - 1));
    if (!hidden) visible.push([i, j, k, color]);
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL),
    new THREE.MeshLambertMaterial(),
    visible.length,
  );
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  visible.forEach(([i, j, k, color], n) => {
    mtx.makeTranslation((i + 0.5) * VOXEL, (j + 0.5) * VOXEL, (k + 0.5) * VOXEL);
    mesh.setMatrixAt(n, mtx);
    mesh.setColorAt(n, col.setHex(color));
  });
  mesh.castShadow = true;
  return mesh;
}
