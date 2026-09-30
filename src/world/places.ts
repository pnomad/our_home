// 인형들의 이동 지도: 집 안 장소(점)와 그 사이 연결. 높이가 다른 장소 사이는 폴짝 뛰어서 이동한다.
// 넓은 장소(area)는 그 안에서 어슬렁거릴 수 있는 사각 범위.
import * as THREE from 'three';

export type PlaceId =
  | 'bedroom' | 'bedFront' | 'bed' | 'doorBL'
  | 'living' | 'sofaFront' | 'sofa' | 'deskFront' | 'deskChair' | 'desk' | 'doorLK'
  | 'kitEntry' | 'kitchen' | 'tableFront' | 'tableChair' | 'table' | 'fridge';

export interface Place {
  id: PlaceId;
  p: THREE.Vector3;
  area?: { x0: number; x1: number; z0: number; z1: number };
  soft?: boolean; // 낮잠 자기 좋은 곳
}

const P = (id: PlaceId, x: number, y: number, z: number, extra: Partial<Place> = {}): Place => ({
  id, p: new THREE.Vector3(x, y, z), ...extra,
});

export const PLACES: Record<PlaceId, Place> = Object.fromEntries(
  [
    // 침실
    P('bedroom', -12, 0, 2.5, { area: { x0: -16, x1: -9.5, z0: 0.6, z1: 5.2 } }),
    P('bedFront', -16, 0, 0.4),
    P('bed', -16, 1.6, -1.3, { area: { x0: -18.8, x1: -13.8, z0: -3.8, z1: -1.0 }, soft: true }),
    P('doorBL', -7, 0, 2.75),
    // 거실
    P('living', -0.5, 0, 3.4, { area: { x0: -5, x1: 4.5, z0: 0.4, z1: 5.2 } }), // 테이블 앞 춤추는 줄(z 1.7)과 안 겹치게
    P('sofaFront', -1.5, 0, -0.6),
    P('sofa', -1.5, 1.5, -3.0, { area: { x0: -4, x1: 1, z0: -4.6, z1: -2.9 }, soft: true }),
    P('deskFront', 8.7, 0, -0.8),
    P('deskChair', 8.7, 1.6, -2.8),
    P('desk', 8.7, 2.6, -4.4, { area: { x0: 7.3, x1: 10.2, z0: -5.2, z1: -4.1 } }),
    P('doorLK', 11, 0, 2.75),
    // 부엌
    P('kitEntry', 12.6, 0, 4.3),
    P('kitchen', 17, 0, 4.5, { area: { x0: 12.5, x1: 20, z0: 3.4, z1: 5.6 } }), // 오른쪽 끝은 세탁기
    P('tableFront', 14.6, 0, 4.3),
    P('tableChair', 14.6, 1.5, 2.2),
    P('table', 14.8, 2.5, 0.8, { area: { x0: 13.4, x1: 17.6, z0: -1.6, z1: 1.1 } }),
    P('fridge', 21, 0, 0.8, { area: { x0: 19.8, x1: 22.5, z0: -1.2, z1: 2.5 } }),
  ].map((p) => [p.id, p]),
) as Record<PlaceId, Place>;

const LINKS: [PlaceId, PlaceId][] = [
  ['bedroom', 'bedFront'], ['bedFront', 'bed'], ['bedroom', 'doorBL'], ['doorBL', 'living'],
  ['living', 'sofaFront'], ['sofaFront', 'sofa'],
  ['living', 'deskFront'], ['deskFront', 'deskChair'], ['deskChair', 'desk'],
  ['living', 'doorLK'], ['doorLK', 'kitEntry'], ['kitEntry', 'kitchen'],
  ['kitchen', 'tableFront'], ['tableFront', 'tableChair'], ['tableChair', 'table'],
  ['kitchen', 'fridge'],
];

const neighbors = new Map<PlaceId, PlaceId[]>();
for (const [a, b] of LINKS) {
  neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
  neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
}

/** from → to 가는 장소 순서 (from 제외, to 포함) */
export function findPath(from: PlaceId, to: PlaceId): PlaceId[] {
  const prev = new Map<PlaceId, PlaceId | null>([[from, null]]);
  const queue: PlaceId[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of neighbors.get(cur) ?? []) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  const path: PlaceId[] = [];
  for (let c: PlaceId | null | undefined = to; c && c !== from; c = prev.get(c)) path.unshift(c);
  return path;
}

/** 지금 위치에서 제일 가까운 장소 (높이 차이는 크게 침) */
export function nearestPlace(pos: THREE.Vector3): PlaceId {
  let best: PlaceId = 'living';
  let bestD = Infinity;
  for (const pl of Object.values(PLACES)) {
    const inArea = pl.area && pos.x >= pl.area.x0 && pos.x <= pl.area.x1 && pos.z >= pl.area.z0 && pos.z <= pl.area.z1;
    const d = (inArea ? 0 : Math.hypot(pos.x - pl.p.x, pos.z - pl.p.z)) + Math.abs(pos.y - pl.p.y) * 5;
    if (d < bestD) {
      bestD = d;
      best = pl.id;
    }
  }
  return best;
}

/** 장소 안의 빈 자리 하나 (가구에 걸리지 않는 곳) */
export function randomSpot(id: PlaceId, heightAt: (x: number, z: number) => number) {
  const pl = PLACES[id];
  if (!pl.area) return pl.p.clone();
  const { x0, x1, z0, z1 } = pl.area;
  for (let i = 0; i < 12; i++) {
    const x = x0 + Math.random() * (x1 - x0);
    const z = z0 + Math.random() * (z1 - z0);
    if (Math.abs(heightAt(x, z) - pl.p.y) < 0.02) return new THREE.Vector3(x, pl.p.y, z);
  }
  return pl.p.clone();
}

/** 넓은 장소(어슬렁거릴 수 있는 곳) 목록 */
export const HANGOUTS: PlaceId[] = (Object.keys(PLACES) as PlaceId[]).filter((id) => PLACES[id].area);
