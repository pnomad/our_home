// 꼬질꼬질: 인형 몸 표면에 흙먼지 얼룩을 붙였다 뗐다 한다 (블록·말랑·복셀 스타일 모두).
// 몸 바깥에서 가운데를 향해 광선을 쏴서 맞은 표면에 납작한 얼룩을 붙인다.
import * as THREE from 'three';
import type { Character } from './models';

const DIRT_COLORS = [0x8a7560, 0x6f5d4b, 0x9b8b76, 0x7d7a6e];
const mats = DIRT_COLORS.map((color) => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85 }));
const spotGeo = new THREE.CircleGeometry(1, 10);
const NAME = 'dirt';

export function setDirty(char: Character, dirty: boolean) {
  const old = char.body.getObjectByName(NAME);
  if (old) char.body.remove(old);
  if (!dirty) return;

  const { root, body } = char;
  const saved = [root.position, root.rotation, root.scale, body.position, body.rotation, body.scale].map((v) => v.clone());
  // 몸 좌표로 계산하려고 잠깐 원점에 똑바로 세움
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  body.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const meshes: THREE.Object3D[] = [];
  char.body.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o));
  const box = new THREE.Box3().setFromObject(char.body);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const group = new THREE.Group();
  group.name = NAME;
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < 80 && placed < 16; i++) {
    // 앞·옆·위 위주 (뒤는 덜 보임), 아래쪽 반에 조금 더 많이
    const a = (Math.random() - 0.5) * Math.PI * 1.7;
    const y = Math.random() * 1.6 - 0.9;
    dir.set(Math.sin(a), y, Math.cos(a)).normalize();
    const from = center.clone().addScaledVector(dir, size.length());
    ray.set(from, dir.clone().negate());
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit?.face) continue;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const spot = new THREE.Mesh(spotGeo, mats[placed % mats.length]);
    const r = 0.04 + Math.random() * 0.07;
    spot.scale.set(r * (1 + Math.random() * 0.6), r, 1);
    spot.position.copy(hit.point).addScaledVector(normal, 0.012);
    spot.lookAt(spot.position.clone().add(normal));
    spot.rotateZ(Math.random() * Math.PI);
    group.add(spot);
    placed++;
  }
  char.body.add(group);

  root.position.copy(saved[0] as THREE.Vector3);
  root.rotation.copy(saved[1] as THREE.Euler);
  root.scale.copy(saved[2] as THREE.Vector3);
  body.position.copy(saved[3] as THREE.Vector3);
  body.rotation.copy(saved[4] as THREE.Euler);
  body.scale.copy(saved[5] as THREE.Vector3);
}
