// 인형 겉모습을 "한 겹 천"처럼: 공·캡슐·둥근 상자로 된 부품들을 부드럽게 녹여 붙인 한 덩어리 메시로 만든다.
// 충돌 모양(부품 그대로)은 그대로 두고, 화면에 보이는 겉모습만 바꾼다.
// 방법: 공간을 잘게 나눠 표면까지 거리를 재고(부품끼리는 부드러운 합집합) surface nets 로 이어 붙인다.
// 같은 모양·색은 한 번만 계산해서 재사용한다.
import * as THREE from 'three';
import type { Part, Shape } from './parts';

const v = new THREE.Vector3();

/** 부품 좌표계에서 모양 표면까지 거리 (안쪽이 음수) */
function shapeDistance(s: Shape, x: number, y: number, z: number): number {
  switch (s.type) {
    case 'ball':
      return Math.hypot(x, y, z) - s.r;
    case 'capsule': {
      const cy = y - Math.max(-s.hh, Math.min(s.hh, y));
      return Math.hypot(x, cy, z) - s.r;
    }
    case 'cuboid':
      return boxDistance(x, y, z, s.hx, s.hy, s.hz);
    case 'roundCuboid':
      return boxDistance(x, y, z, s.hx - s.br, s.hy - s.br, s.hz - s.br) - s.br;
    case 'cylinder': {
      const dx = Math.hypot(x, z) - s.r;
      const dy = Math.abs(y) - s.hh;
      return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    }
  }
}

function boxDistance(x: number, y: number, z: number, hx: number, hy: number, hz: number) {
  const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}

/** 대략 크기 (격자 범위용) */
function extent(s: Shape): number {
  switch (s.type) {
    case 'ball': return s.r;
    case 'capsule': return s.hh + s.r;
    case 'cuboid': case 'roundCuboid': return Math.hypot(s.hx, s.hy, s.hz);
    case 'cylinder': return Math.hypot(s.r, s.hh);
  }
}

/** 부드러운 합집합 (k 만큼 녹아 붙음) */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

interface Prepared {
  shape: Shape;
  pos: THREE.Vector3;
  inv: THREE.Quaternion;
  color: THREE.Color;
}

const cache = new Map<string, THREE.BufferGeometry>();

