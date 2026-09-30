// 씻는 날: 꼬질꼬질한 인형들을 빨래망에 넣어 드럼세탁기로 빨고, 빨래건조대에 널어 말린다.
// 고양이 소동 다음 날, 네 명 모두에게 무슨 일인지 듣고 세탁기 앞에서 [빨래하기]를 누르면 시작.
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import { setDirty } from '../entities/dirt';
import type { Villager } from '../entities/villager';
import type { Rack } from '../world/house';
import { sayer, tween, face, hop, wait, frame, type EventContext } from './common';

/** 인형을 감싸는 하얀 빨래망 */
function createNet() {
  const net = new THREE.Group();
  net.name = 'net';
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }),
  );
  const fill = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), new THREE.MeshLambertMaterial({ color: 0xb7c3cc }));
  zipper.position.set(0, 1.1, 0);
  net.add(mesh, fill, zipper);
  net.position.y = 0.52;
  return net;
}

export async function runLaundry(ctx: EventContext) {
  const { house, villagers: V, player, fade } = ctx;
  const { washer, rack } = house;
  const say = sayer(ctx.dialogue);
  // 형아부터 차례로 들어감, 물 싫어하는 시바는 맨 마지막
  const order = [V.ddamong, V.gamja, V.ddangi, V.shiba];
  const lineup = [V.ddangi, V.ddamong, V.shiba, V.gamja];

  // ---------- 1. 세탁기 앞에 모임 ----------
  await fade.out('오늘은 씻는 날! 🫧');
  for (const v of lineup) v.setScripted(true);
  lineup.forEach((v, i) => {
    v.char.root.position.set(17.4 + i * 0.95, 0, 5.2);
    face(v.char.root, washer.front);
  });
  player.root.position.set(16.2, 0, 4.2);
  face(player.root, washer.front);
  ctx.setCamera(new THREE.Vector3(19.8, 1.1, 4.6), 0.55, true);
  await wait(1.0);
  await fade.in();
  await say(V.ddangi, '세탁기 탄다땅!! 놀이기구땅!!');
  await say(V.shiba, '…물 싫었씨바.', '안 들어갔씨바…');
  await say(V.ddamong, '괜찮았따몽. 형아가 같이 들어갔따몽.');
  await say(V.gamja, '인형은 빨래망에 넣어서 울 코스로 빨아야 털이 안 상했감자.', '책에서 봤감자!');

  // ---------- 2. 빨래망에 쏙 → 세탁기에 쏙 ----------
  await tween(0.7, (k) => washer.setOpen(k));
  const inside = washer.door.clone().add(new THREE.Vector3(0, -0.5, -0.9));
  for (const v of order) {
    const root = v.char.root;
    const net = createNet();
    root.add(net);
    await tween(0.25, (k) => net.scale.setScalar(0.3 + 0.7 * k));
    if (v === V.shiba) await say(V.shiba, '…알았씨바. 들어갔씨바…');
    await hop(root, washer.door.clone().add(new THREE.Vector3(0, -0.55, 0.15)), 0.55, 0.7);
    const from = root.position.clone();
    await tween(0.3, (k) => {
      root.position.lerpVectors(from, inside, k);
      root.scale.setScalar(1 - 0.6 * k);
    });
    root.visible = false;
    root.scale.set(1, 1, 1);
  }
  await tween(0.6, (k) => washer.setOpen(1 - k));

  // ---------- 3. 빙글빙글 ----------
  // 유리 너머로 보이는 빨래: 인형 색 공 + 거품
  for (const v of order) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial({ color: new THREE.Color(v.info.color) }));
    ball.scale.set(0.2, 0.2, 0.04);
    washer.drum.add(ball);
  }
  for (let i = 0; i < 7; i++) {
    const foam = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    foam.scale.set(0.1, 0.1, 0.03);
    washer.drum.add(foam);
  }
  washer.drum.children.forEach((c, i) => {
    const a = (i / washer.drum.children.length) * Math.PI * 2;
    const r = i < order.length ? 0.38 : 0.5;
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
  await say(null, '울 코스 · 찬물 · 약하게 🫧', '삑—');
  await say(null, '웅— 철퍽철퍽… 드르르르르—');
  await say(V.ddangi, '빙글빙글땅~~!!!');
  await say(V.shiba, '뭔일이래?!?!', '어지러웠씨바아아—');
  await say(V.gamja, '원, 원심력이었감자아아—');
  await say(V.ddamong, '다들 형아 꼭 잡았따몽!!');
  speed = 14;
  shake = 0.09;
  await say(null, '탈수 중… 우우우우웅—!!!');
  spinning = false;
  await spin;
  await say(null, '삐리리리~ ♪ 빨래 끝!');

  // ---------- 4. 탈탈 털어서 건조대에 널기 ----------
  await fade.out('탈탈 털어서 건조대에 널었다');
  await wait(1.2);
  washer.drum.clear();
  washer.drum.rotation.z = 0;
  house.frontDoor.setTorn(0); // 대문 앞 쓰레기도 치움
  lineup.forEach((v, i) => {
    const root = v.char.root;
    root.getObjectByName('net')?.removeFromParent();
    setDirty(v.char, false);
    root.visible = true;
    root.position.copy(rack.spots[i]);
    root.rotation.set(0, 0, 0);
    v.setPose('lieBack');
    v.drying = true;
  });
  player.root.position.copy(rack.spots[0]).setY(0).add(new THREE.Vector3(-1.5, 0, 0)); // 건조대 왼쪽 옆
  player.root.rotation.set(0, Math.PI / 2, 0);
  ctx.setCamera(new THREE.Vector3(rack.front.x, 1.6, rack.front.z + 1.2), 0.55, true);
  await wait(0.5);
  await fade.in();
  await say(V.ddangi, '또 탔땅!! 한 번만 더 탔땅!!');
  await say(V.shiba, '…어지러웠씨바.', '…근데 여기 누워 있으니까 좋았씨바. 쿨…');
  await say(null, '다 마를 때까지 조금 기다리자.', '(건조대에 널린 인형들에게 말을 걸 수 있어요)');
  ctx.setCamera(null);
}

/** 다 말랐으면 건조대에서 폴짝 내려옴. instant = true 면 연출 없이 바로 (밤에 잠들 때) */
export async function finishDrying(villagers: Villager[], rack: Rack, instant = false) {
  const drying = villagers.filter((v) => v.drying);
  await Promise.all(drying.map(async (v, i) => {
    const to = rack.front.clone().add(new THREE.Vector3((i - 1.5) * 1.0, 0, 0));
    v.setPose('stand');
    if (!instant) {
      await wait(i * 0.35);
      await hop(v.char.root, to, 0.6, 0.6);
    }
    v.char.root.position.copy(to);
    v.drying = false;
    v.setScripted(false);
    if (!instant) v.say('뽀송뽀송!', 2.5); // 연출에서 풀린 뒤에 (풀 때 말풍선이 지워짐)
  }));
}
