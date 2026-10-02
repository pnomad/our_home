// 4일째 오후: 양말 소동 이어서.
//   짝 잃은 양말 (점심 먹고): 소파에 뻗은 감자·땅이 → 감자 책 "양말은 두 짝이 한 켤레였감자!"
//     → 침대에서 빠삭 낮잠 자는 시바 머리에 나머지 한 짝 → 땅이 몰래 작전 → 따몽이 이불 덮어 주고 중재
//     → 감자 두 짝 다 신고 거실 행진, 땅이 "나도 신고 싶었땅…"
//   양말 패션쇼 (해 질 녘): 땅이가 옷장 서랍에서 양말을 잔뜩 꺼내 옴 → 라디오 켜고 테이블 앞 런웨이
//     → 감자(발) · 시바(귀) · 따몽(목도리) · 땅이(모자) → "누가 제일 멋있었땅?" 고르면 그 인형이 기뻐함
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import type { Villager } from '../entities/villager';
import type { VillagerId } from '../entities/styles';
import { sayer, tween, face, hop, walk, wait, type EventContext } from './common';
import { createSock, takeOffSocks, wearOnHead, wearOnFoot, wearOnEar, wearAsScarf, carryOnHead } from './sockStory';

const BED_Y = 1.6;
const SOFA_Y = 1.5;

/** 걸으면서 콩콩 뛰기 (신나서 행진) */
async function bounce(v: Villager, to: THREE.Vector3, speed = 1.6, height = 0.25) {
  const obj = v.char.root;
  face(obj, to);
  const from = obj.position.clone();
  const sec = from.distanceTo(to) / speed;
  v.walking = true;
  await tween(sec, (k) => {
    obj.position.lerpVectors(from, to, k);
    obj.position.y += Math.abs(Math.sin(k * sec * Math.PI * 2.2)) * height;
  }, (k) => k);
  obj.position.copy(to);
  v.walking = false;
}

/** 살금살금 (몸을 낮추고 천천히) */
async function sneak(v: Villager, to: THREE.Vector3) {
  v.char.body.scale.y = 0.85;
  await walk(v, to, 0.5);
  v.char.body.scale.y = 1;
}

/** 감자 발에 양말 두 짝 (이야기 시작할 때 상태 맞추기) */
function gamjaBothFeet(gamja: Villager) {
  const pair = [createSock(), createSock()];
  wearOnFoot(gamja, pair[0], 1);
  wearOnFoot(gamja, pair[1], -1);
}

// ==================== 짝 잃은 양말 ====================