/** 부품들 → 녹여 붙인 메시 하나 (정점 색). melt = 이어 붙이는 두께(m) */
export function meltedPlushGeometry(parts: Part[], melt: number): THREE.BufferGeometry {
  const key = JSON.stringify([parts.map((p) => [p.shape, p.pos, p.rot, p.color]), melt]);
  const hit = cache.get(key);
  if (hit) return hit;

  const prep: Prepared[] = parts.map((p) => ({
    shape: p.shape,
    pos: new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
    inv: new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))).invert(),
    color: new THREE.Color(p.color ?? 0xffffff),
  }));
  const dist = (i: number, x: number, y: number, z: number) => {
    const q = prep[i];
    v.set(x, y, z).sub(q.pos).applyQuaternion(q.inv);
    return shapeDistance(q.shape, v.x, v.y, v.z);
  };
  const field = (x: number, y: number, z: number) => {
    let d = dist(0, x, y, z);
    for (let i = 1; i < prep.length; i++) d = smin(d, dist(i, x, y, z), melt);
    return d;
  };

  // 격자: 가장 작은 부품도 몇 칸은 걸치도록, 전체가 너무 잘게 쪼개지지는 않도록
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let smallest = Infinity;
  for (const q of prep) {
    const e = extent(q.shape) + melt;
    smallest = Math.min(smallest, extent(q.shape));
    const c = q.pos.toArray();
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], c[a] - e);
      hi[a] = Math.max(hi[a], c[a] + e);
    }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const h = Math.max(span / 56, Math.min(span / 32, smallest / 2.5));
  for (let a = 0; a < 3; a++) { lo[a] -= 2 * h; hi[a] += 2 * h; }
  const [nx, ny, nz] = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / h) + 1);
  const idx = (i: number, j: number, l: number) => i + nx * (j + ny * l);
  const f = new Float32Array(nx * ny * nz);
  for (let l = 0; l < nz; l++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    f[idx(i, j, l)] = field(lo[0] + i * h, lo[1] + j * h, lo[2] + l * h);
  }

  // 1) 표면이 지나가는 칸마다 정점 하나
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let l = 0; l < nz - 1; l++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      cv[c] = f[idx(i + C[c][0], j + C[c][1], l + C[c][2])];
      if (cv[c] < 0) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if (cv[a] < 0 === cv[b] < 0) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t;
      sy += C[a][1] + (C[b][1] - C[a][1]) * t;
      sz += C[a][2] + (C[b][2] - C[a][2]) * t;
      n++;
    }
    cellVert[idx(i, j, l)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (l + sz / n) * h);
  }

  // 2) 부호가 바뀌는 격자 선마다 사각형 (바깥을 보도록 감는 방향은 기울기로 맞춤)
  const e = h * 0.5;
  const grad = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(
    field(x + e, y, z) - field(x - e, y, z),
    field(x, y + e, z) - field(x, y - e, z),
    field(x, y, z + e) - field(x, y, z - e),
  ).normalize();
  const index: number[] = [];
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), nrm = new THREE.Vector3(), g = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    pa.fromArray(pos, a * 3); pb.fromArray(pos, b * 3); pc.fromArray(pos, c * 3);
    nrm.subVectors(pb, pa).cross(g.subVectors(pc, pa));
    const mx = (pa.x + pb.x + pc.x) / 3, my = (pa.y + pb.y + pc.y) / 3, mz = (pa.z + pb.z + pc.z) / 3;
    if (nrm.dot(grad(mx, my, mz, g)) < 0) index.push(a, c, b);
    else index.push(a, b, c);
  };
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tri(a, b, c);
    tri(a, c, d);
  };
  const at = (i: number, j: number, l: number) => cellVert[idx(i, j, l)];
  for (let l = 1; l < nz - 1; l++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const here = f[idx(i, j, l)] < 0;
    if (here !== f[idx(i + 1, j, l)] < 0) quad(at(i, j - 1, l - 1), at(i, j, l - 1), at(i, j, l), at(i, j - 1, l));
    if (here !== f[idx(i, j + 1, l)] < 0) quad(at(i - 1, j, l - 1), at(i, j, l - 1), at(i, j, l), at(i - 1, j, l));
    if (here !== f[idx(i, j, l + 1)] < 0) quad(at(i - 1, j - 1, l), at(i, j - 1, l), at(i, j, l), at(i - 1, j, l));
  }

  // 3) 매끈한 법선 + 색 (가장 가까운 부품 색, 경계는 살짝 번짐 / 뒤에 나온 부품이 살짝 이김)
  const normals: number[] = [];
  const colors: number[] = [];
  const soft = Math.max(0.0015, melt * 0.25);
  const ds = new Float32Array(prep.length);
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2];
    grad(x, y, z, g);
    normals.push(g.x, g.y, g.z);
    let dmin = Infinity;
    for (let i = 0; i < prep.length; i++) { ds[i] = dist(i, x, y, z); dmin = Math.min(dmin, ds[i]); }
    let r = 0, gg = 0, b = 0, wsum = 0;
    for (let i = 0; i < prep.length; i++) {
      const w = Math.exp(-(ds[i] - dmin) / soft) * (1 + i * 0.01);
      r += prep[i].color.r * w; gg += prep[i].color.g * w; b += prep[i].color.b * w;
      wsum += w;
    }
    colors.push(r / wsum, gg / wsum, b / wsum);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  cache.set(key, geo);
  return geo;
}

/** 녹여 붙인 인형 천 재질 (정점 색 + 보송한 광택) */
export const plushFabric = new THREE.MeshPhysicalMaterial({
  vertexColors: true, roughness: 1, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff),
});
