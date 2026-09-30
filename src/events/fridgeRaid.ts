// 냉장고 몰래 털기: 밤에 플레이어가 잠들면 인형들이 탑을 쌓아 냉장고 만두를 훔친다.
// 시바(맨 아래, 자는 중) → 감자 → 따몽 → 땅이(맨 위). 탑이 흔들리다 와르르 무너지고 다 같이 몰래 먹는다.
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import type { VillagerId } from '../entities/styles';
import { fallAsleep, wakeUp, sayer, tween, face, hop, walk, heightOf, wait, type EventContext } from './common';

export async function runFridgeRaid(ctx: EventContext) {
  const { house, villagers: V, fade } = ctx;
  const { fridge } = house;
  const all = Object.values(V);
  const say = sayer(ctx.dialogue);

  // ---------- 1. 잠들기 ----------
  const playerZzz = await fallAsleep(ctx);
  // 인형들은 부엌 바닥으로
  const starts: Record<VillagerId, THREE.Vector3> = {
    ddangi: new THREE.Vector3(19.8, 0, 1.2),
    ddamong: new THREE.Vector3(21.4, 0, 2.2),
    gamja: new THREE.Vector3(20.3, 0, 3.0),
    shiba: new THREE.Vector3(22.2, 0, 1.0),
  };
  for (const v of all) {
    v.char.root.position.copy(starts[v.info.id]);
    v.char.root.rotation.set(0, Math.PI, 0);
  }
  const F = fridge.front;
  ctx.setCamera(new THREE.Vector3(F.x - 0.8, 1.2, 0.2), 0.62, true);
  await wait(0.6);
  fade.setText('');
  await fade.in();

  // ---------- 2. 작전 회의 ----------
  await say(null, '…모두가 잠든 밤.', '어디선가 작은 발소리가 들린다.');
  face(V.ddangi.char.root, V.ddamong.char.root.position);
  await say(V.ddangi, '쉿… 다들 잠들었땅?');
  await say(V.ddamong, '마다오. 방금 코 고는 소리 들었따몽.');
  await say(V.gamja, '냉장고 두 번째 칸에 만두가 있었감자. 확인했감자.');
  await say(V.ddangi, '좋았땅! 냉장고 작전 개시땅!!');

  // ---------- 3. 탑 쌓기 ----------
  const shiba = V.shiba.char.root;
  await walk(V.shiba, F.clone(), 1.4);
  shiba.rotation.y = 0;
  shiba.scale.y = 0.8; // 납작 엎드림
  V.shiba.zzz.visible = true;
  await say(V.shiba, '…나 또 맨 아래씨바?', '…쿨…');

  let top = heightOf(V.shiba.char) - 0.06;
  for (const [v, line] of [
    [V.gamja, '무게중심 계산 끝났감자. 올라갔감자!'],
    [V.ddamong, '흔들리지 마따몽… 받쳤따몽…'],
    [V.ddangi, '대장은 맨 위땅!!'],
  ] as const) {
    const root = v.char.root;
    await walk(v, new THREE.Vector3(F.x, 0, F.z + 1.3));
    root.rotation.y = 0;
    await hop(root, new THREE.Vector3(F.x, top, F.z), 0.6, 1.0);
    root.rotation.y = Math.PI; // 냉장고를 봄
    top += heightOf(v.char) - 0.06;
    await say(v, line);
  }

  // ---------- 4. 냉장고 열기 ----------
  await say(null, '끼이익…');
  ctx.setCamera(new THREE.Vector3(F.x - 0.6, 2.2, -1.2), 0.62);
  await tween(1.0, (k) => {
    fridge.setOpen(k);
    fridge.light.intensity = 28 * k;
  });
  await say(V.ddangi, '불 켜졌땅!! 눈부셨땅!!', '…만두 찾았땅!!!');
  // 땅이가 쟁반을 꺼냄
  const ddangi = V.ddangi.char.root;
  const hold = new THREE.Vector3(F.x, ddangi.position.y + 0.55, F.z - 0.55);
  const trayFrom = fridge.tray.position.clone();
  await tween(0.8, (k) => {
    fridge.tray.position.lerpVectors(trayFrom, hold, k);
    fridge.tray.position.y += Math.sin(k * Math.PI) * 0.3;
  });
  ddangi.attach(fridge.tray);

  // ---------- 5. 흔들흔들 → 와르르 ----------
  const tower = [V.shiba, V.gamja, V.ddamong, V.ddangi].map((v) => v.char.root);
  const baseX = tower.map((r) => r.position.x);
  const wobble = async (sec: number, amp: number) => {
    const start = performance.now();
    await tween(sec, () => {
      const s = Math.sin(((performance.now() - start) / 1000) * 9);
      tower.forEach((r, i) => {
        r.rotation.z = s * amp * i;
        r.position.x = baseX[i] + s * amp * 1.4 * i;
      });
    }, (k) => k);
  };
  const wobbling = wobble(1.4, 0.05);
  await say(V.ddamong, '흔, 흔들렸따몽…!');
  await wobbling;
  const wobbling2 = wobble(1.2, 0.09);
  await say(V.gamja, '무슨 일이데오?! 땅이 형아 가만히 있었감자!!');
  await wobbling2;
  await say(null, '와르르르—');

  V.shiba.zzz.visible = false;
  shiba.scale.y = 1;
  house.group.attach(fridge.tray);
  const landings: [THREE.Object3D, THREE.Vector3, number][] = [
    [V.gamja.char.root, new THREE.Vector3(19.7, 0, -1.4), 5],
    [V.ddamong.char.root, new THREE.Vector3(22.4, 0, -1.0), -4],
    [V.ddangi.char.root, new THREE.Vector3(20.6, 0, 0.2), 7],
  ];
  const trayLanding = new THREE.Vector3(21.3, 0.04, 1.1);
  const manduLandings = fridge.tray.children
    .filter((c) => c.name === 'mandu')
    .map((m, i) => {
      const a = (i / 6) * Math.PI * 2;
      return [m, new THREE.Vector3(Math.cos(a) * 0.8, -0.04, Math.sin(a) * 0.6)] as const;
    });
  const manduFrom = manduLandings.map(([m]) => m.position.clone());
  const trayFrom2 = fridge.tray.position.clone();
  await Promise.all([
    ...landings.map(([r, to, spin]) => {
      r.rotation.z = 0;
      return hop(r, to, 0.8, 1.2, spin);
    }),
    tween(0.9, (k) => {
      fridge.tray.position.lerpVectors(trayFrom2, trayLanding, k);
      fridge.tray.position.y += 4 * 1.0 * k * (1 - k);
      fridge.tray.rotation.z = k * Math.PI * 2;
      manduLandings.forEach(([m, to], i) => m.position.lerpVectors(manduFrom[i], to, k));
    }, (k) => k),
  ]);
  for (const r of tower) r.rotation.set(0, r.rotation.y, 0);
  await say(V.shiba, '…뭔일이래?!');

  // ---------- 6. 다 같이 몰래 먹기 ----------
  const center = trayLanding.clone();
  await Promise.all(
    all.map((v, i) => {
      const a = (i / all.length) * Math.PI * 2 + 0.4;
      return walk(v, new THREE.Vector3(center.x + Math.cos(a) * 1.3, 0, center.z + Math.sin(a) * 1.1), 1.8);
    }),
  );
  for (const v of all) face(v.char.root, center);
  ctx.setCamera(new THREE.Vector3(center.x, 0.8, center.z), 0.6);
  await say(V.ddangi, '…쉿! 조용히 먹자땅.');
  const mandus = manduLandings.map(([m]) => m);
  for (const m of mandus) {
    const s0 = m.scale.clone();
    await tween(0.35, (k) => m.scale.copy(s0).multiplyScalar(1 - k));
    m.visible = false;
  }
  await say(V.gamja, '맛있었감자…');
  await say(V.shiba, '배불렀씨바… 쿨…');
  await say(null, '그날 밤, 만두는 하나도 남지 않았다…');

  // ---------- 7. 다음 날 아침 ----------
  await wakeUp(ctx, playerZzz, () => {
    fridge.setOpen(0);
    fridge.light.intensity = 0;
    // 증거: 바닥에 빈 쟁반 + 만두 부스러기
    fridge.tray.rotation.set(0, 0.4, 0);
    fridge.tray.position.set(20.8, 0.04, 0.8);
    mandus.forEach((m, i) => {
      m.visible = i < 2;
      m.scale.set(0.05, 0.04, 0.04);
      m.position.set(0.6 + i * 0.3, -0.03, 0.5 + i * 0.2);
    });
  });
  await say(null, '…어라? 부엌에서 무슨 냄새가 난다.', '인형들한테 무슨 일인지 물어보자.');
}
