// 아침 손님: 매일 오전 10시 반~12시 사이 침실 창문(침대 위)에 새가 찾아온다. 게임을 멈추지 않고 말풍선으로 진행.
//   참새 · 비둘기 · 까치: 땅이와 감자가 헤드보드 위로 올라가 창밖 새와 이야기
//   까마귀: 땅이는 깜짝 놀라 나자빠지고, 따몽은 "문 열면 위험해!", 감자는 창문을 잠그고, 시바는 구경
// 대사를 바꾸려면 아래 LINES / runCrow 부분만 고치면 된다.
import * as THREE from 'three';
import { createBubble, type Villager } from '../entities/villager';
import { createBird, BIRD_NAMES, type Bird, type BirdKind } from '../entities/birds';
import { nearestPlace } from '../world/places';
import type { VillagerId } from '../entities/styles';
import type { House } from '../world/house';
import { tween, wait, frame } from './common';

export interface BirdVisitContext {
  house: House;
  villagers: Record<VillagerId, Villager>;
  /** 화면 위에 잠깐 뜨는 알림 */
  toast(text: string): void;
  /** 대사 속 {이름} (지금 노는 사람) */
  playerName: string;
}

type Line = [VillagerId | 'bird', string];

/** 참새·비둘기·까치와 땅이·감자의 대화 */
const LINES: Record<Exclude<BirdKind, 'crow'>, Line[]> = {
  sparrow: [
    ['bird', '짹짹!'],
    ['ddangi', '안녕땅! 짹짹이 왔땅!'],
    ['gamja', '참새는 하루에 몸무게 반만큼 먹었감자.'],
    ['bird', '짹?'],
    ['ddangi', '배고팠땅? 냉장고에 만두 있었땅!'],
    ['gamja', '…참새는 만두 안 먹었감자.'],
    ['bird', '짹짹짹!'],
  ],
  pigeon: [
    ['bird', '구구구…'],
    ['ddangi', '구구 왔땅! 오늘도 놀러 왔땅?'],
    ['gamja', '비둘기는 길을 잘 찾았감자. 책에서 봤감자!'],
    ['bird', '구구!'],
    ['ddangi', '그래서 우리 집도 잘 찾아왔땅!'],
    ['bird', '구구구~'],
  ],
  magpie: [
    ['bird', '깍깍!'],
    ['ddangi', '까치다땅! 반가운 손님 온다땅!'],
    ['gamja', '까치가 울면 손님이 온다고 했감자.'],
    ['ddangi', '손님은 {이름}이땅! 헤헤.'],
    ['bird', '깍깍깍!'],
    ['gamja', '…과학적 근거는 없었감자. 그래도 좋았감자.'],
  ],
};

/** 창문 앞 자리: 헤드보드 위(창밖 새와 마주 봄), 베개 위, 침대 위 */
interface Spot {
  x: number;
  where: 'ledge' | 'pillow' | 'bed';
  z?: number;
}

const BED_Y = 1.6;
const PILLOW = { y: 2.0, z: -4.75 };

