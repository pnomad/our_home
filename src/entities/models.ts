import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 블록 스타일 캐릭터 + 모든 스타일이 같이 쓰는 도구(재질, 이름표, 플레이어).
// 블록 캐릭터 조립 도구. 모든 캐릭터는 +z 방향(카메라 쪽)을 앞으로 본다.
// 치수 단위는 1 = 섬 블록 한 칸.

export type Vec3 = [number, number, number];

const materialCache = new Map<number, THREE.MeshLambertMaterial>();
export function mat(color: number) {
  let m = materialCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    materialCache.set(color, m);
  }
  return m;
}

function box(parent: THREE.Object3D, size: Vec3, pos: Vec3, color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// 인형 몸통용 둥근 블록. radius는 가장 짧은 변의 절반을 넘지 않게 자동 제한.
function soft(parent: THREE.Object3D, size: Vec3, pos: Vec3, color: number, radius = 0.12) {
  const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, r), mat(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// 얼굴 부품: 몸 앞면(z=front)에 살짝 붙여서 그림
function face(parent: THREE.Object3D, w: number, h: number, x: number, y: number, front: number, color: number) {
  return box(parent, [w, h, 0.02], [x, y, front + 0.01], color);
}

/** 팔 메쉬를 어깨(shoulderY 높이)를 축으로 돌릴 수 있는 그룹으로 감쌈 (춤출 때 사용) */
function arm(parent: THREE.Object3D, name: 'armL' | 'armR', mesh: THREE.Mesh, shoulderY: number) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(mesh.position.x, shoulderY, mesh.position.z);
  mesh.position.sub(pivot.position);
  pivot.add(mesh);
  parent.add(pivot);
}

export interface Character {
  root: THREE.Group; // 위치·회전용
  body: THREE.Group; // 통통 튀는 애니메이션용
}

export function makeCharacter(build: (body: THREE.Group) => void): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  build(body);
  return { root, body };
}

export const BLACK = 0x2a2323;
export const BLUSH = 0xf4a3b4;
export const FOOT_YELLOW = 0xf2b33d;

export function createPlayer(shirt = 0x5aa9e6) {
  return makeCharacter((b) => {
    box(b, [0.18, 0.3, 0.18], [-0.12, 0.15, 0], 0x4a4a6a); // 다리
    box(b, [0.18, 0.3, 0.18], [0.12, 0.15, 0], 0x4a4a6a);
    box(b, [0.5, 0.4, 0.32], [0, 0.5, 0], shirt); // 몸통
    box(b, [0.55, 0.5, 0.5], [0, 0.95, 0], 0xf6d2b0); // 머리
    box(b, [0.6, 0.18, 0.55], [0, 1.24, -0.03], 0x5b3a29); // 머리카락
    box(b, [0.07, 0.09, 0.02], [-0.12, 0.98, 0.25], BLACK); // 눈
    box(b, [0.07, 0.09, 0.02], [0.12, 0.98, 0.25], BLACK);
  });
}

/** 땅이: 민트빛 하얀 털 오리. 머리와 몸이 이어진 서양배 체형, 큰 노란 부리 */
export function createDdangi() {
  const WHITE = 0xe9f2ea;
  const BEAK = 0xf2b233;
  return makeCharacter((b) => {
    soft(b, [0.26, 0.12, 0.3], [-0.2, 0.06, 0.14], FOOT_YELLOW, 0.05); // 발
    soft(b, [0.26, 0.12, 0.3], [0.2, 0.06, 0.14], FOOT_YELLOW, 0.05);
    soft(b, [0.88, 0.6, 0.66], [0, 0.34, 0], WHITE, 0.28); // 통통한 아랫배 (앞면은 몸과 맞춰 이음새 없게)
    soft(b, [0.74, 1.08, 0.66], [0, 0.6, 0], WHITE, 0.3); // 머리까지 이어진 몸
    arm(b, 'armL', soft(b, [0.14, 0.4, 0.28], [-0.47, 0.42, 0], WHITE, 0.07), 0.58); // 늘어진 날개 (춤출 때 쫙 벌림)
    arm(b, 'armR', soft(b, [0.14, 0.4, 0.28], [0.47, 0.42, 0], WHITE, 0.07), 0.58);
    soft(b, [0.3, 0.16, 0.18], [0, 0.8, 0.38], BEAK, 0.07); // 부리
    const f = 0.33;
    face(b, 0.08, 0.1, -0.19, 0.9, f, BLACK); // 눈
    face(b, 0.08, 0.1, 0.19, 0.9, f, BLACK);
    face(b, 0.03, 0.03, -0.17, 0.93, f + 0.01, 0xffffff); // 눈 반짝이
    face(b, 0.03, 0.03, 0.21, 0.93, f + 0.01, 0xffffff);
  });
}

