// 4일째 점심 전: 옷장 앞에 떨어진 양말 한 켤레 소동.
// 시바가 발견 → 땅이가 달려와 머리에 쓰고 "모자땅!" → 감자 "그건 양말이었감자" → 따몽은 구경 → 시바도 머리에
// → 감자가 땅이 머리의 양말을 발에 신어 보이고 "내꺼다!" 하고 도망 → 땅이가 쫓아감.
// 끝나고도 그날은 감자 발·시바 머리에 양말 (잘 때 벗음). 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import { meltedGeometry } from '../entities/meltStyle';
import type { Blob } from '../entities/shapeSpecs';
import type { Villager } from '../entities/villager';
import type { VillagerId } from '../entities/styles';
import { sayer, tween, face, hop, walk, wait, type EventContext } from './common';

const SOCK = 'sock';
const WHITE = 0xf6f3ec;
const sockMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// ---------- 1. 양말 모양: 그냥 놓인 양말 / 쓰고 신고 두른 양말 ----------
// 쓰고 있을 땐 그 자리 모양대로 늘어나고 감김 (모자 = 머리에 씌운 비니, 발 = 발을 감싼 양말, 목도리 = 몸에 한 바퀴, 귀 = 귀에 씌우고 대롱대롱)

/** 그냥 놓인 양말 (세워 둔 모양: 발목이 위, 발끝이 +z) */
function looseBlobs(R: number): Blob[] {
  return [
    { c: [0, 0.34, 0], r: [0.12, 0.28, 0.1], color: WHITE }, // 발목
    { c: [0, 0.6, 0], r: [0.125, 0.06, 0.105], color: R }, // 목 고무단
    { c: [0, 0.42, 0], r: [0.122, 0.03, 0.102], color: R }, // 줄무늬
    { c: [0, 0.27, 0], r: [0.122, 0.03, 0.102], color: R },
    { c: [0, 0.09, 0.2], r: [0.11, 0.08, 0.24], color: WHITE }, // 발
    { c: [0, 0.1, -0.03], r: [0.1, 0.09, 0.09], color: R }, // 뒤꿈치
    { c: [0, 0.08, 0.41], r: [0.09, 0.07, 0.07], color: R }, // 발끝
  ];
}

/** 인형마다 머리 꼭대기 모양 (몸 기준 좌표): 꼭대기 높이 top, 가운데 z, 둥근 머리를 타원으로 봤을 때 높이 h · 반지름 rx, rz,
 *  모자를 눈 위까지만 내려 쓰는 깊이 deep */
const HEADS: Record<VillagerId, { top: number; z: number; h: number; rx: number; rz: number; deep: number }> = {
  ddangi: { top: 1.05, z: 0, h: 0.3, rx: 0.37, rz: 0.33, deep: 0.13 }, // 눈 y 0.82
  gamja: { top: 0.97, z: 0, h: 0.3, rx: 0.4, rz: 0.35, deep: 0.14 },
  ddamong: { top: 0.84, z: 0, h: 0.25, rx: 0.5, rz: 0.27, deep: 0.12 },
  shiba: { top: 0.8, z: 0.15, h: 0.2, rx: 0.3, rz: 0.28, deep: 0.12 }, // 두 귀 사이
};