export async function runBirdVisit(ctx: BirdVisitContext, kind: BirdKind) {
  const { house, villagers: V } = ctx;
  const win = house.bedWindow;
  const sill = win.sill;
  const ledgeY = sill.y;

  // ---------- 1. 새가 날아와 창밖 창턱에 앉음 ----------
  const bird = createBird(kind);
  house.group.add(bird.root);
  const bubble = createBubble();
  bubble.sprite.scale.multiplyScalar(0.9);
  house.group.add(bubble.sprite);
  const land = new THREE.Vector3(sill.x - 0.6, ledgeY, sill.z);
  const from = new THREE.Vector3(win.x1 + 3, ledgeY + 2.5, sill.z);
  let flying = true;
  let pecking = false;
  let alive = true;
  // 매 프레임: 날갯짓 · 콕콕 · 말풍선 따라다니기
  const anim = (async () => {
    const start = performance.now();
    while (alive) {
      const t = (performance.now() - start) / 1000;
      bird.flap(t, flying ? 1 : 0);
      bird.body.rotation.x = flying ? 0 : pecking ? Math.max(0, Math.sin(t * 14)) * 0.5 : Math.sin(t * 2.3) * 0.06;
      bubble.sprite.position.copy(bird.root.position).add(new THREE.Vector3(0, 1.0 + 0.4 * bird.root.scale.y, 0.3));
      await frame();
    }
  })();
  const birdSay = async (text: string, sec = 2) => {
    bubble.draw(text);
    bubble.sprite.visible = true;
    await wait(sec);
    bubble.sprite.visible = false;
  };
  bird.root.position.copy(from);
  bird.root.rotation.y = -Math.PI / 2; // 왼쪽으로 날아옴
  win.latch.rotation.z = 0; // 창문은 열린 상태로 아침 시작
  await tween(1.8, (k) => {
    bird.root.position.lerpVectors(from, land, k);
    bird.root.position.y += Math.sin(k * Math.PI) * 0.6;
  });
  flying = false;
  await tween(0.4, (k) => (bird.root.rotation.y = -Math.PI / 2 * (1 - k))); // 방 안(인형들)을 봄
  ctx.toast(`🐦 침실 창문에 ${BIRD_NAMES[kind]}가 찾아왔어요!`);

  // ---------- 2. 인형들이 창문 앞으로 ----------
  const cast: Partial<Record<VillagerId, Spot>> = kind === 'crow'
    ? {
      ddangi: { x: -18.3, where: 'ledge' },
      gamja: { x: -15.9, where: 'ledge' },
      ddamong: { x: -15.0, where: 'bed', z: -2.6 },
      shiba: { x: -17.4, where: 'pillow' },
    }
    : { ddangi: { x: -18.3, where: 'ledge' }, gamja: { x: -15.9, where: 'ledge' } };
  const joined: Villager[] = [];
  const arrivals: Promise<void>[] = [];
  for (const [id, spot] of Object.entries(cast) as [VillagerId, Spot][]) {
    const v = V[id];
    // 수다·싸움 중이면 끝날 때까지 조금 기다렸다가 옴 (너무 오래 붙잡혀 있으면 이번엔 빠짐)
    arrivals.push((async () => {
      for (let t = 0; t < 25 && !free(v); t += 0.5) await wait(0.5);
      if (!free(v)) return;
      joined.push(v);
      await goToSpot(v, spot, ledgeY, win.ledgeZ, land);
    })());
  }
  // 다 모일 때까지 (너무 오래 걸리면 온 사람끼리)
  await Promise.race([Promise.all(arrivals), wait(60)]);
  const here = (id: VillagerId) => joined.includes(V[id]) && !V[id].walking && !V[id].airborne;
  const say = async (id: VillagerId | 'bird', text: string, sec = 2.4) => {
    text = text.replaceAll('{이름}', ctx.playerName);
    if (id === 'bird') return birdSay(text, sec);
    if (!here(id)) return;
    V[id].say(text, sec);
    await wait(sec + 0.1);
  };

  // ---------- 3. 대화 / 까마귀 소동 ----------
  if (kind === 'crow') await runCrow(ctx, bird, say, here, (p) => (pecking = p));
  else for (const [who, text] of LINES[kind]) await say(who, text);

  // ---------- 4. 새는 날아가고, 인형들은 침대로 ----------
  flying = true;
  await tween(0.3, (k) => (bird.root.rotation.y = -Math.PI / 2 * k));
  const out = bird.root.position.clone();
  const away = new THREE.Vector3(win.x0 - 3, ledgeY + 3, sill.z); // 왼쪽 위로 날아감
  await tween(1.6, (k) => {
    bird.root.position.lerpVectors(out, away, k);
    bird.root.position.y += Math.sin(k * Math.PI) * 0.5;
  });
  alive = false;
  await anim;
  bird.root.removeFromParent();
  bubble.sprite.removeFromParent();
  await Promise.all(joined.map((v) => backToBed(v, ledgeY)));
}