export async function runSockPair(ctx: EventContext) {
  const { villagers: V, fade, house } = ctx;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);

  // ---------- 1. 쫓고 쫓기다 소파에 뻗은 감자 · 땅이 ----------
  await fade.out('4일째 · 점심 먹고');
  await wait(0.8);
  for (const v of all) v.setScripted(true);
  takeOffSocks(all);
  // 아침 소동 그대로: 감자 오른발 · 시바 머리에 한 짝씩
  const footSock = createSock();
  wearOnFoot(V.gamja, footSock, 1);
  const hatSock = createSock();
  wearOnHead(V.shiba, hatSock, -0.3);
  const lie = (v: Villager, x: number, y: number, z: number, pose: 'lieBack' | 'lieSide') => {
    v.char.root.position.set(x, y, z);
    v.char.root.rotation.set(0, 0, 0);
    v.setPose(pose);
  };
  lie(V.gamja, -0.9, SOFA_Y, -3.7, 'lieBack');
  lie(V.ddangi, -2.9, SOFA_Y, -3.7, 'lieBack');
  lie(V.shiba, -16.2, BED_Y, -2.7, 'lieSide'); // 침대에서 빠삭 낮잠
  V.shiba.zzz.visible = true;
  V.ddamong.char.root.position.set(-10.2, 0, 2.6); // 침실 구석
  ctx.setNameTags(true);
  ctx.setCamera(new THREE.Vector3(-1.7, 1.2, -2.4), 0.55, true);
  await wait(0.4);
  await fade.in();
  await say(V.gamja, '헥… 헥… 한 짝만 신으니까 기우뚱했감자…');
  await say(V.ddangi, '헥헥… 감자 너무 빨랐땅…', '…내 모자 돌려줬땅…');

  // ---------- 2. 감자가 책을 찾아봄 ----------
  V.gamja.setPose('stand');
  V.gamja.char.root.position.set(-0.9, SOFA_Y, -3.4);
  await hop(V.gamja.char.root, new THREE.Vector3(-0.2, SOFA_Y, -3.4), 0.4, 0.4);
  const book = house.books.items[house.books.items.length - 1];
  const bookHome = { parent: book.parent!, pos: book.position.clone(), rot: book.rotation.clone() };
  V.gamja.char.body.attach(book);
  book.position.set(0, 0.45, 0.42);
  book.rotation.set(-1.1, 0, 0);
  V.gamja.char.root.rotation.y = 0;
  // 팔락팔락
  await tween(1.4, (k) => (book.rotation.z = Math.sin(k * Math.PI * 6) * 0.12));
  await say(V.gamja, '팔락팔락… 찾았감자!', '양말은 원래 두 짝이 한 켤레였감자!', '한 짝은 내 발에 있었감자. 그럼 나머지 한 짝은…');
  V.ddangi.setPose('stand');
  V.ddangi.char.root.position.set(-2.9, SOFA_Y, -3.4);
  V.ddangi.char.root.rotation.y = 0;
  await hop(V.ddangi.char.root, V.ddangi.char.root.position.clone(), 0.4, 0.5);
  await say(V.ddangi, '시바 머리 위에 있었땅!!');
  bookHome.parent.attach(book);
  book.position.copy(bookHome.pos);
  book.rotation.copy(bookHome.rot);

  // ---------- 3. 침대 위 시바: "모자 벗으면 추웠씨바…" ----------
  await fade.out();
  V.gamja.char.root.position.set(-12.2, 0, -0.1);
  V.ddangi.char.root.position.set(-12.1, 0, 0.8);
  ctx.setCamera(new THREE.Vector3(-15.0, 1.2, -1.6), 0.58, true);
  await wait(0.5);
  await fade.in();
  await hop(V.ddangi.char.root, new THREE.Vector3(-14.4, BED_Y, -1.0), 0.55, 0.8);
  await hop(V.gamja.char.root, new THREE.Vector3(-13.5, BED_Y, -1.2), 0.55, 0.8);
  face(V.ddangi.char.root, V.shiba.char.root.position);
  face(V.gamja.char.root, V.shiba.char.root.position);
  await say(V.ddangi, '시바! 그 모자 돌려줬땅!');
  await say(V.gamja, '모자 아니었감자. 양말이었감자…');
  V.shiba.zzz.visible = false;
  await tween(0.8, (k) => (V.shiba.char.body.rotation.x = Math.sin(k * Math.PI) * 0.2));
  await say(V.shiba, '…싫었씨바.', '모자 벗으면 추웠씨바…');
  V.shiba.zzz.visible = true;
  await say(V.shiba, '쿨… 쿨…');

  // ---------- 4. 땅이의 작전: 잠들면 몰래 ----------
  await say(V.ddangi, '(소곤소곤) 작전이 있었땅.', '시바 잠들면 몰래 가져오땅!');
  await say(V.gamja, '(소곤소곤) …마다오였감자.');
  await Promise.all([
    sneak(V.ddangi, new THREE.Vector3(-15.3, BED_Y, -1.9)),
    sneak(V.gamja, new THREE.Vector3(-14.3, BED_Y, -1.8)),
  ]);
  // 뒤척 → 얼음!
  V.shiba.zzz.visible = false;
  await tween(0.7, (k) => (V.shiba.char.body.rotation.z = Math.PI / 2 + Math.sin(k * Math.PI * 2) * 0.2));
  V.shiba.char.body.rotation.z = Math.PI / 2;
  await say(V.shiba, '…으응? 누구였씨바?');
  await say(V.ddangi, '(얼음!)');
  await say(V.gamja, '(얼음이었감자…!)');

  // ---------- 5. 따몽 형아가 중재: 이불 덮어 주고 양말 돌려받기 ----------
  await walk(V.ddamong, new THREE.Vector3(-12.4, 0, 0.4), 1.4);
  await hop(V.ddamong.char.root, new THREE.Vector3(-14.0, BED_Y, -0.9), 0.6, 0.8);
  await walk(V.ddamong, new THREE.Vector3(-17.5, BED_Y, -1.2), 1.0);
  await walk(V.ddamong, new THREE.Vector3(-17.5, BED_Y, -3.3), 1.0); // 시바 뒤쪽 (시바가 형아한테 기대게)
  face(V.ddamong.char.root, V.shiba.char.root.position);
  await say(V.ddamong, '다들 뭐 했따몽?', '…시바가 추웠던 거였따몽.');
  // 이불을 덮어 줌
  const blanket = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf7d98b }));
  blanket.castShadow = true;
  blanket.receiveShadow = true;
  const shibaAt = V.shiba.char.root.position;
  const over = new THREE.Vector3(shibaAt.x, BED_Y, shibaAt.z - 0.35); // 얼굴은 내놓고
  const from = V.ddamong.char.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  blanket.position.copy(from);
  const FULL = new THREE.Vector3(1.15, 0.8, 0.85); // 시바를 덮는 볼록한 이불
  blanket.scale.copy(FULL).multiplyScalar(0.3);
  house.group.add(blanket);
  await tween(0.8, (k) => {
    blanket.position.lerpVectors(from, over, k);
    blanket.position.y += Math.sin(k * Math.PI) * 0.6;
    blanket.scale.copy(FULL).multiplyScalar(0.3 + 0.7 * k);
  });
  await say(V.ddamong, '시바한테는 형아가 이불 덮어줬따몽.', '이제 안 추웠따몽? 그러니까 양말은 감자 돌려줬따몽.');
  await say(V.shiba, '…따뜻했씨바.', '…줬씨바.');
  // 시바 머리 → 감자 왼발
  await wearOnFoot(V.gamja, hatSock, -1, 0.9);
  await say(V.gamja, '고마웠감자! 시바도, 따몽 형아도!');
  // 시바는 따몽 형아 옆으로 꼬물꼬물 → 말랑한 배에 기대어 다시 쿨쿨
  const lean = new THREE.Vector3(-16.9, BED_Y, -2.4);
  const s0 = shibaAt.clone();
  await tween(1.2, (k) => {
    shibaAt.lerpVectors(s0, lean, k);
    blanket.position.set(shibaAt.x, BED_Y, shibaAt.z - 0.35);
  });
  V.shiba.zzz.visible = true;
  await say(V.shiba, '형아 배 말랑말랑했씨바… 쿨…');
  await say(V.ddamong, '…움직일 수 없게 됐따몽.', '(그래도 좋았따몽)');

  // ---------- 6. 한 켤레 완성! 감자의 거실 행진 ----------
  await fade.out();
  blanket.removeFromParent();
  V.gamja.char.root.position.set(-3.4, 0, 1.0);
  V.ddangi.char.root.position.set(-1.5, 0.8, -1.6); // 소파 앞 쿠션에 걸터앉음
  V.ddangi.char.root.rotation.set(0, 0, 0);
  ctx.setCamera(new THREE.Vector3(-1.2, 0.7, 0.0), 0.62, true);
  await wait(0.5);
  await fade.in();
  const loop = [new THREE.Vector3(-1.2, 0, 2.0), new THREE.Vector3(1.6, 0, 1.4), new THREE.Vector3(-0.2, 0, 0.8)];
  V.gamja.say('한 켤레 완성이었감자!', 3);
  for (const p of loop) await bounce(V.gamja, p, 1.8);
  V.gamja.char.root.rotation.y = 0;
  await say(V.gamja, '한 켤레 완성이었감자!', '이제 하나도 안 기우뚱했감자~');
  face(V.ddangi.char.root, V.gamja.char.root.position);
  await say(V.ddangi, '…나도 신고 싶었땅…');
  await say(V.gamja, '…이건 한 켤레라서 못 나눴감자.');
  await tween(1.0, (k) => (V.ddangi.char.body.rotation.z = Math.sin(k * Math.PI * 3) * 0.15));
  V.ddangi.char.body.rotation.z = 0;
  await say(V.ddangi, '…! 옷장에 양말 더 있었땅?!', '저녁에 다 보여줬땅! 기다렸땅!');
  await say(null, '땅이는 무언가 꾸미는 얼굴로 침실로 달려갔다…');

  // ---------- 7. 평소대로 (감자 양말 두 짝은 그대로) ----------
  for (const v of all) v.setScripted(false);
  ctx.setCamera(null);
}