/** 머리에 쓴 양말 = 비니: 머리 꼭대기를 감싸는 껍질 + 고무단 + 옆으로 털썩 넘어간 발 부분 */
function hatBlobs(id: VillagerId, R: number, side: number): Blob[] {
  const H = HEADS[id];
  const ring = (d: number) => H.rx * Math.sqrt(Math.max(0, 1 - ((H.h - d) / H.h) ** 2)); // 꼭대기에서 d 아래 머리 반지름
  const ry = (d: number) => H.rz * (ring(d) / H.rx);
  const D = H.deep;
  const blobs: Blob[] = [
    { c: [0, H.top - D * 0.5, H.z], r: [ring(D * 0.6) + 0.07, D * 0.5 + 0.1, ry(D * 0.6) + 0.07], color: WHITE }, // 머리를 감싼 볼록한 몸통
    { c: [0, H.top - D * 0.5, H.z], r: [ring(D * 0.6) + 0.08, 0.022, ry(D * 0.6) + 0.08], color: R }, // 줄무늬
    { c: [0, H.top - D, H.z], r: [ring(D) + 0.065, 0.04, ry(D) + 0.065], color: R }, // 고무단 (눈 위)
  ];
  // 남는 발 부분이 꼭대기에서 옆으로 털썩
  const x = side;
  blobs.push(
    { c: [0.08 * x, H.top + 0.08, H.z], r: [0.11, 0.1, 0.1], color: WHITE },
    { c: [0.22 * x, H.top + 0.13, H.z], r: [0.1, 0.09, 0.09], color: R }, // 뒤꿈치
    { c: [0.34 * x, H.top + 0.06, H.z], r: [0.09, 0.09, 0.085], color: WHITE },
    { c: [0.4 * x, H.top - 0.06, H.z], r: [0.08, 0.08, 0.075], color: R }, // 발끝
  );
  return blobs;
}

/** 감자 발을 감싼 양말 (발은 몸 앞쪽 아래 x ±0.17, z 0.27) */
function footBlobs(R: number, side: number): Blob[] {
  const x = 0.17 * side;
  return [
    { c: [x, 0.065, 0.27], r: [0.125, 0.09, 0.15], color: WHITE }, // 발등
    { c: [x, 0.065, 0.39], r: [0.105, 0.075, 0.065], color: R }, // 발끝
    { c: [x, 0.08, 0.14], r: [0.11, 0.085, 0.07], color: R }, // 뒤꿈치
    { c: [x, 0.17, 0.2], r: [0.11, 0.08, 0.09], color: WHITE }, // 짧게 올라온 발목
    { c: [x, 0.24, 0.19], r: [0.115, 0.035, 0.1], color: R }, // 고무단
  ];
}

/** 몸에 한 바퀴 두른 목도리 + 앞 오른쪽으로 늘어진 끝 (따몽: 스마일 아래 y 0.42) */
function scarfBlobs(R: number): Blob[] {
  const y = 0.42, rx = 0.53, rz = 0.33, n = 36;
  const blobs: Blob[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    blobs.push({ c: [Math.cos(a) * rx, y + Math.sin(a * 2) * 0.01, Math.sin(a) * rz], r: [0.08, 0.075, 0.08], color: i % 6 < 1 ? R : WHITE }); // 촘촘히 겹쳐서 한 줄 니트 관
  }
  // 매듭과 늘어진 끝 (발 부분)
  const fx = Math.cos(0.9) * rx, fz = Math.sin(0.9) * rz + 0.05;
  blobs.push(
    { c: [fx, y - 0.02, fz], r: [0.1, 0.09, 0.09], color: WHITE },
    { c: [fx + 0.03, y - 0.13, fz + 0.03], r: [0.08, 0.08, 0.075], color: R }, // 뒤꿈치
    { c: [fx + 0.05, y - 0.24, fz + 0.05], r: [0.075, 0.08, 0.07], color: WHITE },
    { c: [fx + 0.06, y - 0.33, fz + 0.07], r: [0.07, 0.06, 0.065], color: R }, // 발끝
  );
  return blobs;
}

/** 시바 오른쪽 귀에 씌우고 나머지는 얼굴 옆으로 대롱대롱 (귀 끝 x 0.29, y 0.86, z 0.17) */
function earBlobs(R: number): Blob[] {
  return [
    { c: [0.29, 0.83, 0.17], r: [0.11, 0.1, 0.09], color: WHITE }, // 귀를 덮은 발 부분
    { c: [0.29, 0.92, 0.17], r: [0.07, 0.05, 0.06], color: R }, // 발끝이 귀 끝에
    { c: [0.4, 0.78, 0.2], r: [0.09, 0.085, 0.08], color: R }, // 뒤꿈치
    { c: [0.49, 0.67, 0.22], r: [0.085, 0.09, 0.075], color: WHITE },
    { c: [0.52, 0.55, 0.24], r: [0.08, 0.08, 0.07], color: WHITE },
    { c: [0.53, 0.45, 0.25], r: [0.085, 0.04, 0.075], color: R }, // 고무단
  ];
}

