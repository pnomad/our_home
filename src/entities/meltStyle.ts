// 녹여 붙인 스타일: 설계도의 덩어리들을 찰흙처럼 부드럽게 이어 붙인 "한 겹 표면"으로 그린다.
// 덩어리 사이 이음새(목, 다리 뿌리, 꼬리 뿌리)가 매끈하게 이어지고, 색 경계도 살짝 번진다.
// 방법: 공간을 잘게 나눠 "표면까지 거리"를 재고(덩어리끼리는 부드러운 합집합),
//       그 0 인 곳을 surface nets 로 이어서 메쉬를 만든다. 모양당 한 번만 계산해서 재사용.
import * as THREE from 'three';
import { makeCharacter } from './models';
import { taperScale, type Blob, type CharacterSpec } from './shapeSpecs';

export interface MeltOptions {
  /** 이어 붙이는 정도 (클수록 이음새가 두툼하게 녹아 붙음) */
  melt?: number;
  /** 격자 한 칸 크기 (작을수록 매끈하지만 느림) */
  cell?: number;
}

const pw = (v: number, n: number) => Math.abs(v) ** n;

/** 덩어리 표면까지의 대략적인 거리 (안쪽이 음수) */
function blobDistance(b: Blob, x: number, y: number, z: number) {
  const t = Math.max(0.05, taperScale(b, y));
  const n = b.round ?? 2;
  const rx = b.r[0] * t;
  const rz = b.r[2] * t;
  const s = pw((x - b.c[0]) / rx, n) + pw((y - b.c[1]) / b.r[1], n) + pw((z - b.c[2]) / rz, n);
  return (s ** (1 / n) - 1) * Math.min(rx, b.r[1], rz);
}

/** 부드러운 합집합 (k 만큼 녹아 붙음) */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const cache = new Map<string, THREE.BufferGeometry>();