/** 까마귀: 땅이 깜짝 · 따몽 "문 열면 위험해!" · 감자 창문 잠금 · 시바 구경 */
async function runCrow(
  ctx: BirdVisitContext,
  bird: Bird,
  say: (id: VillagerId | 'bird', text: string, sec?: number) => Promise<void>,
  here: (id: VillagerId) => boolean,
  setPecking: (p: boolean) => void,
) {
  const { villagers: V, house } = ctx;
  await say('bird', '까악!!', 1.6);
  // 땅이: 깜짝 놀라 뒤로 나자빠짐
  if (here('ddangi')) {
    const d = V.ddangi;
    d.say('꽥?! 까마귀땅!!', 2.4);
    await d.hopTo(new THREE.Vector3(d.position.x + 0.2, BED_Y, -3.2), 0.7);
    d.setPose('lieBack');
    await wait(1.4);
    d.setPose('stand');
  }
  await say('ddamong', '문 열면 위험해!', 2.6);
  // 감자: 창살 아래 잠금 고리를 돌려 잠금
  if (here('gamja')) {
    const g = V.gamja;
    g.char.root.rotation.y = Math.PI;
    await wait(0.4);
    await tween(0.6, (k) => (house.bedWindow.latch.rotation.z = (-Math.PI / 2) * k));
    await say('gamja', '창문 잠갔감자! 딸깍!', 2.4);
  }
  // 시바: 베개 위에서 고개를 갸웃하며 구경
  if (here('shiba')) {
    const s = V.shiba;
    const tilt = (async () => {
      await tween(2.4, (k) => (s.char.body.rotation.z = Math.sin(k * Math.PI * 2) * 0.25));
      s.char.body.rotation.z = 0;
    })();
    await say('shiba', '…까마귀 구경했씨바.', 2.4);
    await tilt;
  }
  setPecking(true);
  await say('bird', '톡톡톡…', 1.8);
  setPecking(false);
  await say('shiba', '멋있었씨바… 까맣고 반짝였씨바.', 2.4);
  await say('bird', '까악!', 1.4);
  await say('ddangi', '…갔땅? 하나도 안 무서웠땅!', 2.4);
  await say('ddamong', '다들 괜찮았따몽?', 2.2);
}

/** 이벤트에 데려갈 수 있는지 (다른 일에 붙잡혀 있지 않음) */
function free(v: Villager) {
  return !v.scripted && !v.engaged && !v.talking && !v.drying && !v.dancing;
}

async function goToSpot(v: Villager, spot: Spot, ledgeY: number, ledgeZ: number, birdAt: THREE.Vector3) {
  v.engaged = true;
  v.interrupt();
  while (v.airborne) await wait(0.1);
  v.setPose('stand');
  v.activity = 'bird';
  v.say(pick(['새다땅!', '손님이다!', '뭔일이래?', '누구지?']), 1.6);
  await v.goTo('bed', 1.6);
  const front = new THREE.Vector3(spot.x, BED_Y, spot.z ?? -3.7);
  await v.walkTo(front);
  if (spot.where !== 'bed') await v.hopTo(new THREE.Vector3(spot.x, PILLOW.y, PILLOW.z));
  if (spot.where === 'ledge') await v.hopTo(new THREE.Vector3(spot.x, ledgeY, ledgeZ));
  // 창밖 새 쪽을 봄
  v.char.root.rotation.y = Math.atan2(birdAt.x - v.position.x, birdAt.z - v.position.z);
}

async function backToBed(v: Villager, ledgeY: number) {
  v.setPose('stand');
  const x = v.position.x;
  if (v.position.y > ledgeY - 0.1) await v.hopTo(new THREE.Vector3(x, PILLOW.y, PILLOW.z));
  if (v.position.y > BED_Y + 0.1) await v.hopTo(new THREE.Vector3(x, BED_Y, -3.4));
  v.place = nearestPlace(v.position);
  v.activity = 'idle';
  v.engaged = false;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
