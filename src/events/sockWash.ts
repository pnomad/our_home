// 5일째 아침: 양말 빨래.
// 땅이가 양말 냄새를 킁킁 → "…빨아야 했땅!" → 다 같이 세탁기에 양말을 넣고 유리 너머로 구경
// → 시바 "나 대신 양말이 빨래했씨바. 다행이었씨바." → 건조대에 널고 "내 모자땅!" "아니에오, 양말이었감자!"
// → 뽀송뽀송 마르면 한 짝씩 나눠 가짐 (땅이 모자, 감자 양말, 시바 귀걸이, 따몽 목도리).
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import { sayer, tween, face, hop, walk, wait, frame, type EventContext } from './common';
import { createSock, takeOffSocks, putSock, wearOnHead, wearOnFoot, wearOnEar, wearAsScarf } from './sockStory';

export async function runSockWash(ctx: EventContext) {
  const { house, villagers: V, player, fade } = ctx;
  const { washer, rack } = house;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);
  const lineup = [V.ddangi, V.ddamong, V.shiba, V.gamja];

  // ---------- 1. 세탁기 앞 양말 더미, 땅이가 킁킁 ----------
  await fade.out('5일째 · 아침');
  await wait(0.8);
  for (const v of all) v.setScripted(true);
  takeOffSocks(all);
  // 어제 쓴 양말 다섯 짝: 빨강 한 켤레 + 파랑 · 노랑 · 초록
  const socks = [createSock(), createSock(), createSock(0x5b8fc9), createSock(0xf2c14e), createSock(0x6fbf73)];
  const PILE = new THREE.Vector3(19.4, 0, 4.0);
  socks.forEach((s, i) => {
    s.position.set(PILE.x + Math.cos(i * 2.4) * 0.35, 0.1 + (i % 2) * 0.12, PILE.z + Math.sin(i * 2.4) * 0.3);
    s.rotation.set(0, i * 1.3, Math.PI / 2);
    house.group.add(s);
  });
  lineup.forEach((v, i) => {
    v.char.root.position.set(17.4 + i * 0.95, 0, 5.2);
    face(v.char.root, PILE);
  });
  player.root.position.set(16.2, 0, 4.2);
  face(player.root, washer.front);
  ctx.setNameTags(true);
  ctx.setCamera(new THREE.Vector3(19.8, 1.0, 5.6), 0.55, true);
  await wait(0.5);
  await fade.in();
  await say(V.gamja, '어제 신은 양말이 다 여기 있었감자.');
  const ddangi = V.ddangi.char.root;
  await walk(V.ddangi, new THREE.Vector3(18.6, 0, 4.3), 1.4);
  face(ddangi, PILE);
  // 한 짝 집어 코앞에
  await putSock(socks[0], V.ddangi.char.body, new THREE.Vector3(0, 0.7, 0.45), new THREE.Euler(0, Math.PI / 2, 0), 0.8, 0.5);
  await tween(1.6, (k) => (V.ddangi.char.body.rotation.x = Math.abs(Math.sin(k * Math.PI * 4)) * 0.18));
  await say(V.ddangi, '킁킁… 킁킁킁…');
  // 깜짝 → 뒤로 폴짝
  await hop(ddangi, ddangi.position.clone().add(new THREE.Vector3(-0.3, 0, 0.4)), 0.4, 0.5);
  await say(V.ddangi, '……!!', '…빨아야 했땅!');
  await say(V.shiba, '어제 밤까지 머리에 쓰고 있었씨바…');
  await say(V.gamja, '양말은 한 번 신으면 빨아야 했감자. 책에서 봤감자!');
  await say(V.shiba, '…나도 빨아졌씨바?');
  await say(V.ddamong, '오늘은 양말만 빨았따몽. 시바는 구경만 했따몽.');
  await say(V.shiba, '…다행이었씨바.');

  // ---------- 2. 세탁기에 쏙쏙 ----------
  await tween(0.7, (k) => washer.setOpen(k));
  const inside = washer.door.clone().add(new THREE.Vector3(0, -0.4, -0.6));
  for (const s of socks) {
    await putSock(s, house.group, inside, new THREE.Euler(0, 0, Math.PI / 2), 0.4, 0.45);
    s.visible = false;
  }
  await tween(0.6, (k) => washer.setOpen(1 - k));
  // 다들 세탁기 유리 양옆으로 (유리가 가리지 않게)
  const watch = [19.0, 19.85, 20.7, 22.6];
  await Promise.all(lineup.map((v, i) => walk(v, new THREE.Vector3(watch[i], 0, 6.2), 1.8)));
  for (const v of lineup) face(v.char.root, washer.door);

  // ---------- 3. 빙글빙글 — 유리 너머 줄무늬 양말 ----------
  for (const s of socks) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: s.userData.stripe }));
    c.scale.set(0.16, 0.09, 0.03);
    washer.drum.add(c);
  }
  for (let i = 0; i < 6; i++) {
    const foam = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    foam.scale.set(0.09, 0.09, 0.03);
    washer.drum.add(foam);
  }
  washer.drum.children.forEach((c, i) => {
    const a = (i / washer.drum.children.length) * Math.PI * 2;
    const r = i < socks.length ? 0.36 : 0.5;
    c.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
  let speed = 3;
  let shake = 0.02;
  let spinning = true;
  const washerHome = washer.group.position.clone();
  const spin = (async () => {
    let last = performance.now();
    while (spinning) {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      washer.drum.rotation.z -= speed * dt;
      washer.group.position.set(washerHome.x + (Math.random() - 0.5) * shake, washerHome.y, washerHome.z + (Math.random() - 0.5) * shake);
      await frame();
    }
    washer.group.position.copy(washerHome);
  })();
  await say(null, '울 코스 · 찬물 · 약하게 🫧', '웅— 철퍽철퍽…');
  await say(V.ddangi, '빙글빙글땅!! 나도 타고 싶었땅!!');
  await say(V.ddamong, '오늘은 양말 차례였따몽.');
  // 시바: 유리에 코를 박고 고개 갸웃
  const tilt = tween(2.4, (k) => (V.shiba.char.body.rotation.z = Math.sin(k * Math.PI * 2) * 0.22));
  await say(V.shiba, '빙글빙글… 나 대신 양말이 빨래했씨바.', '다행이었씨바.');
  await tilt;
  V.shiba.char.body.rotation.z = 0;
  await say(V.gamja, '양말아, 힘냈감자…!');
  speed = 14;
  shake = 0.08;
  await say(null, '탈수 중… 우우우우웅—!!!');
  spinning = false;
  await spin;
  await say(null, '삐리리리~ ♪ 빨래 끝!');

  // ---------- 4. 건조대에 널기: "내 모자땅!" "아니에오, 양말이었감자!" ----------
  await fade.out('탈탈 털어서 건조대에 널었다');
  await wait(1.2);
  washer.drum.clear();
  washer.drum.rotation.z = 0;
  const x0 = rack.spots[0].x - 0.2;
  const x1 = rack.spots[rack.spots.length - 1].x + 0.2;
  socks.forEach((s, i) => {
    s.visible = true;
    // 건조대 위에 거꾸로 걸쳐 둠 (발목이 아래로 대롱)
    putSock(s, house.group, new THREE.Vector3(x0 + ((x1 - x0) * i) / (socks.length - 1), rack.spots[0].y + 0.05, rack.spots[0].z), new THREE.Euler(0, 0, Math.PI), 1);
  });
  lineup.forEach((v, i) => {
    v.char.root.position.copy(rack.front).add(new THREE.Vector3((i - 1.5) * 1.0, 0, 0));
    v.char.root.rotation.set(0, 0, 0); // 건조대 뒤에서 앞(건조대)을 봄
  });
  player.root.position.copy(rack.front).add(new THREE.Vector3(-3.0, 0, 0.4));
  face(player.root, rack.front);
  ctx.setCamera(new THREE.Vector3(rack.front.x, 1.4, rack.front.z + 0.8), 0.58, true);
  await wait(0.5);
  await fade.in();
  await say(V.ddangi, '다 마르면 내 모자땅!');
  await say(V.gamja, '아니에오, 양말이었감자!');
  await say(V.ddangi, '모자땅!!');
  await say(V.gamja, '양말이었감자!!');
  await say(V.ddamong, '둘 다 그만했따몽…');
  await say(V.shiba, '…뭔일이래. 쿨…');

  // ---------- 5. 뽀송뽀송 → 한 짝씩 나눠 가짐 ----------
  await fade.out('한참 뒤… 양말이 뽀송뽀송 말랐다');
  await wait(1.2);
  await fade.in();
  await say(V.ddamong, '그럼 한 짝씩 나눴따몽.', '땅이는 모자, 감자는 양말. 그럼 둘 다 마다오였따몽.');
  await Promise.all([
    wearOnHead(V.ddangi, socks[0], 0.35, 0.8),
    wearOnFoot(V.gamja, socks[1], 1, 0.8),
  ]);
  await say(V.ddangi, '뽀송뽀송 모자땅!');
  await say(V.gamja, '뽀송뽀송 양말이었감자!');
  await Promise.all([
    wearOnEar(V.shiba, socks[2], 0.8),
    wearAsScarf(V.ddamong, socks[3], 0.8),
  ]);
  await say(V.shiba, '나는 또 귀걸이였씨바.');
  await say(V.ddamong, '형아는 목도리였따몽~');
  await Promise.all(lineup.map((v, i) => (async () => {
    await wait(i * 0.15);
    await hop(v.char.root, v.char.root.position.clone(), 0.5, 0.7);
  })()));
  await say(null, '그렇게 양말 소동은 뽀송뽀송하게 끝났다. 🧦');

  // ---------- 6. 평소대로 ----------
  socks[4].removeFromParent();
  for (const v of all) v.setScripted(false);
  ctx.setCamera(null);
}