// ==================== 양말 패션쇼 ====================

const RUNWAY_Z = 2.4;
const STAGE = new THREE.Vector3(-0.4, 0, RUNWAY_Z);
/** 다 걷고 나서 서는 자리 (테이블 앞, 이름표가 안 겹치게) */
const FINALE: Record<VillagerId, THREE.Vector3> = {
  gamja: new THREE.Vector3(-3.0, 0, 1.4),
  shiba: new THREE.Vector3(-1.2, 0, 1.6),
  ddamong: new THREE.Vector3(0.6, 0, 1.4),
  ddangi: new THREE.Vector3(2.2, 0, 1.4),
};

export async function runSockFashion(ctx: EventContext) {
  const { villagers: V, fade, player } = ctx;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);

  // ---------- 1. 땅이가 양말을 잔뜩 들고 옴 ----------
  await fade.out('4일째 · 해 질 녘');
  await wait(0.8);
  for (const v of all) v.setScripted(true);
  takeOffSocks(all);
  gamjaBothFeet(V.gamja);
  V.gamja.char.root.position.set(-3.0, 0, 0.4);
  V.shiba.char.root.position.set(-1.6, 0, 0.6);
  V.ddamong.char.root.position.set(-0.2, 0, 0.4);
  V.ddangi.char.root.position.set(-7.4, 0, 2.8);
  for (const v of [V.gamja, V.shiba, V.ddamong]) face(v.char.root, V.ddangi.char.root.position);
  player.root.position.set(-4.8, 0, 3.6);
  face(player.root, STAGE);
  // 땅이 머리 위에 양말 탑 (파랑 · 노랑 · 초록)
  const extra = [createSock(0x5b8fc9), createSock(0xf2c14e), createSock(0x6fbf73)];
  extra.forEach((s, i) => carryOnHead(V.ddangi, s, i));
  ctx.setNameTags(true);
  ctx.setCamera(new THREE.Vector3(-1.6, 0.7, 1.6), 0.66, true);
  await wait(0.4);
  await fade.in();
  V.ddangi.say('다들 모였땅?!', 1.6);
  await bounce(V.ddangi, new THREE.Vector3(-4.2, 0, 1.6), 2.4, 0.2);
  V.ddangi.char.root.rotation.y = 0;
  await say(V.ddangi, '짠!! 옷장 서랍에 양말이 더 있었땅!!');
  await say(V.gamja, '…양말이 이렇게 많았감자?');
  await say(V.ddamong, '서랍은 닫고 왔따몽?');
  await say(V.ddangi, '…대장이 나중에 닫았땅!');

  // ---------- 2. 하나씩 나눠 줌: 시바 귀 · 따몽 목도리 · 땅이 모자 ----------
  await wearOnEar(V.shiba, extra[0], 0.8);
  V.shiba.char.root.rotation.y = 0;
  await say(V.shiba, '귀에 걸었씨바… 대롱대롱했씨바.');
  face(V.ddamong.char.root, V.ddangi.char.root.position);
  await say(V.ddamong, '…형아는 발이 없었따몽.');
  await say(V.ddangi, '형아는 여기땅!');
  await wearAsScarf(V.ddamong, extra[1], 0.8);
  V.ddamong.char.root.rotation.y = 0;
  await say(V.ddamong, '…!', '목에 두르니까 목도리였따몽!', '발이 없어도 양말 할 수 있었따몽~');
  await wearOnHead(V.ddangi, extra[2], 0.35, 0.5);

  // ---------- 3. 라디오 켜고 "양말 패션쇼땅!" ----------
  await walk(V.ddangi, new THREE.Vector3(1.6, 0, 1.0), 2.4);
  await hop(V.ddangi.char.root, new THREE.Vector3(0.8, 1.2, -0.2), 0.55, 0.8);
  V.ddangi.char.root.rotation.y = 0;
  ctx.setRadio?.(true);
  await wait(0.4);
  await say(V.ddangi, '양말 패션쇼땅!!', '한 명씩 여기 걸어왔땅! 대장은 맨 마지막이땅!');
  await hop(V.ddangi.char.root, new THREE.Vector3(1.6, 0, 1.0), 0.55, 0.6);
  // 다들 무대 뒤(왼쪽)로
  await Promise.all([V.gamja, V.shiba, V.ddamong, V.ddangi].map((v, i) => walk(v, new THREE.Vector3(-5.0 + (i % 2) * 0.5, 0, 0.0 + i * 0.6), 2.4)));

  // ---------- 4. 런웨이 ----------
  const show = async (v: Villager, ...lines: string[]) => {
    await walk(v, new THREE.Vector3(-4.2, 0, RUNWAY_Z), 2.0);
    await bounce(v, STAGE, 1.6, 0.15);
    await hop(v.char.root, STAGE, 0.6, 0.6, Math.PI * 2 - v.char.root.rotation.y); // 빙글 돌아 카메라 쪽
    v.char.root.rotation.y = 0;
    await say(v, ...lines);
    await bounce(v, new THREE.Vector3(3.2, 0, RUNWAY_Z), 1.8, 0.15);
    await walk(v, FINALE[v.info.id], 2.0);
    v.char.root.rotation.y = 0;
  };
  ctx.setCamera(new THREE.Vector3(-0.4, 0.7, 3.0), 0.6); // 대화창에 안 가리게 런웨이를 화면 가운데로
  await say(null, '♪ 둠칫 둠칫 — 양말 패션쇼가 시작됐다!');
  await show(V.gamja, '첫 번째는 감자였감자.', '양말은 발에! 기본이 제일 멋있었감자.');
  await show(V.shiba, '…시바였씨바.', '귀걸이 양말이었씨바. 한쪽 귀만 무거웠씨바…');
  await show(V.ddamong, '따몽이었따몽!', '목도리 양말이었따몽. 따뜻했따몽~');
  await show(V.ddangi, '마지막은 대장이땅!!', '대장 모자땅! 오늘의 주인공이땅!');

  // ---------- 5. 누가 제일 멋있었땅? ----------
  ctx.setCamera(new THREE.Vector3(-0.4, 0.7, 2.2), 0.62);
  const names: [VillagerId, string][] = [['ddangi', '땅이'], ['ddamong', '따몽'], ['shiba', '시바'], ['gamja', '감자']];
  const picked = await ctx.dialogue.play(V.ddangi.info, [{
    pages: ['{이름}! 누가 제일 멋있었땅?'.replace('{이름}', ctx.playerName)],
    choices: names.map(([, label]) => ({ label, reply: [] })),
  }]);
  const winnerId = names.find(([, label]) => label === picked?.label)?.[0] ?? 'ddangi';
  const winner = V[winnerId];
  await hop(winner.char.root, winner.char.root.position.clone(), 0.6, 0.9, Math.PI * 2);
  winner.char.root.rotation.y = 0;
  if (winnerId === 'ddangi') {
    await say(V.ddangi, '역시 대장 모자땅!! 헤헤헤!');
    await say(V.gamja, '…모자 아니었감자. 그래도 축하했감자.');
  } else if (winnerId === 'gamja') {
    await say(V.gamja, '양말은 발에 신는 게 정답이었감자! 과학이었감자!');
    await say(V.ddangi, '…내일은 나도 발에 신어봤땅.');
  } else if (winnerId === 'shiba') {
    await say(V.shiba, '…나였씨바?', '…귀걸이 계속 했씨바. 헤헤.');
    await say(V.ddangi, '시바 귀 멋있었땅! 인정했땅!');
  } else {
    await say(V.ddamong, '형아가 1등이었따몽?', '…발이 없어도 됐따몽. 고마웠따몽.');
    await say(V.ddangi, '형아 목도리 최고였땅!');
  }
  await say(null, '양말 패션쇼는 해가 다 질 때까지 계속됐다… 🧦');

  // ---------- 6. 평소대로 (양말은 잘 때 벗음, 라디오는 켜 둠 → 다들 춤추러) ----------
  for (const v of all) v.setScripted(false);
  ctx.setCamera(null);
}
