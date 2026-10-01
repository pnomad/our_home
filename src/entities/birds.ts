// 창문에 찾아오는 새 4종: 참새 · 비둘기 · 까마귀 · 까치.
// 몸은 덩어리를 녹여 붙인 한 덩어리(meltStyle), 날개는 따로 붙여서 파닥인다. +z 쪽이 앞(부리).
// 크기는 인형 키(약 30cm = 1칸) 기준 실제 비율: 참새 15cm, 비둘기 32cm, 까치 45cm, 까마귀 50cm.
import * as THREE from 'three';
import { buildMelted, meltedGeometry } from './meltStyle';
import { BLACK } from './models';
import type { Blob, CharacterSpec } from './shapeSpecs';

export type BirdKind = 'sparrow' | 'pigeon' | 'crow' | 'magpie';

export const BIRD_NAMES: Record<BirdKind, string> = { sparrow: '참새', pigeon: '비둘기', crow: '까마귀', magpie: '까치' };

interface BirdLook {
  body: number;
  breast: number;
  head: number;
  wing: number;
  tail: number;
  beak: number;
  legs: number;
  scale: number; // 몸길이 1 기준 배율
  longTail?: boolean;
  bigBeak?: boolean;
  marks?: CharacterSpec['marks'];
}

const LOOKS: Record<BirdKind, BirdLook> = {
  sparrow: {
    body: 0x9a6b45, breast: 0xe6d8c3, head: 0x7a4a2e, wing: 0x7d5536, tail: 0x6b4a33, beak: 0x3b3b3b, legs: 0xc9a08a, scale: 0.55,
    marks: [
      { x: -0.12, y: 0.6, w: 0.09, h: 0.07, color: 0xf3eee6 }, // 하얀 뺨
      { x: 0.12, y: 0.6, w: 0.09, h: 0.07, color: 0xf3eee6 },
      { x: 0, y: 0.47, w: 0.1, h: 0.08, color: 0x2a2320 }, // 검은 턱
    ],
  },
  pigeon: {
    body: 0x9aa0aa, breast: 0x8f8aa6, head: 0x8b919c, wing: 0xb6bcc6, tail: 0x6f7480, beak: 0x4a4a4a, legs: 0xd9534f, scale: 1.0,
    marks: [{ x: 0, y: 0.43, w: 0.26, h: 0.05, color: 0x7fa596 }], // 목 아래 초록빛 띠
  },
  crow: {
    body: 0x1f1f24, breast: 0x26262e, head: 0x1b1b20, wing: 0x23232b, tail: 0x1d1d24, beak: 0x15151a, legs: 0x202024, scale: 1.55, bigBeak: true,
  },
  magpie: {
    body: 0x1d1d22, breast: 0xf4f4f0, head: 0x1b1b20, wing: 0x1f2433, tail: 0x23304a, beak: 0x18181c, legs: 0x26262a, scale: 1.25, longTail: true,
  },
};

const pairX = (x: number, make: (x: number) => Blob) => [make(-x), make(x)];

function bodySpec(k: BirdKind): CharacterSpec {
  const L = LOOKS[k];
  const blobs: Blob[] = [
    ...pairX(0.07, (x) => ({ c: [x, 0.09, 0.03], r: [0.022, 0.09, 0.022], color: L.legs })), // 다리
    { c: [0, 0.34, 0], r: [0.2, 0.2, 0.3], color: L.body }, // 몸통 (앞뒤로 긴)
    { c: [0, 0.32, 0.12], r: [0.17, 0.17, 0.17], color: L.breast }, // 가슴
    { c: [0, 0.6, 0.2], r: [0.14, 0.14, 0.14], color: L.head }, // 머리
    L.longTail
      ? { c: [0, 0.36, -0.62], r: [0.07, 0.025, 0.42], color: L.tail } // 까치의 긴 꼬리
      : { c: [0, 0.33, -0.38], r: [0.09, 0.025, 0.18], color: L.tail },
    L.bigBeak
      ? { c: [0, 0.58, 0.38], r: [0.045, 0.045, 0.11], color: L.beak, taper: 0.2 }
      : { c: [0, 0.58, 0.35], r: [0.03, 0.028, 0.065], color: L.beak },
  ];
  return {
    blobs,
    marks: [
      ...(L.marks ?? []),
      { x: -0.08, y: 0.64, w: 0.045, h: 0.05, color: BLACK }, // 눈
      { x: 0.08, y: 0.64, w: 0.045, h: 0.05, color: BLACK },
      { x: -0.072, y: 0.655, w: 0.015, h: 0.015, color: 0xffffff }, // 눈 반짝
      { x: 0.088, y: 0.655, w: 0.015, h: 0.015, color: 0xffffff },
    ],
  };
}

export interface Bird {
  root: THREE.Group; // 위치·방향
  body: THREE.Group; // 콕콕·까딱 흔들기
  wings: [THREE.Object3D, THREE.Object3D];
  kind: BirdKind;
  /** 날개 펴기 정도 0~1 (0 = 접음). t 를 주면 파닥파닥 */
  flap(t: number, open: number): void;
}

const wingMat = new THREE.MeshLambertMaterial({ vertexColors: true });

export function createBird(kind: BirdKind): Bird {
  const L = LOOKS[kind];
  const c = buildMelted(bodySpec(kind), { melt: 0.05, cell: 0.02 });
  const wings: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    // 날개: 어깨가 축. 접으면 몸 옆에 붙고, 펴면 옆으로 활짝
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.44, 0.06);
    const parts: Blob[] = [{ c: [side * 0.04, -0.04, -0.12], r: [0.04, 0.12, 0.24], color: L.wing }];
    if (kind === 'magpie') parts.push({ c: [side * 0.05, -0.02, 0], r: [0.035, 0.07, 0.1], color: 0xf0f0f0 }); // 까치 날개의 흰 무늬
    const geo = meltedGeometry(parts, { melt: 0.04, cell: 0.02 });
    const mesh = new THREE.Mesh(geo, wingMat);
    mesh.castShadow = true;
    pivot.add(mesh);
    c.body.add(pivot);
    wings.push(pivot);
  }
  c.root.scale.setScalar(L.scale);
  return {
    root: c.root,
    body: c.body,
    wings: wings as [THREE.Object3D, THREE.Object3D],
    kind,
    flap(t, open) {
      const beat = open > 0 ? Math.sin(t * 28) * 0.6 * open : 0;
      wings[0].rotation.z = -(open * 1.1 + beat);
      wings[1].rotation.z = open * 1.1 + beat;
    },
  };
}

export const BIRD_KINDS: BirdKind[] = ['sparrow', 'pigeon', 'crow', 'magpie'];
