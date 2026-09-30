// 캐릭터 설계도: 둥근 덩어리(슈퍼타원체) + 얼굴 무늬.
// 말랑 인형 스타일(plushStyle)과 복셀 스타일(voxelStyle)이 같은 설계도를 다르게 그린다.
// 좌표: y 위, +z 앞(얼굴 쪽). 겹치는 부분은 목록에서 뒤에 있는 덩어리 색이 이긴다.
import { BLACK, BLUSH, FOOT_YELLOW, type Vec3 } from './models';

export interface Blob {
  c: Vec3; // 중심
  r: Vec3; // 반지름 (x, y, z)
  color: number;
  /** 위로 갈수록 좁아지는 정도 (0 = 보통 타원, 0.2 = 아래가 20% 넓고 위가 20% 좁음) */
  taper?: number;
  /** 네모난 정도 (2 = 매끈한 타원/계란, 3 = 어깨가 빵빵한 찐빵, 클수록 네모) */
  round?: number;
}

/** 높이 y에서 가로·깊이 배율 (taper 반영) */
export function taperScale(b: Blob, y: number) {
  return 1 - (b.taper ?? 0) * (y - b.c[1]) / b.r[1];
}

const pw = (v: number, n: number) => Math.abs(v) ** n;

/** 점이 덩어리 안에 있는지 */
export function insideBlob(b: Blob, x: number, y: number, z: number) {
  const t = taperScale(b, y);
  const n = b.round ?? 2;
  return pw((x - b.c[0]) / (b.r[0] * t), n) + pw((y - b.c[1]) / b.r[1], n) + pw((z - b.c[2]) / (b.r[2] * t), n) <= 1;
}