/** 덩어리들 → 녹여 붙인 한 겹 메쉬 (정점 색 포함) */
export function meltedGeometry(blobs: Blob[], opts: MeltOptions = {}) {
  const k = opts.melt ?? 0.07;
  const h = opts.cell ?? 0.025;
  const key = JSON.stringify([blobs, k, h]);
  const cached = cache.get(key);
  if (cached) return cached;

  const field = (x: number, y: number, z: number) => {
    let d = blobDistance(blobs[0], x, y, z);
    for (let i = 1; i < blobs.length; i++) d = smin(d, blobDistance(blobs[i], x, y, z), k);
    return d;
  };

  // 격자 범위
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const b of blobs) {
    const grow = 1 + Math.abs(b.taper ?? 0);
    for (let a = 0; a < 3; a++) {
      const r = b.r[a] * (a === 1 ? 1 : grow);
      lo[a] = Math.min(lo[a], b.c[a] - r - k - 2 * h);
      hi[a] = Math.max(hi[a], b.c[a] + r + k + 2 * h);
    }
  }
  const [nx, ny, nz] = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / h) + 1);
  const idx = (i: number, j: number, l: number) => i + nx * (j + ny * l);
  const f = new Float32Array(nx * ny * nz);
  for (let l = 0; l < nz; l++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) f[idx(i, j, l)] = field(lo[0] + i * h, lo[1] + j * h, lo[2] + l * h);
    }
  }

  // 1) 표면이 지나가는 칸마다 정점 하나 (칸 모서리에서 부호가 바뀌는 점들의 평균)
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let l = 0; l < nz - 1; l++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = f[idx(i + corners[c][0], j + corners[c][1], l + corners[c][2])];
          if (v[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of edges) {
          if (v[a] < 0 === v[b] < 0) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
          sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
          sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
          cnt++;
        }
        cellVert[idx(i, j, l)] = pos.length / 3;
        pos.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (l + sz / cnt) * h);
      }
    }
  }

  // 2) 부호가 바뀌는 격자 선마다 그 선을 둘러싼 네 칸의 정점으로 사각형
  const grad = (x: number, y: number, z: number) => {
    const e = h * 0.5;
    return new THREE.Vector3(
      field(x + e, y, z) - field(x - e, y, z),
      field(x, y + e, z) - field(x, y - e, z),
      field(x, y, z + e) - field(x, y, z - e),
    ).normalize();
  };
  const index: number[] = [];
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    pa.fromArray(pos, a * 3);
    pb.fromArray(pos, b * 3);
    pc.fromArray(pos, c * 3);
    const n = pb.clone().sub(pa).cross(pc.clone().sub(pa));
    const mid = pa.clone().add(pb).add(pc).divideScalar(3);
    // 바깥(거리가 커지는 쪽)을 보도록 감는 방향 맞춤
    if (n.dot(grad(mid.x, mid.y, mid.z)) < 0) index.push(a, c, b);
    else index.push(a, b, c);
  };
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tri(a, b, c);
    tri(a, c, d);
  };
  const cv = (i: number, j: number, l: number) => cellVert[idx(i, j, l)];
  for (let l = 1; l < nz - 1; l++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const here = f[idx(i, j, l)] < 0;
        if (here !== f[idx(i + 1, j, l)] < 0) quad(cv(i, j - 1, l - 1), cv(i, j, l - 1), cv(i, j, l), cv(i, j - 1, l));
        if (here !== f[idx(i, j + 1, l)] < 0) quad(cv(i - 1, j, l - 1), cv(i, j, l - 1), cv(i, j, l), cv(i - 1, j, l));
        if (here !== f[idx(i, j, l + 1)] < 0) quad(cv(i - 1, j - 1, l), cv(i, j - 1, l), cv(i, j, l), cv(i - 1, j, l));
      }
    }
  }

  // 3) 정점마다 매끈한 법선 + 색 (그 자리에 가장 가까운 덩어리 색, 경계는 살짝 번짐)
  const normals: number[] = [];
  const colors: number[] = [];
  const col = new THREE.Color();
  const blobCols = blobs.map((b) => new THREE.Color(b.color));
  const soft = 0.012;
  for (let p = 0; p < pos.length; p += 3) {
    const [x, y, z] = [pos[p], pos[p + 1], pos[p + 2]];
    normals.push(...grad(x, y, z).toArray());
    const ds = blobs.map((b) => blobDistance(b, x, y, z));
    const dmin = Math.min(...ds);
    let wsum = 0;
    col.setRGB(0, 0, 0);
    ds.forEach((d, i) => {
      // 뒤에 나온 덩어리가 살짝 이김 (설계도의 "뒤에 있는 덩어리 색이 이긴다" 규칙)
      const w = Math.exp(-(d - dmin) / soft) * (1 + i * 0.01);
      col.r += blobCols[i].r * w;
      col.g += blobCols[i].g * w;
      col.b += blobCols[i].b * w;
      wsum += w;
    });
    colors.push(col.r / wsum, col.g / wsum, col.b / wsum);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  cache.set(key, g);
  return g;
}

const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const markGeo = new THREE.SphereGeometry(1, 16, 10);
const markMats = new Map<number, THREE.MeshLambertMaterial>();

/** 설계도 → 녹여 붙인 인형 (무늬는 앞에서 광선을 쏴서 표면에 붙임) */
export function buildMelted(spec: CharacterSpec, opts?: MeltOptions) {
  return makeCharacter((b) => {
    const mesh = new THREE.Mesh(meltedGeometry(spec.blobs, opts), bodyMat);
    mesh.castShadow = true;
    b.add(mesh);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const mark of spec.marks) {
      ray.set(new THREE.Vector3(mark.x, mark.y, 10), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(mesh, false)[0];
      if (!hit?.face) continue;
      const normal = hit.face.normal.clone();
      let m = markMats.get(mark.color);
      if (!m) markMats.set(mark.color, (m = new THREE.MeshLambertMaterial({ color: mark.color })));
      const dot = new THREE.Mesh(markGeo, m);
      dot.position.copy(hit.point).addScaledVector(normal, 0.004);
      dot.scale.set(mark.w / 2, mark.h / 2, 0.008);
      dot.lookAt(dot.position.clone().add(normal));
      b.add(dot);
    }
  });
}
