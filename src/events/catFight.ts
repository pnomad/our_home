// 고양이 소동: 밤에 대문 앞 쓰레기봉지를 동네 고양이가 뒤적뒤적 → 자던 인형들이 깨서 나가 한판 붙고 쫓아낸다.
// 다음 날 아침 인형들은 꼬질꼬질 (→ 세탁기로 빨래, events/laundry.ts).
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import type { Character } from '../entities/models';
import { BLACK } from '../entities/models';
import { buildPlush } from '../entities/plushStyle';
import { setDirty } from '../entities/dirt';
import type { CharacterSpec } from '../entities/shapeSpecs';
import type { VillagerId } from '../entities/styles';
import type { Speaker } from '../ui/dialogue';
import { fallAsleep, wakeUp, sayer, tween, face, hop, walk, wait, frame, type EventContext } from './common';

const CAT_SPEAKER: Speaker = { name: '고양이', order: '동네', color: '#8b8f98' };

/** 동네 고양이: 회색 줄무늬, 인형보다 훨씬 큼 */
function createCat(): Character {
  const GREY = 0x9a9ca3;
  const DARK = 0x6e7079;
  const WHITE = 0xf4f2ee;
  const pair = (x: number, make: (x: number) => CharacterSpec['blobs'][number]) => [make(-x), make(x)];
  const spec: CharacterSpec = {
    blobs: [
      ...pair(0.15, (x) => ({ c: [x, 0.14, 0.3], r: [0.08, 0.15, 0.08], color: GREY })), // 앞다리
      ...pair(0.16, (x) => ({ c: [x, 0.14, -0.42], r: [0.09, 0.15, 0.09], color: GREY })), // 뒷다리
      { c: [0, 0.46, -0.08], r: [0.28, 0.25, 0.52], color: GREY }, // 몸
      { c: [0, 0.4, 0.12], r: [0.2, 0.18, 0.3], color: WHITE }, // 하얀 가슴
      { c: [0, 0.74, 0.42], r: [0.29, 0.25, 0.24], color: GREY }, // 머리
      ...pair(0.17, (x) => ({ c: [x, 0.98, 0.42], r: [0.09, 0.11, 0.05], color: GREY, taper: 0.8 })), // 뾰족 귀
      { c: [0, 0.66, 0.62], r: [0.11, 0.07, 0.06], color: WHITE }, // 주둥이
      { c: [0, 0.78, -0.66], r: [0.06, 0.3, 0.06], color: DARK }, // 번쩍 든 꼬리
    ],
    marks: [
      { x: -0.1, y: 0.78, w: 0.09, h: 0.07, color: 0xc9d45a }, // 눈
      { x: 0.1, y: 0.78, w: 0.09, h: 0.07, color: 0xc9d45a },
      { x: -0.1, y: 0.78, w: 0.025, h: 0.065, color: BLACK }, // 세로 동공
      { x: 0.1, y: 0.78, w: 0.025, h: 0.065, color: BLACK },
      { x: 0, y: 0.7, w: 0.05, h: 0.03, color: 0xe88f9c }, // 코
      { x: 0, y: 0.93, w: 0.03, h: 0.08, color: DARK }, // 이마 줄무늬
      { x: -0.07, y: 0.92, w: 0.025, h: 0.06, color: DARK },
      { x: 0.07, y: 0.92, w: 0.025, h: 0.06, color: DARK },
    ],
  };
  const cat = buildPlush(spec);
  cat.root.scale.setScalar(1.7);
  return cat;
}

