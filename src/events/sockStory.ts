// 4일째 점심 전: 옷장 앞에 떨어진 양말 한 켤레 소동.
// 시바가 발견 → 땅이가 달려와 머리에 쓰고 "모자땅!" → 감자 "그건 양말이었감자" → 따몽은 구경 → 시바도 머리에
// → 감자가 땅이 머리의 양말을 발에 신어 보이고 "내꺼다!" 하고 도망 → 땅이가 쫓아감.
// 끝나고도 그날은 감자 발·시바 머리에 양말 (잘 때 벗음). 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import { meltedGeometry } from '../entities/meltStyle';
import type { Blob } from '../entities/shapeSpecs';
import type { Villager } from '../entities/villager';
import { sayer, tween, face, hop, walk, wait, heightOf, type EventContext } from './common';

const SOCK = 'sock';

/** 줄무늬 니트 양말 (세워 둔 모양: 발목이 위, 발끝이 +z) */
function createSock() {
  const W = 0xf6f3ec, R = 0xe2574c;
  const parts: Blob[] = [
    { c: [0, 0.34, 0], r: [0.12, 0.28, 0.1], color: W }, // 발목
    { c: [0, 0.6, 0], r: [0.125, 0.06, 0.105], color: R }, // 목 고무단
    { c: [0, 0.42, 0], r: [0.122, 0.03, 0.102], color: R }, // 줄무늬
    { c: [0, 0.27, 0], r: [0.122, 0.03, 0.102], color: R },
    { c: [0, 0.09, 0.2], r: [0.11, 0.08, 0.24], color: W }, // 발
    { c: [0, 0.1, -0.03], r: [0.1, 0.09, 0.09], color: R }, // 뒤꿈치
    { c: [0, 0.08, 0.41], r: [0.09, 0.07, 0.07], color: R }, // 발끝
  ];
  const mesh = new THREE.Mesh(meltedGeometry(parts, { melt: 0.04, cell: 0.018 }), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.name = SOCK;
  g.add(mesh);
  return g;
}

/** 머리 위에 모자처럼 (살짝 기울어짐) */
function wearOnHead(v: Villager, sock: THREE.Object3D, tilt: number) {
  const top = heightOf(v.char) - 0.08;
  v.char.body.attach(sock);
  sock.position.set(0, top, -0.05);
  sock.rotation.set(0, 0, tilt);
  sock.scale.setScalar(0.85);
}

/** 오른발에 신음 (감자: 발이 몸 앞쪽 아래) */
function wearOnFoot(v: Villager, sock: THREE.Object3D) {
  v.char.body.attach(sock);
  sock.position.set(0.2, 0, 0.3);
  sock.rotation.set(0, -0.3, 0);
  sock.scale.setScalar(0.7);
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