function setShape(sock: THREE.Object3D, blobs: Blob[]) {
  const mesh = sock.children[0] as THREE.Mesh;
  mesh.geometry.dispose();
  mesh.geometry = meltedGeometry(blobs, { melt: 0.04, cell: 0.018 });
}

/** 줄무늬 니트 양말. stripe 로 줄무늬 색을 바꿈 */
export function createSock(stripe = 0xe2574c) {
  const mesh = new THREE.Mesh(meltedGeometry(looseBlobs(stripe), { melt: 0.04, cell: 0.018 }), sockMat);
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.name = SOCK;
  g.userData.stripe = stripe;
  g.add(mesh);
  return g;
}

/** 쓰고 있던 양말을 벗겨 원래 모양으로 (쓰던 자리에 작게) */
function loosen(sock: THREE.Object3D) {
  if (!sock.userData.worn) return;
  sock.userData.worn = false;
  setShape(sock, looseBlobs(sock.userData.stripe));
  sock.position.copy(sock.userData.anchor);
  sock.rotation.set(0, 0, 0);
  sock.scale.setScalar(0.6);
}

/** 양말을 parent 의 (pos, rot, scale) 자리로 (모양은 그냥 양말). sec > 0 이면 휙 날아가듯 옮김 */
export async function putSock(sock: THREE.Object3D, parent: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler, scale: number, sec = 0) {
  loosen(sock);
  parent.attach(sock);
  const q1 = new THREE.Quaternion().setFromEuler(rot);
  if (sec <= 0) {
    sock.position.copy(pos);
    sock.quaternion.copy(q1);
    sock.scale.setScalar(scale);
    return;
  }
  const p0 = sock.position.clone(), q0 = sock.quaternion.clone(), s0 = sock.scale.x;
  await tween(sec, (k) => {
    sock.position.lerpVectors(p0, pos, k);
    sock.position.y += Math.sin(k * Math.PI) * 0.5;
    sock.quaternion.slerpQuaternions(q0, q1, k);
    sock.scale.setScalar(s0 + (scale - s0) * k);
  });
}

/** 인형 몸에 입힘: anchor 까지 날아간 뒤 그 자리 모양(blobs, 몸 기준 좌표)으로 바뀜 */
async function wear(v: Villager, sock: THREE.Object3D, anchor: THREE.Vector3, blobs: Blob[], sec: number) {
  if (sec > 0) await putSock(sock, v.char.body, anchor, new THREE.Euler(), 0.6, sec);
  else loosen(sock);
  v.char.body.attach(sock);
  setShape(sock, blobs);
  sock.position.set(0, 0, 0);
  sock.rotation.set(0, 0, 0);
  sock.scale.setScalar(1);
  sock.userData.worn = true;
  sock.userData.anchor = anchor;
}

/** 머리에 모자처럼 (tilt 의 부호 쪽으로 발 부분이 털썩) */
export function wearOnHead(v: Villager, sock: THREE.Object3D, tilt: number, sec = 0) {
  const id = v.info.id;
  const anchor = new THREE.Vector3(0, HEADS[id].top, HEADS[id].z);
  return wear(v, sock, anchor, hatBlobs(id, sock.userData.stripe, tilt >= 0 ? -1 : 1), sec);
}

/** 머리 위에 양말 탑 쌓기 (들고 다닐 때, i 번째 층) */
export function carryOnHead(v: Villager, sock: THREE.Object3D, i: number) {
  const top = HEADS[v.info.id].top;
  return putSock(sock, v.char.body, new THREE.Vector3(-0.2, top + 0.05 + i * 0.2, -0.25), new THREE.Euler(0, i * 0.9, Math.PI / 2), 0.8);
}