/** 만화처럼 뿌연 싸움 구름: 안에서 누가 삐죽삐죽 튀어나옴. stop() 하면 끝 */
function fightCloud(parent: THREE.Object3D, center: THREE.Vector3, members: THREE.Object3D[]) {
  const cloud = new THREE.Group();
  cloud.position.copy(center);
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d6 });
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), puffMat);
    puff.position.set(Math.cos(a) * 0.9, 0.9 + Math.sin(a * 3) * 0.35, Math.sin(a) * 0.5);
    puff.userData.base = 0.55 + (i % 3) * 0.12;
    puff.castShadow = true;
    cloud.add(puff);
    puffs.push(puff);
  }
  parent.add(cloud);
  const home = members.map((m) => ({ pos: m.position.clone(), rot: m.rotation.clone() }));
  let running = true;
  const done = (async () => {
    const start = performance.now();
    let nextPop = 0;
    while (running) {
      const t = (performance.now() - start) / 1000;
      cloud.rotation.y = t * 2.2;
      cloud.position.x = center.x + Math.sin(t * 7) * 0.15;
      puffs.forEach((p, i) => p.scale.setScalar(p.userData.base * (1 + Math.sin(t * 11 + i) * 0.15)));
      // 한 명씩 구름 밖으로 삐죽 (팔다리·머리가 튀어나오는 느낌)
      if (t >= nextPop) {
        nextPop = t + 0.16;
        const who = Math.floor(Math.random() * members.length);
        members.forEach((m, i) => (m.visible = i === who));
        const a = Math.random() * Math.PI * 2;
        const m = members[who];
        m.position.set(center.x + Math.cos(a) * 1.1, 0.3 + Math.random() * 0.9, center.z + 0.5 + Math.abs(Math.sin(a)) * 0.4);
        m.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.2);
      }
      await frame();
    }
    cloud.removeFromParent();
    members.forEach((m, i) => {
      m.visible = true;
      m.position.copy(home[i].pos);
      m.rotation.copy(home[i].rot);
    });
  })();
  return {
    async stop() {
      running = false;
      await done;
    },
  };
}

