// 인형의 집: 침실 · 거실 · 부엌. 인형 키(약 30cm)를 1칸으로 잡아서 가구가 거대하다.
// 앞쪽 벽은 없는 인형의 집 구조. 가구는 전부 축에 맞춘 상자(Solid)라서 높이 계산이 간단하다.
import * as THREE from 'three';
import type { VillagerId } from '../entities/styles';

/** 걷기만 해도 저절로 폴짝 올라가는 높이 (책 한 권, 문턱 정도) */
export const HOP_HEIGHT = 0.6;
/** 점프로 올라갈 수 있는 높이: 바닥 → 의자·침대·소파, 의자 → 식탁·책상 */
export const JUMP_HEIGHT = 1.9;

interface Solid {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  top: number;
}

/** 주민이 돌아다니는 구역 (가구 윗면 등) */
export interface Zone {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
}

/** 냉장고: 여닫는 문, 안쪽 불빛, 만두 쟁반 (냉장고 털기 이벤트용) */
export interface Fridge {
  /** 0 = 닫힘, 1 = 활짝 열림 (양문) */
  setOpen(k: number): void;
  light: THREE.PointLight;
  tray: THREE.Group; // 만두 쟁반 (만두는 tray.children 중 name === 'mandu')
  trayHome: THREE.Vector3;
  front: THREE.Vector3; // 탑을 쌓는 자리 (문 바로 앞 바닥)
}

/** 사각 구역 + 높이 */
export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
}

export interface House {
  group: THREE.Group;
  /** 침실 창문으로 들어와 침대를 비추는 햇빛 (0 = 없음, 1 = 가장 밝음) */
  setSunbeam(k: number): void;
  fridge: Fridge;
  bed: Area; // 잘 자기 버튼이 뜨는 곳
  /** (x, z)에서 밟을 수 있는 가장 높은 면의 높이. 벽·집 밖은 Infinity */
  heightAt(x: number, z: number): number;
  spawn: THREE.Vector3;
  zones: Record<VillagerId, Zone>;
}

