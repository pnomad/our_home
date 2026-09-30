// 말랑 인형 스타일: 설계도의 덩어리를 매끈한 곡면으로 그린다.
import * as THREE from 'three';
import { mat, makeCharacter } from './models';
import { blobNormal, frontSurface, shoulderOf, type CharacterSpec } from './shapeSpecs';

const sphere = new THREE.SphereGeometry(1, 28, 20);

// 덩어리 모양별 구 변형: round(네모난 정도)와 taper(위로 좁아짐) 반영, 모양마다 한 번만 만듦
const shapeCache = new Map<string, THREE.BufferGeometry>();
function blobGeometry(round: number, taper: number) {
  if (round === 2 && taper === 0) return sphere;
  const cacheKey = `${round}|${taper}`;
  let g = shapeCache.get(cacheKey);
  if (!g) {
    g = sphere.clone();
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = (Math.abs(x) ** round + Math.abs(y) ** round + Math.abs(z) ** round) ** (1 / round);
      x /= k; y /= k; z /= k;
      const s = 1 - taper * y;
      pos.setXYZ(i, x * s, y, z * s);
    }
    g.computeVertexNormals();
    shapeCache.set(cacheKey, g);
  }
  return g;
}

export function buildPlush(spec: CharacterSpec) {
  return makeCharacter((b) => {
    for (const blob of spec.blobs) {
      const m = new THREE.Mesh(blobGeometry(blob.round ?? 2, blob.taper ?? 0), mat(blob.color));
      m.position.set(...blob.c);
      m.scale.set(...blob.r);
      m.castShadow = true;
      if (blob.part) {
        // 팔: 어깨를 축으로 돌릴 수 있게 그룹으로 감쌈
        const pivot = new THREE.Group();
        pivot.name = blob.part;
        pivot.position.set(...shoulderOf(blob));
        m.position.sub(pivot.position);
        pivot.add(m);
        b.add(pivot);
      } else {
        b.add(m);
      }
    }
    // 무늬: 얇은 원판을 표면 기울기에 맞춰 붙임
    for (const mark of spec.marks) {
      const hit = frontSurface(spec.blobs, mark.x, mark.y);
      if (!hit) continue;
      const normal = new THREE.Vector3(...blobNormal(hit.blob, mark.x, mark.y, hit.z));
      const pos = new THREE.Vector3(mark.x, mark.y, hit.z).addScaledVector(normal, 0.004);
      const m = new THREE.Mesh(sphere, mat(mark.color));
      m.position.copy(pos);
      m.scale.set(mark.w / 2, mark.h / 2, 0.008);
      m.lookAt(pos.clone().add(normal));
      b.add(m);
    }
  });
}