export async function runCatFight(ctx: EventContext) {
  const { house, villagers: V, fade } = ctx;
  const door = house.frontDoor;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);

  // ---------- 1. 다들 잠든 밤, 대문 밖엔 고양이 ----------
  const playerZzz = await fallAsleep(ctx);
  for (const v of all) {
    const z = v.zone;
    v.char.root.position.set((z.x0 + z.x1) / 2, z.y, (z.z0 + z.z1) / 2);
    v.char.root.rotation.set(0, 0, 0);
    v.setPose('lieSide');
    v.zzz.visible = true;
  }
  door.setOpen(0);
  door.setTorn(0);
  door.light.intensity = 40;
  const cat = createCat();
  cat.root.position.set(26.9, 0, 0.9);
  face(cat.root, door.bag.position);
  house.group.add(cat.root);
  // 봉지에 머리 박고 뒤적뒤적
  let rummaging = true;
  const rummage = (async () => {
    const start = performance.now();
    while (rummaging) {
      const t = (performance.now() - start) / 1000;
      cat.body.rotation.x = 0.25 + Math.sin(t * 9) * 0.12;
      door.bag.rotation.z = Math.sin(t * 13) * 0.06;
      await frame();
    }
    cat.body.rotation.x = 0;
    door.bag.rotation.z = 0;
  })();

  ctx.setCamera(new THREE.Vector3(25.2, 0.4, 0.8), 0.6, true);
  await wait(0.6);
  fade.setText('');
  await fade.in();
  await say(null, '…모두가 잠든 밤.', '부스럭… 부스럭…', '바스락바스락— 대문 앞에서 무슨 소리가 난다.');

  // ---------- 2. 땅이가 깨서 다 깨움 ----------
  const ddangi = V.ddangi.char.root;
  ctx.setCamera(new THREE.Vector3(ddangi.position.x, ddangi.position.y + 0.5, ddangi.position.z), 0.45);
  await wait(0.8);
  V.ddangi.setPose('stand');
  await hop(ddangi, ddangi.position.clone(), 0.35, 0.5);
  await say(V.ddangi, '꽥?! 무슨 소리땅?!', '다들 일어났땅!! 비상이땅!!');

  await fade.out('');
  const gather: Record<VillagerId, THREE.Vector3> = {
    ddangi: new THREE.Vector3(22.3, 0, -1.3),
    ddamong: new THREE.Vector3(21.4, 0, -0.3),
    shiba: new THREE.Vector3(21.3, 0, -2.3),
    gamja: new THREE.Vector3(20.5, 0, -1.2),
  };
  for (const v of all) {
    v.setPose('stand');
    v.char.root.position.copy(gather[v.info.id]);
    v.char.root.rotation.set(0, Math.PI / 2, 0); // 대문 쪽
  }
  ctx.setCamera(new THREE.Vector3(22.6, 0.4, 0.4), 0.6, true);
  await wait(0.4);
  await fade.in();
  await say(V.gamja, '소리는 대문 앞 쓰레기봉지 쪽이었감자.');
  await say(V.ddamong, '다들 내 뒤에 있었따몽. 형아가 먼저 봤따몽.');
  V.shiba.zzz.visible = true;
  await say(V.shiba, '…졸렸씨바… 뭔일이래…');

  // ---------- 3. 대문 열기 → 고양이 발견 ----------
  await say(null, '끼이익…');
  await tween(1.0, (k) => door.setOpen(k));
  V.shiba.zzz.visible = false;
  ctx.setCamera(new THREE.Vector3(25.4, 0.3, 0.9), 0.62);
  await tween(0.9, (k) => door.setTorn(k));
  await say(null, '고양이가 쓰레기봉지를 뜯고 뒤적뒤적하고 있었다!');
  rummaging = false;
  await rummage;
  face(cat.root, door.inside);
  await say(CAT_SPEAKER, '…냐앙?');
  await say(V.shiba, '…뭔일이래?!');
  await say(V.ddangi, '우리 집 쓰레기 건들지 마땅!!', '돌격이땅!!!');

  // ---------- 4. 한판 싸움 ----------
  const center = new THREE.Vector3(25.9, 0, 0.2);
  await Promise.all(all.map((v, i) => {
    const a = (i / all.length) * Math.PI * 2;
    const to = new THREE.Vector3(center.x + Math.cos(a) * 0.9, 0, center.z + Math.sin(a) * 0.7);
    return wait(i * 0.12).then(() => hop(v.char.root, to, 0.55, 1.0));
  }));
  cat.root.position.copy(center);
  const members = [...all.map((v) => v.char.root), cat.root];
  const cloud = fightCloud(house.group, center, members);
  await say(null, '우당탕탕!!', '냐옹! 꽥꽥! 왈왈! 퍽퍽!', '…구름 속에서 털이 날린다.');
  await wait(0.5);
  await cloud.stop();

  // ---------- 5. 고양이 도망, 인형들은 널브러짐 (꼬질꼬질) ----------
  const sprawl: [VillagerId, THREE.Vector3, 'lieSide' | 'lieBack', number][] = [
    ['ddangi', new THREE.Vector3(24.8, 0, 0.9), 'lieBack', 0.3],
    ['ddamong', new THREE.Vector3(25.4, 0, -1.6), 'lieSide', -0.6],
    ['shiba', new THREE.Vector3(26.7, 0, 1.3), 'lieSide', 2.2],
    ['gamja', new THREE.Vector3(27.1, 0, -0.9), 'lieBack', -0.2],
  ];
  for (const [id, pos, pose, ry] of sprawl) {
    const v = V[id];
    v.char.root.position.copy(pos);
    v.char.root.rotation.set(0, ry, 0);
    v.setPose(pose);
    setDirty(v.char, true);
  }
  cat.root.position.set(26.2, 0, 0.1);
  cat.root.rotation.set(0, Math.PI / 2, 0);
  await say(CAT_SPEAKER, '냐아아앙~!!!');
  const catFrom = cat.root.position.clone();
  const catTo = new THREE.Vector3(34, 0, 2.5);
  await tween(1.1, (k) => {
    cat.root.position.lerpVectors(catFrom, catTo, k);
    cat.root.position.y = Math.abs(Math.sin(k * Math.PI * 6)) * 0.3;
  }, (k) => k * k);
  cat.root.removeFromParent();
  await say(null, '고양이는 담 너머로 도망쳤다.');

  for (const v of all) v.setPose('stand');
  await hop(ddangi, ddangi.position.clone(), 0.4, 0.6);
  await say(V.ddangi, '…이겼땅!!! 대장 최고땅!!');
  await say(V.shiba, '앙 물었씨바…', '…퉤퉤. 입에 털 들어갔씨바.');
  await say(V.gamja, '고양이는 우리보다 열 배는 무거웠감자…', '과학적으로 기적이었감자. 콜록.');
  await say(V.ddamong, '다들 다친 데 없었따몽?', '…근데 다들 꼬질꼬질해졌따몽.');

  // ---------- 6. 집으로 ----------
  await Promise.all(all.map((v, i) => walk(v, new THREE.Vector3(21.2 - (i % 2) * 0.9, 0, -2.2 + i * 0.8), 1.8)));
  await tween(0.9, (k) => door.setOpen(1 - k));
  await say(null, '그날 밤, 대문 앞은 다시 조용해졌다…');

  // ---------- 7. 다음 날 아침: 꼬질꼬질 ----------
  await wakeUp(ctx, playerZzz, () => (door.light.intensity = 0));
  await say(null, '…어라? 인형들이 왜 이렇게 꼬질꼬질하지?', '무슨 일이 있었는지 물어보자.');
}