// 집 크기: x -21 ~ 23, z -6 ~ 6 (앞쪽 z=6은 벽 없음)
const BOUNDS = { x0: -21, x1: 23, z0: -6, z1: 6 };
const ROOMS = [
  { name: '침실', x0: -21, x1: -7, wall: 0xf6d9d5, floor: 'wood' as const },
  { name: '거실', x0: -7, x1: 11, wall: 0xdcebd8, floor: 'wood' as const },
  { name: '부엌', x0: 11, x1: 23, wall: 0xfbefcf, floor: 'tile' as const },
];
const DOOR = { z0: 1, z1: 4.5 };

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const tones = ['#d8b184', '#d2a979', '#dcb88c', '#cfa574'];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i % tones.length];
    g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = 'rgba(120,80,40,.25)';
    g.fillRect(0, i * 32, 256, 2);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f7f3ea';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#cfe0e8';
  g.fillRect(0, 0, 64, 64);
  g.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createHouse(): House {
  const group = new THREE.Group();
  const solids: Solid[] = [];
  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (color: number) => {
    let m = mats.get(color);
    if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color })));
    return m;
  };

  /** 상자 하나. solid면 밟거나 부딪히는 대상이 된다 */
  const box = (x: [number, number], y: [number, number], z: [number, number], color: number, solid = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x[1] - x[0], y[1] - y[0], z[1] - z[0]), mat(color));
    mesh.position.set((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (solid) solids.push({ x0: x[0], x1: x[1], z0: z[0], z1: z[1], top: y[1] });
    return mesh;
  };

  // ---------- 바닥 · 벽 ----------
  const wood = woodTexture();
  const tile = tileTexture();
  for (const room of ROOMS) {
    const w = room.x1 - room.x0;
    const d = BOUNDS.z1 - BOUNDS.z0;
    const tex = (room.floor === 'wood' ? wood : tile).clone();
    tex.repeat.set(w / (room.floor === 'wood' ? 6 : 2), d / (room.floor === 'wood' ? 6 : 2));
    tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((room.x0 + room.x1) / 2, 0, 0);
    floor.receiveShadow = true;
    group.add(floor);
    box([room.x0, room.x1], [0, 8], [-6.5, -6], room.wall); // 뒷벽
    box([room.x0, room.x1], [0, 0.4], [-6, -5.9], 0xffffff, false); // 걸레받이
  }
  // 바닥 앞 테두리 (인형의 집 단면)
  box([BOUNDS.x0 - 0.5, BOUNDS.x1 + 0.5], [-0.6, 0], [6, 6.4], 0xb08a64, false);
  box([-21.5, -21], [0, 8], [-6.5, 6], ROOMS[0].wall); // 왼쪽 벽
  box([23, 23.5], [0, 8], [-6.5, 6], ROOMS[2].wall); // 오른쪽 벽
  for (const x of [-7, 11]) {
    // 방 사이 벽 (문 뚫림, 앞은 낮게)
    box([x - 0.25, x + 0.25], [0, 8], [-6, DOOR.z0], 0xf4ede4);
    box([x - 0.25, x + 0.25], [0, 1.6], [DOOR.z1, 6], 0xf4ede4);
    box([x - 0.25, x + 0.25], [6, 8], [DOOR.z0, DOOR.z1], 0xf4ede4, false); // 문틀 위
  }
  // 창문 (침실, 거실)
  for (const cx of [-16.5, 7]) {
    box([cx - 2.2, cx + 2.2], [3.2, 6.4], [-6, -5.9], 0xffffff, false);
    box([cx - 2, cx + 2], [3.4, 6.2], [-5.9, -5.85], 0xbfe6f7, false);
    box([cx - 0.08, cx + 0.08], [3.4, 6.2], [-5.85, -5.8], 0xffffff, false);
  }

  // ---------- 침실 ----------
  // 침대
  box([-19.5, -13], [0, 1.2], [-5.5, -0.5], 0xe8d3b8); // 프레임
  box([-19.4, -13.1], [1.2, 1.45], [-5.4, -0.6], 0xffffff, false); // 매트리스
  box([-19.5, -13], [1.45, 1.6], [-3.9, -0.5], 0xb9cdef); // 이불 (체크 대신 연파랑)
  box([-19.4, -13.1], [1.2, 1.6], [-5.4, -3.9], 0xfdfbf7); // 매트리스 윗면 (밟는 높이 맞춤)
  box([-19.5, -13], [0, 3.2], [-6, -5.5], 0xd9bf9f); // 헤드보드
  box([-19, -16.4], [1.6, 2.0], [-5.3, -4.2], 0xffffff); // 베개
  box([-16.1, -13.5], [1.6, 2.0], [-5.3, -4.2], 0xffffff);
  // 침대 옆 책 더미 (계단)
  box([-12.9, -11.7], [0, 0.25], [-2.2, -1.0], 0xe07a6a);
  box([-12.85, -11.75], [0.25, 0.5], [-2.15, -1.05], 0x7aa6d8);
  box([-12.9, -11.7], [0.5, 0.8], [-2.2, -1.0], 0xf2c14e);
  // 옷장
  box([-11.5, -7.5], [0, 7], [-6, -4], 0xe9dccb);
  box([-9.53, -9.47], [0.3, 6.7], [-4, -3.95], 0xc9b8a2, false);
  box([-9.9, -9.7], [3.2, 4.2], [-3.95, -3.85], 0xb89b74, false); // 손잡이
  box([-9.3, -9.1], [3.2, 4.2], [-3.95, -3.85], 0xb89b74, false);
  // 화장대 + 거울 + 의자 + 바구니(계단)
  box([-21, -19.4], [0, 2.5], [1.5, 5], 0xf3e3e8);
  box([-21, -20.8], [2.5, 5.5], [2, 4.5], 0xd6c2c9, false);
  box([-20.8, -20.75], [2.7, 5.3], [2.2, 4.3], 0xd8eef7, false);
  box([-20, -19.7], [2.5, 2.9], [2.2, 2.5], 0xf6a5b8); // 화장품
  box([-20.1, -19.8], [2.5, 3.1], [3.6, 3.9], 0xa7d7c5);
  box([-18.9, -17.7], [0, 1.5], [2.7, 3.9], 0xf6c9d4); // 의자
  box([-17.6, -16.6], [0, 0.75], [2.8, 3.8], 0xd9c09a); // 바구니

  // ---------- 거실 ----------
  const rug = new THREE.Mesh(new THREE.CircleGeometry(4, 40), mat(0xf4e3c3));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-1.5, 0.01, -0.5);
  rug.receiveShadow = true;
  group.add(rug);
  // TV (왼쪽 벽 쪽, 오른쪽을 바라봄)
  box([-6.75, -5.6], [0, 1.6], [-2, 0.6], 0xc8a57e);
  box([-6.6, -6.2], [1.6, 4.2], [-1.8, 0.4], 0x3a3a44);
  box([-6.2, -6.18], [1.8, 4.0], [-1.6, 0.2], 0x4b6b8a, false);
  // 소파 (뒷벽에 붙어 앞을 바라봄) + 앞 쿠션(계단)
  box([-4.6, 1.6], [0, 1.5], [-5, -2.4], 0x8fb3a8);
  box([-4.6, 1.6], [0, 2.8], [-6, -5], 0x7fa397);
  box([-5.4, -4.6], [0, 2.1], [-6, -2.4], 0x7fa397);
  box([1.6, 2.4], [0, 2.1], [-6, -2.4], 0x7fa397);
  box([-2.2, -0.8], [0, 0.8], [-2.3, -1.0], 0xf4b183);
  // 컴퓨터 책상 두 개 + 모니터 + 의자 + 상자(계단)
  for (const [x0, x1] of [[3, 6.6], [6.8, 10.6]]) {
    box([x0, x1], [2.4, 2.6], [-6, -3.8], 0xf1ece4); // 상판
    box([x0, x0 + 0.2], [0, 2.4], [-6, -3.8], 0xd9d2c7);
    box([x1 - 0.2, x1], [0, 2.4], [-6, -3.8], 0xd9d2c7);
    const mx = (x0 + x1) / 2;
    box([mx - 0.9, mx + 0.9], [3.0, 4.2], [-5.9, -5.6], 0x2f3138); // 모니터
    box([mx - 0.8, mx + 0.8], [3.1, 4.1], [-5.6, -5.58], 0x9fd0e8, false);
    box([mx - 0.15, mx + 0.15], [2.6, 3.0], [-5.8, -5.6], 0x2f3138);
    box([mx - 0.8, mx + 0.8], [2.6, 2.65], [-4.9, -4.5], 0xdddddd, false); // 키보드
    box([mx - 0.6, mx + 0.6], [0, 1.6], [-3.4, -2.2], 0x6d7a8c); // 의자
    box([mx - 0.6, mx + 0.6], [0, 1.85], [-2.2, -1.9], 0x5d697a); // 등받이는 점프로 넘을 수 있게 낮게
  }
  box([5.5, 6.7], [0, 0.8], [-3.4, -2.2], 0xc9a27a); // 택배 상자 (계단)

  // ---------- 부엌 ----------
  box([11.5, 19.3], [0, 3], [-6, -4.4], 0xf6f1e7); // 조리대
  box([11.5, 19.3], [3, 3.15], [-6, -4.4], 0xbfb5a6, false);
  box([14, 16], [3.0, 3.2], [-5.6, -4.8], 0x9aa7b0, false); // 싱크대
  // 냉장고: 안이 빈 몸통 + 선반 + 음식, 아래 칸 문은 왼쪽 경첩으로 열림
  const FRIDGE = 0xe8eef2;
  const INSIDE = 0xf6f9fb;
  solids.push({ x0: 19.5, x1: 23, z0: -6, z1: -3.4, top: 6.5 });
  box([19.5, 23], [0, 0.3], [-6, -3.6], FRIDGE, false); // 바닥판
  box([19.5, 23], [6.2, 6.5], [-6, -3.6], FRIDGE, false); // 윗판
  box([19.5, 19.8], [0, 6.5], [-6, -3.6], FRIDGE, false); // 옆판
  box([22.7, 23], [0, 6.5], [-6, -3.6], FRIDGE, false);
  box([19.8, 22.7], [0.3, 6.2], [-6, -5.8], INSIDE, false); // 안쪽 뒷면
  box([19.8, 22.7], [3.95, 4.15], [-5.8, -3.6], FRIDGE, false); // 냉동실 칸막이
  for (const y of [1.4, 2.6]) box([19.8, 22.7], [y, y + 0.06], [-5.8, -3.7], 0xdce9ef, false); // 유리 선반
  box([20.1, 20.7], [0.3, 1.3], [-5.5, -4.9], 0xffffff, false); // 우유
  box([20.1, 20.7], [1.1, 1.3], [-5.5, -4.9], 0x7cb7e0, false);
  box([21.6, 22.4], [0.3, 0.9], [-5.6, -4.4], 0xa7d98f, false); // 채소 칸
  box([21.9, 22.5], [1.46, 1.9], [-5.6, -5.0], 0xe9f1f5, false); // 방울토마토 통
  for (const [tx, tz] of [[22.05, -5.4], [22.3, -5.2], [22.1, -5.15]]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xe8483a));
    t.position.set(tx, 1.62, tz);
    group.add(t);
  }
  box([20.3, 20.9], [1.46, 2.3], [-5.7, -5.3], 0xc0392b, false); // 소스병
  // 만두 쟁반 (가운데 선반)
  const tray = new THREE.Group();
  const trayBox = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.7), mat(0xdbe8ee));
  trayBox.castShadow = true;
  tray.add(trayBox);
  const manduGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(manduGeo, mat(0xf7eedc));
    m.name = 'mandu';
    m.scale.set(0.17, 0.13, 0.12);
    m.position.set(-0.42 + (i % 3) * 0.42, 0.04, i < 3 ? -0.16 : 0.16);
    m.castShadow = true;
    tray.add(m);
  }
  const trayHome = new THREE.Vector3(21.25, 2.7, -4.6);
  tray.position.copy(trayHome);
  group.add(tray);
  const light = new THREE.PointLight(0xffe2ad, 0, 9, 1.4);
  light.position.set(21.25, 3.4, -4.3);
  group.add(light);
  // 아래 칸은 양문: 문 한 짝이 절반 폭이라 열 때 문 앞 탑을 휩쓸지 않음
  const makeDoor = (hingeX: number, dir: 1 | -1) => {
    const door = new THREE.Group(); // 경첩 위치가 원점
    door.position.set(hingeX, 0, -3.4);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.73, 3.95, 0.2), mat(FRIDGE));
    panel.position.set(dir * 0.865, 2.0, -0.1);
    panel.castShadow = true;
    const inside = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.6, 0.05), mat(INSIDE));
    inside.position.set(dir * 0.865, 2.0, -0.22);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.3, 0.15), mat(0xaab4bb));
    handle.position.set(dir * 1.5, 3.0, 0.08);
    door.add(panel, inside, handle);
    group.add(door);
    return door;
  };
  const leftDoor = makeDoor(19.5, 1);
  const rightDoor = makeDoor(23, -1);
  const setOpen = (k: number) => {
    leftDoor.rotation.y = -1.9 * k;
    rightDoor.rotation.y = 1.9 * k;
  };
  // 위 칸(냉동실) 문은 고정
  box([19.5, 23], [4.07, 6.5], [-3.6, -3.4], FRIDGE, false);
  box([22.6, 22.8], [4.4, 5.6], [-3.4, -3.25], 0xaab4bb, false);
  box([20, 20.8], [5.4, 6.0], [-3.4, -3.38], 0xf2c14e, false); // 메모
  // 식탁 + 의자 + 계단 의자
  box([13, 18], [2.3, 2.5], [-2, 1.5], 0xd8b48a);
  for (const [lx, lz] of [[13.2, -1.8], [17.6, -1.8], [13.2, 1.1], [17.6, 1.1]]) {
    box([lx, lx + 0.2], [0, 2.3], [lz, lz + 0.2], 0xc49c70, false);
  }
  for (const cx of [14.6, 16.6]) {
    box([cx - 0.6, cx + 0.6], [0, 1.5], [-3.3, -2.1], 0xe7c9a0);
    box([cx - 0.6, cx + 0.6], [0, 1.85], [-3.6, -3.3], 0xd8b88f);
    box([cx - 0.6, cx + 0.6], [0, 1.5], [1.6, 2.8], 0xe7c9a0);
    box([cx - 0.6, cx + 0.6], [0, 1.85], [2.8, 3.1], 0xd8b88f);
  }
  box([12.8, 13.9], [0, 0.8], [-3.3, -2.1], 0xa3c4a8); // 작은 발판
  box([15.5, 16.5], [2.5, 2.9], [-0.5, 0.5], 0xffffff, false); // 접시

  // ---------- 햇빛 줄기: 침실 창문 → 침대 ----------
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffcf73, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-18.5, 6.2, -5.85), new THREE.Vector3(-14.5, 6.2, -5.85),
    new THREE.Vector3(-14.3, 1.62, -0.9), new THREE.Vector3(-18.7, 1.62, -0.9),
  ]);
  beamGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  const patchMat = beamMat.clone();
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.9), patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(-16.5, 1.615, -2.35);
  beam.visible = patch.visible = false;
  group.add(beam, patch);
  const setSunbeam = (k: number) => {
    beam.visible = patch.visible = k > 0.01;
    beamMat.opacity = 0.14 * k;
    patchMat.opacity = 0.28 * k;
  };

  const heightAt = (x: number, z: number) => {
    if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return Infinity;
    let h = 0;
    for (const s of solids) {
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.top > h) h = s.top;
    }
    return h;
  };

  return {
    group,
    heightAt,
    setSunbeam,
    fridge: { setOpen, light, tray, trayHome, front: new THREE.Vector3(21.25, 0, -2.0) },
    bed: { x0: -19.5, x1: -13, z0: -5.5, z1: -0.5, y: 1.6 },
    spawn: new THREE.Vector3(-2, 0, 4),
    zones: {
      shiba: { x0: -18.6, x1: -14, z0: -3.6, z1: -1, y: 1.6 }, // 침대 위
      ddamong: { x0: -4, x1: 1, z0: -4.6, z1: -2.9, y: 1.5 }, // 소파 위
      gamja: { x0: 7.3, x1: 10.2, z0: -5.2, z1: -4.1, y: 2.6 }, // 컴퓨터 책상 위
      ddangi: { x0: 13.4, x1: 17.6, z0: -1.6, z1: 1.1, y: 2.5 }, // 식탁 위
    },
  };
}