/** 발에 신음 (감자). side 1 = 오른발, -1 = 왼발 */
export function wearOnFoot(v: Villager, sock: THREE.Object3D, side = 1, sec = 0) {
  return wear(v, sock, new THREE.Vector3(0.17 * side, 0.1, 0.27), footBlobs(sock.userData.stripe, side), sec);
}

/** 오른쪽 귀에 씌우고 대롱대롱 (시바) */
export function wearOnEar(v: Villager, sock: THREE.Object3D, sec = 0) {
  return wear(v, sock, new THREE.Vector3(0.35, 0.8, 0.2), earBlobs(sock.userData.stripe), sec);
}

/** 목도리처럼 몸에 한 바퀴 (따몽) */
export function wearAsScarf(v: Villager, sock: THREE.Object3D, sec = 0) {
  return wear(v, sock, new THREE.Vector3(0, 0.42, 0.4), scarfBlobs(sock.userData.stripe), sec);
}

/** 잘 때 양말 벗기 */
export function takeOffSocks(villagers: Villager[]) {
  for (const v of villagers) {
    for (let s = v.char.body.getObjectByName(SOCK); s; s = v.char.body.getObjectByName(SOCK)) s.removeFromParent();
  }
}

export async function runSockStory(ctx: EventContext) {
  const { villagers: V, fade, house } = ctx;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);

  // ---------- 1. 다들 침실을 돌아다니는 중, 옷장 앞엔 양말 한 켤레 ----------
  await fade.out('4일째 · 점심 전');
  await wait(0.8);
  for (const v of all) v.setScripted(true);
  const socks = [createSock(), createSock()];
  socks[0].position.set(-9.9, 0.1, -2.9);
  socks[0].rotation.set(0, 0.4, Math.PI / 2); // 옆으로 누워 있음
  socks[1].position.set(-9.0, 0.1, -2.5);
  socks[1].rotation.set(0, -0.8, Math.PI / 2);
  for (const s of socks) house.group.add(s);
  const start: [Villager, number, number][] = [
    [V.shiba, -13.2, 1.2], [V.ddangi, -15.8, 3.4], [V.gamja, -11.2, 4.4], [V.ddamong, -14.2, 4.8],
  ];
  for (const [v, x, z] of start) {
    v.char.root.position.set(x, 0, z);
    v.char.root.rotation.set(0, Math.random() * Math.PI * 2, 0);
  }
  ctx.setNameTags(true);
  ctx.setCamera(new THREE.Vector3(-10.8, 0.6, -0.9), 0.6, true);
  await wait(0.4);
  fade.setText('');
  await fade.in();
  // 어슬렁어슬렁
  await Promise.all([
    walk(V.ddangi, new THREE.Vector3(-14.2, 0, 2.6), 1.4),
    walk(V.gamja, new THREE.Vector3(-12, 0, 3.2), 1.0),
    walk(V.ddamong, new THREE.Vector3(-13.2, 0, 4.2), 0.7),
    walk(V.shiba, new THREE.Vector3(-10.2, 0, -1.9), 1.2),
  ]);

  // ---------- 2. 시바가 양말 발견 ----------
  const shiba = V.shiba.char.root;
  face(shiba, socks[0].position);
  await say(V.shiba, '킁킁… 뭔일이래?', '옷장 앞에 뭐가 떨어져 있었씨바!');
  // 땅이가 달려옴
  V.ddangi.say('뭐 찾았땅?!', 1.6);
  await walk(V.ddangi, new THREE.Vector3(-8.6, 0, -1.7), 3.2);
  face(V.ddangi.char.root, socks[1].position);
  await say(V.ddangi, '뭐 찾았땅?! 나도 봤땅!');

  // ---------- 3. 시바는 관찰, 땅이는 모자 ----------
  // 시바: 양말 둘레를 빙 돌며 킁킁
  const c0 = socks[0].position.clone().setY(0);
  await tween(2.2, (k) => {
    const a = -Math.PI / 2 + k * Math.PI * 1.2;
    shiba.position.set(c0.x + Math.cos(a) * 0.9, 0, c0.z + Math.sin(a) * 0.9 + 0.2);
    face(shiba, c0);
    V.shiba.char.body.rotation.x = Math.abs(Math.sin(k * Math.PI * 6)) * 0.15;
  });
  V.shiba.char.body.rotation.x = 0;
  await say(V.shiba, '말랑말랑했씨바…', '…냄새는 별로였씨바.');
  // 땅이: 양말을 집어 머리 위에
  const ddangi = V.ddangi.char.root;
  await hop(ddangi, ddangi.position.clone(), 0.4, 0.5);
  wearOnHead(V.ddangi, socks[1], 0.35);
  ddangi.rotation.y = 0; // 카메라를 보고 자랑
  await say(V.ddangi, '짠! 이건 모자땅!', '대장 모자땅! 멋있지땅?');

  // ---------- 4. 감자의 설명, 따몽은 구경 ----------
  await Promise.all([
    walk(V.gamja, new THREE.Vector3(-10.6, 0, -0.9), 1.6),
    walk(V.ddamong, new THREE.Vector3(-12.3, 0, -0.6), 0.8),
  ]);
  face(V.gamja.char.root, ddangi.position);
  face(V.ddamong.char.root, ddangi.position);
  await say(V.gamja, '아니에오! 그건 모자가 아니었감자.', '양말이었감자. 발에 신는 거였감자. 책에서 봤감자!');
  await say(V.ddamong, '…나는 발이 없는데….');
  // 시바도 남은 양말을 머리에
  await hop(shiba, shiba.position.clone(), 0.4, 0.5);
  wearOnHead(V.shiba, socks[0], -0.3);
  shiba.rotation.y = 0;
  await say(V.shiba, '나도 모자씨바! 따뜻했씨바~');

  // ---------- 5. 감자가 땅이 머리의 양말을 발에 → "내꺼다!" → 도망, 땅이 추격 ----------
  const gamja = V.gamja.char.root;
  await walk(V.gamja, ddangi.position.clone().add(new THREE.Vector3(-0.8, 0, 0.2)), 1.6);
  face(gamja, ddangi.position);
  await hop(gamja, gamja.position.clone(), 0.35, 0.6);
  wearOnFoot(V.gamja, socks[1]);
  gamja.rotation.y = 0;
  await say(V.gamja, '이렇게 발에 신는 거였감자!', '봤감자? 딱 맞았감자!');
  await say(V.ddangi, '…어? 내 모자땅?!');
  await say(V.gamja, '내꺼다!');
  const run = walk(V.gamja, new THREE.Vector3(-6.0, 0, 2.8), 3.6).then(() => walk(V.gamja, new THREE.Vector3(-2.4, 0, 1.4), 3.6));
  await wait(0.5);
  V.ddangi.say('거기 서땅!!', 2);
  const chase = walk(V.ddangi, new THREE.Vector3(-6.8, 0, 2.7), 3.4).then(() => walk(V.ddangi, new THREE.Vector3(-3.6, 0, 1.6), 3.4));
  ctx.setCamera(new THREE.Vector3(-4.6, 0.6, 0.2), 0.72); // 거실로 도망가는 쪽
  await say(V.ddangi, '거기 서땅!! 내 모자 돌려줬땅!!');
  await Promise.all([run, chase]);
  await say(V.shiba, '…뭔일이래?', '(모자는 계속 쓰고 있었씨바)');
  await say(V.ddamong, '다들 뛰지 마따몽… 넘어졌따몽…');
  await say(null, '그날 점심 전까지 집 안은 시끌벅적했다…');

  // ---------- 6. 다시 평소대로 (양말은 그대로) ----------
  for (const v of all) v.setScripted(false);
  ctx.setCamera(null);
}
