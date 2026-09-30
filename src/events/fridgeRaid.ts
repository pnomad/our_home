// 냉장고 몰래 털기: 밤에 플레이어가 잠들면 인형들이 탑을 쌓아 냉장고 만두를 훔친다.
// 시바(맨 아래, 자는 중) → 감자 → 따몽 → 땅이(맨 위). 탑이 흔들리다 와르르 무너지고 다 같이 몰래 먹는다.
// 대사를 바꾸려면 아래 say(...) 부분만 고치면 된다.
import * as THREE from 'three';
import type { Character } from '../entities/models';
import { createZzz, type Villager } from '../entities/villager';
import type { VillagerId } from '../entities/styles';
import type { House } from '../world/house';
import type { Lighting } from '../world/lighting';
import type { DialogueBox, Speaker } from '../ui/dialogue';
import type { Fade } from '../ui/fade';

export interface RaidContext {
  house: House;
  villagers: Record<VillagerId, Villager>;
  player: Character;
  dialogue: DialogueBox;
  lighting: Lighting;
  fade: Fade;
  /** focus = null 이면 다시 플레이어를 따라감. snap = true 면 부드럽게 말고 바로 이동 (암전 중에 사용) */
  setCamera(focus: THREE.Vector3 | null, zoom?: number, snap?: boolean): void;
  setNameTags(visible: boolean): void;
  /** 다음 날 아침으로 넘기고 날짜를 돌려줌 */
  nextDay(): number;
}

const NARRATOR: Speaker = { name: '', order: '', color: '' };

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const wait = (sec: number) => new Promise((r) => setTimeout(r, sec * 1000));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** sec초 동안 k(0→1)로 fn을 부름 */
async function tween(sec: number, fn: (k: number) => void, easing = ease) {
  const start = performance.now();
  for (;;) {
    const k = Math.min(1, (performance.now() - start) / 1000 / sec);
    fn(easing(k));
    if (k >= 1) return;
    await frame();
  }
}

function face(obj: THREE.Object3D, to: THREE.Vector3) {
  obj.rotation.y = Math.atan2(to.x - obj.position.x, to.z - obj.position.z);
}

/** 포물선을 그리며 폴짝 */
async function hop(obj: THREE.Object3D, to: THREE.Vector3, sec = 0.55, height = 0.8, spin = 0) {
  const from = obj.position.clone();
  const ry = obj.rotation.y;
  await tween(sec, (k) => {
    obj.position.lerpVectors(from, to, k);
    obj.position.y += 4 * height * k * (1 - k);
    obj.rotation.y = ry + spin * k;
  }, (k) => k);
}

async function walk(v: Villager, to: THREE.Vector3, speed = 2.2) {
  const obj = v.char.root;
  face(obj, to);
  const from = obj.position.clone();
  v.walking = true;
  await tween(from.distanceTo(to) / speed, (k) => obj.position.lerpVectors(from, to, k), (k) => k);
  v.walking = false;
}

/** 캐릭터 키 (납작하게 줄인 것도 반영) */
function heightOf(c: Character) {
  c.root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(c.body).max.y - c.root.position.y;
}

export async function runFridgeRaid(ctx: RaidContext) {
  const { house, villagers: V, player, dialogue, lighting, fade } = ctx;
  const { fridge } = house;
  const all = Object.values(V);
  const say = (v: Villager | null, ...pages: string[]) => dialogue.play(v ? v.info : NARRATOR, [{ pages }]);

  // ---------- 1. 잠들기 ----------
  const playerZzz = createZzz();
  await fade.out('쿨… 쿨…');
  await wait(0.8);
  lighting.setNight(true);
  // 플레이어는 침대에 누움
  player.root.position.set(-16.3, 1.85, -3.4);
  player.root.rotation.set(-Math.PI / 2, 0, 0);
  player.root.add(playerZzz);
  playerZzz.visible = true;
  playerZzz.position.set(0.4, 0.4, 0.9);
  // 인형들은 부엌 바닥으로
  ctx.setNameTags(false);
  const starts: Record<VillagerId, THREE.Vector3> = {
    ddangi: new THREE.Vector3(19.8, 0, 1.2),
    ddamong: new THREE.Vector3(21.4, 0, 2.2),
    gamja: new THREE.Vector3(20.3, 0, 3.0),
    shiba: new THREE.Vector3(22.2, 0, 1.0),
  };
  for (const v of all) {
    v.setScripted(true);
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
  const day = ctx.nextDay();
  await fade.out(`${day}일째 아침 ☀️`);
  await wait(1.2);
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
  for (const v of all) {
    const z = v.zone;
    v.char.root.position.set((z.x0 + z.x1) / 2, z.y, (z.z0 + z.z1) / 2);
    v.char.root.rotation.set(0, 0, 0);
    v.char.root.scale.set(1, 1, 1);
    v.setScripted(false);
  }
  player.root.remove(playerZzz);
  player.root.rotation.set(0, 0, 0);
  player.root.position.set(-13.8, 1.6, -1.2); // 침대 가장자리에서 깸 (가운데는 시바 자리)
  ctx.setNameTags(true);
  ctx.setCamera(null, 1, true);
  await wait(0.5);
  await fade.in();
  await say(null, '…어라? 부엌에서 무슨 냄새가 난다.', '인형들한테 무슨 일인지 물어보자.');
}