/** 감자: 살구색 달걀형 오리. 머리와 몸이 한 덩어리, 쪼끄만 부리와 점 눈 */
export function createGamja() {
  const PEACH = 0xf2e4cc;
  return makeCharacter((b) => {
    soft(b, [0.26, 0.12, 0.3], [-0.2, 0.06, 0.14], FOOT_YELLOW, 0.05); // 발
    soft(b, [0.26, 0.12, 0.3], [0.2, 0.06, 0.14], FOOT_YELLOW, 0.05);
    soft(b, [0.86, 0.62, 0.64], [0, 0.36, 0], PEACH, 0.28); // 통통한 아랫부분
    soft(b, [0.76, 1.1, 0.64], [0, 0.61, 0], PEACH, 0.3); // 달걀 몸 전체
    soft(b, [0.14, 0.28, 0.24], [-0.47, 0.5, 0], PEACH, 0.07); // 짧은 날개
    soft(b, [0.14, 0.28, 0.24], [0.47, 0.5, 0], PEACH, 0.07);
    soft(b, [0.16, 0.1, 0.12], [0, 0.86, 0.33], FOOT_YELLOW, 0.04); // 쪼끄만 부리
    const f = 0.32;
    face(b, 0.05, 0.06, -0.15, 0.96, f, BLACK); // 점 눈
    face(b, 0.05, 0.06, 0.15, 0.96, f, BLACK);
    face(b, 0.1, 0.05, -0.25, 0.86, f, BLUSH); // 볼
    face(b, 0.1, 0.05, 0.25, 0.86, f, BLUSH);
  });
}

/** 시바: 주황 등 + 하얀 얼굴·배, 눈 감고 웃는 얼굴 */
export function createShiba() {
  const ORANGE = 0xe89a3a;
  const CREAM = 0xfbf5ea;
  return makeCharacter((b) => {
    soft(b, [0.22, 0.12, 0.26], [-0.2, 0.06, 0.12], ORANGE, 0.05); // 발
    soft(b, [0.22, 0.12, 0.26], [0.2, 0.06, 0.12], ORANGE, 0.05);
    soft(b, [0.84, 0.95, 0.68], [0, 0.52, 0], ORANGE, 0.26); // 몸 전체
    soft(b, [0.72, 0.74, 0.34], [0, 0.42, 0.2], CREAM, 0.16); // 하얀 얼굴·배 (몸에 살짝 파묻힘)
    soft(b, [0.32, 0.18, 0.12], [0, 0.62, 0.4], CREAM, 0.06); // 주둥이
    soft(b, [0.2, 0.18, 0.14], [-0.28, 1.02, 0.02], ORANGE, 0.06); // 귀
    soft(b, [0.2, 0.18, 0.14], [0.28, 1.02, 0.02], ORANGE, 0.06);
    soft(b, [0.2, 0.2, 0.2], [0.2, 0.55, -0.38], CREAM, 0.08); // 말린 꼬리
    soft(b, [0.14, 0.26, 0.1], [-0.46, 0.5, 0.05], ORANGE, 0.05); // 앞발
    soft(b, [0.14, 0.26, 0.1], [0.46, 0.5, 0.05], ORANGE, 0.05);
    const f = 0.37;
    face(b, 0.14, 0.035, -0.17, 0.74, f, BLACK); // 감은 눈
    face(b, 0.14, 0.035, 0.17, 0.74, f, BLACK);
    face(b, 0.1, 0.06, 0, 0.69, f + 0.09, BLACK); // 코
    face(b, 0.08, 0.06, 0, 0.56, f + 0.09, 0xef7f8f); // 혀
    face(b, 0.1, 0.07, -0.27, 0.62, f, BLUSH); // 볼
    face(b, 0.1, 0.07, 0.27, 0.62, f, BLUSH);
    face(b, 0.08, 0.06, -0.16, 0.88, 0.34, CREAM); // 눈썹 점
    face(b, 0.08, 0.06, 0.16, 0.88, 0.34, CREAM);
  });
}

/** 따몽: 보라색 말랑이, 점 눈과 분홍 일자 입 */
export function createDdamong() {
  const PURPLE = 0x9d74d4;
  return makeCharacter((b) => {
    soft(b, [0.96, 0.94, 0.68], [0, 0.47, 0], PURPLE, 0.32); // 한 덩어리 말랑 몸
    soft(b, [0.18, 0.26, 0.26], [-0.5, 0.4, 0.05], PURPLE, 0.08); // 팔
    soft(b, [0.18, 0.26, 0.26], [0.5, 0.4, 0.05], PURPLE, 0.08);
    const f = 0.33;
    face(b, 0.05, 0.06, -0.14, 0.82, f, BLACK); // 점 눈
    face(b, 0.05, 0.06, 0.14, 0.82, f, BLACK);
    face(b, 0.3, 0.035, 0, 0.72, f, 0xf07c9c); // 일자 입
    face(b, 0.1, 0.05, -0.3, 0.74, f, 0xd88fc0); // 볼
    face(b, 0.1, 0.05, 0.3, 0.74, f, 0xd88fc0);
  });
}

// 이름표: 머리 위에 뜨는 글씨 스프라이트
export function createNameTag(text: string, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#5a4630';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
  );
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = height;
  sprite.renderOrder = 10;
  return sprite;
}