/** 표면 점에서 바깥쪽 방향 (무늬를 표면에 맞춰 기울일 때 사용) */
export function blobNormal(b: Blob, x: number, y: number, z: number): Vec3 {
  const t = taperScale(b, y);
  const n = b.round ?? 2;
  const g = (v: number, r: number) => (Math.sign(v) * pw(v / r, n - 1)) / r;
  const v: Vec3 = [g(x - b.c[0], b.r[0] * t), g(y - b.c[1], b.r[1]), g(z - b.c[2], b.r[2] * t)];
  const len = Math.hypot(...v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** 몸 앞면에 그리는 무늬 (눈, 입, 볼 등). x, y 위치에서 가장 앞쪽 표면에 붙는다 */
export interface Mark {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export interface CharacterSpec {
  blobs: Blob[];
  marks: Mark[];
}

const pair = (x: number, make: (x: number) => Blob): Blob[] => [make(-x), make(x)];
const markPair = (x: number, y: number, w: number, h: number, color: number): Mark[] => [
  { x: -x, y, w, h, color },
  { x, y, w, h, color },
];

/** 땅이: 따뜻한 흰색 오리, 위는 좁고 아래가 넓은 종 모양, 크고 납작한 부리, 반짝이는 눈 */
const WHITE = 0xf6f5f0;
export const ddangi: CharacterSpec = {
  blobs: [
    ...pair(0.2, (x) => ({ c: [x, 0.05, 0.3], r: [0.11, 0.07, 0.13], color: FOOT_YELLOW })), // 앞으로 나온 발
    { c: [0, 0.5, 0], r: [0.43, 0.55, 0.38], color: WHITE, taper: 0.12, round: 2.7 }, // 위는 살짝 좁고 어깨가 빵빵한 몸
    ...pair(0.44, (x) => ({ c: [x, 0.42, 0], r: [0.07, 0.18, 0.16], color: WHITE })), // 몸에 붙은 날개
    { c: [0, 0.7, 0.37], r: [0.14, 0.07, 0.1], color: 0xf2b233 }, // 크고 납작한 부리
  ],
  marks: [
    ...markPair(0.16, 0.82, 0.065, 0.075, BLACK),
    ...markPair(0.145, 0.835, 0.022, 0.022, 0xffffff), // 눈 반짝이
  ],
};

/** 감자: 크림색 통 달걀 오리. 아주 작은 점 눈, 쪼끄만 부리, 배에 바느질 자국 */
const POTATO = 0xf7ead6;
export const gamja: CharacterSpec = {
  blobs: [
    ...pair(0.17, (x) => ({ c: [x, 0.05, 0.27], r: [0.1, 0.07, 0.12], color: FOOT_YELLOW })), // 앞으로 나온 발
    { c: [0, 0.47, 0], r: [0.42, 0.5, 0.36], color: POTATO, round: 2.8 }, // 머리까지 한 덩어리, 찐빵처럼 통통
    ...pair(0.42, (x) => ({ c: [x, 0.5, 0], r: [0.1, 0.12, 0.13], color: POTATO })), // 톡 튀어나온 날개
    { c: [0, 0.66, 0.34], r: [0.06, 0.045, 0.05], color: FOOT_YELLOW }, // 쪼끄만 부리
  ],
  marks: [
    ...markPair(0.15, 0.73, 0.035, 0.045, BLACK), // 점 눈
    { x: -0.24, y: 0.4, w: 0.012, h: 0.05, color: 0x6b5a4a }, // 바느질 자국 //
    { x: -0.21, y: 0.39, w: 0.012, h: 0.05, color: 0x6b5a4a },
    { x: 0.2, y: 0.22, w: 0.02, h: 0.02, color: 0x6b5a4a }, // 바느질 자국 ::
    { x: 0.23, y: 0.24, w: 0.02, h: 0.02, color: 0x6b5a4a },
  ],
};

/** 따몽: 연보라 납작 베개 모양. 위에 볼록 두 개, 어깨에 뭉툭한 팔, 아래 모서리가 퍼짐 */
const PURPLE = 0xb08ee0;
export const ddamong: CharacterSpec = {
  blobs: [
    { c: [0, 0.4, 0], r: [0.5, 0.42, 0.3], color: PURPLE, round: 2.6 }, // 몸
    ...pair(0.2, (x) => ({ c: [x, 0.62, 0], r: [0.28, 0.22, 0.26], color: PURPLE })), // 위쪽 볼록 두 개
    ...pair(0.5, (x) => ({ c: [x, 0.55, 0], r: [0.12, 0.1, 0.14], color: PURPLE })), // 어깨 팔
    ...pair(0.33, (x) => ({ c: [x, 0.13, -0.02], r: [0.23, 0.13, 0.18], color: PURPLE })), // 옆으로 퍼진 아래 모서리
  ],
  marks: [
    ...markPair(0.08, 0.62, 0.035, 0.04, BLACK), // 가까운 점 눈
    { x: 0, y: 0.55, w: 0.18, h: 0.03, color: 0xe0508a }, // 분홍 스마일
    ...markPair(0.1, 0.565, 0.03, 0.03, 0xe0508a), // 스마일 양끝 살짝 올라감
  ],
};

/** 시바: 엎드린 식빵 모양 인형. 주황 등 + 하얀 볼·배, 동그란 점 눈, 하얀 눈썹 점, 삼각 귀, 등 위 말린 꼬리 */
const ORANGE = 0xe89a3a;
const CREAM = 0xfdf8ef;
const EAR_INNER = 0xf4d9b0;
const EYE_BROWN = 0x3a2a20;
export const shiba: CharacterSpec = {
  blobs: [
    { c: [0, 0.44, -0.04], r: [0.47, 0.44, 0.5], color: ORANGE, taper: 0.08, round: 2.6 }, // 머리까지 한 덩어리, 앞뒤로 긴 식빵 몸
    { c: [0, 0.31, 0.15], r: [0.43, 0.31, 0.36], color: CREAM, round: 2.4 }, // 하얀 볼·배 (얼굴 아래 절반)
    { c: [0, 0.5, 0.42], r: [0.12, 0.08, 0.07], color: CREAM }, // 작은 주둥이
    ...pair(0.28, (x) => ({ c: [x, 0.84, 0.14], r: [0.12, 0.11, 0.07], color: ORANGE, taper: 0.45 })), // 삼각 귀
    ...pair(0.28, (x) => ({ c: [x, 0.83, 0.18], r: [0.07, 0.07, 0.04], color: EAR_INNER, taper: 0.45 })), // 귀 안쪽
    ...pair(0.2, (x) => ({ c: [x, 0.07, 0.38], r: [0.11, 0.07, 0.11], color: ORANGE })), // 앞으로 삐죽 나온 앞발
    ...pair(0.3, (x) => ({ c: [x, 0.08, -0.42], r: [0.1, 0.07, 0.1], color: ORANGE })), // 뒷발
    { c: [0, 0.64, -0.5], r: [0.13, 0.13, 0.1], color: ORANGE }, // 등 위 말린 꼬리
    { c: [0.05, 0.69, -0.56], r: [0.06, 0.06, 0.05], color: CREAM }, // 꼬리 끝
  ],
  marks: [
    ...markPair(0.15, 0.63, 0.055, 0.065, EYE_BROWN), // 동그란 점 눈
    ...markPair(0.15, 0.75, 0.075, 0.045, CREAM), // 하얀 눈썹 점
    { x: 0, y: 0.55, w: 0.075, h: 0.045, color: EYE_BROWN }, // 코
    ...markPair(0.03, 0.47, 0.045, 0.014, EYE_BROWN), // ω 입
    ...markPair(0.26, 0.36, 0.11, 0.065, BLUSH), // 하얀 볼 위 분홍 볼터치
  ],
};

// ---------- 플레이어: 통통한 사람 인형 ----------
const SKIN = 0xf7d7bd;

/** 공통 몸: 큰 머리 + 통통한 몸통 + 짧은 팔다리. 머리카락·옷은 사람마다 다르게 */
function chubbyPerson(o: { shirt: number; bottom: number; shoes: number; hair: Blob[]; extraMarks?: Mark[] }): CharacterSpec {
  return {
    blobs: [
      ...pair(0.15, (x) => ({ c: [x, 0.05, 0.06], r: [0.12, 0.07, 0.15], color: o.shoes })), // 신발
      { c: [0, 0.22, 0], r: [0.34, 0.2, 0.28], color: o.bottom, round: 2.4 }, // 바지·치마
      { c: [0, 0.42, 0], r: [0.38, 0.26, 0.31], color: o.shirt, round: 2.4 }, // 통통한 배
      ...pair(0.38, (x) => ({ c: [x, 0.42, 0.02], r: [0.09, 0.15, 0.1], color: o.shirt })), // 팔
      ...pair(0.41, (x) => ({ c: [x, 0.29, 0.04], r: [0.07, 0.07, 0.07], color: SKIN })), // 손
      { c: [0, 0.9, 0], r: [0.36, 0.33, 0.32], color: SKIN }, // 큰 머리
      ...o.hair,
    ],
    marks: [
      ...markPair(0.12, 0.88, 0.05, 0.065, BLACK), // 눈
      ...markPair(0.2, 0.8, 0.09, 0.045, BLUSH), // 볼
      { x: 0, y: 0.78, w: 0.07, h: 0.025, color: 0xc4685f }, // 입
      ...(o.extraMarks ?? []),
    ],
  };
}

/** 뚱땡이: 짧은 흑갈색 머리, 하늘색 티셔츠 */
export const ttungttaengi = chubbyPerson({
  shirt: 0x8cc0ea,
  bottom: 0x55627a,
  shoes: 0x6b4a3a,
  hair: [
    { c: [0, 1.04, -0.03], r: [0.38, 0.23, 0.34], color: 0x3b2a22 }, // 윗머리
    { c: [0, 0.94, -0.1], r: [0.37, 0.25, 0.26], color: 0x3b2a22 }, // 뒷머리
    { c: [0.06, 1.02, 0.2], r: [0.24, 0.1, 0.12], color: 0x3b2a22 }, // 앞머리
  ],
});

/** 뚱순이: 단발 갈색 머리 + 노란 머리핀, 분홍 티셔츠 */
export const ttungsuni = chubbyPerson({
  shirt: 0xf6aabd,
  bottom: 0xf3e0a8,
  shoes: 0xe07a6a,
  hair: [
    { c: [0, 1.03, -0.03], r: [0.4, 0.25, 0.35], color: 0x7a4a33 }, // 윗머리
    { c: [0, 0.86, -0.1], r: [0.4, 0.32, 0.28], color: 0x7a4a33 }, // 뒷머리 (단발)
    ...pair(0.33, (x) => ({ c: [x, 0.8, 0.02], r: [0.1, 0.2, 0.18], color: 0x7a4a33 })), // 옆머리
    { c: [0, 1.02, 0.2], r: [0.28, 0.1, 0.12], color: 0x7a4a33 }, // 앞머리
    { c: [0.24, 1.08, 0.2], r: [0.08, 0.05, 0.05], color: 0xffd23f }, // 머리핀
  ],
});

/** (x, y)에서 가장 앞쪽 표면의 z와 그 덩어리 */
export function frontSurface(blobs: Blob[], x: number, y: number) {
  let best: { z: number; blob: Blob } | null = null;
  for (const b of blobs) {
    const t = taperScale(b, y);
    const n = b.round ?? 2;
    const k = 1 - pw((x - b.c[0]) / (b.r[0] * t), n) - pw((y - b.c[1]) / b.r[1], n);
    if (k < 0) continue;
    const z = b.c[2] + b.r[2] * t * k ** (1 / n);
    if (!best || z > best.z) best = { z, blob: b };
  }
  return best;
}
