// 주민들의 하루: 시간·성격에 따라 할 일을 고르고, 형제끼리 어울린다.
//   ☀️ 오전 10시~오후 4시: 침대에 들어오는 햇빛에 벌러덩 누워 빠삭~
//   낮잠, 집 안 돌아다니기, 형제 찾아가서 싸움 / 장난 / 같이 낮잠 / 수다
//   밤 10시 이후: 침대나 소파에서 잠
//   📻 라디오가 켜져 있으면: 다 같이 거실 테이블 앞에 모여 춤
import * as THREE from 'three';
import { Villager, rand } from './villager';
import { HANGOUTS, randomSpot, type PlaceId } from '../world/places';
import { pick, CHATS } from '../data/villagers';
import type { GameClock } from '../world/clock';

export interface LifeContext {
  clock: GameClock;
  villagers: Villager[];
  heightAt(x: number, z: number): number;
  /** 라디오 앞 춤추는 자리 (인형 수만큼, 거실 바닥) */
  danceSpots: THREE.Vector3[];
}

const SUN_START = 10 * 60;
const SUN_END = 16 * 60;

export function isSunny(minutes: number) {
  return minutes >= SUN_START && minutes < SUN_END;
}

/** 날짜까지 합친 게임 시각(분) — 기억이 "방금"인지 따질 때 씀 */
export function nowMinutes(clock: GameClock) {
  return clock.day * 24 * 60 + clock.minutes;
}

/** 가중치대로 하나 고르기 */
function choose<T>(options: [number, T][]): T {
  const total = options.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of options) {
    if ((r -= w) <= 0) return v;
  }
  return options[options.length - 1][1];
}

/** 다른 주민과 엮일 수 있는 상태인지 */
function available(v: Villager) {
  return !v.engaged && !v.talking && !v.scripted && !v.airborne;
}

export function createLife(ctx: LifeContext) {
  const { clock, villagers } = ctx;
  /** 장소 안 빈자리: 몇 군데 뽑아서 다른 주민과 제일 먼 곳 */
  const spot = (id: PlaceId, self?: Villager) => {
    let best = randomSpot(id, ctx.heightAt);
    let bestD = -1;
    for (let i = 0; i < 8; i++) {
      const p = randomSpot(id, ctx.heightAt);
      const d = Math.min(99, ...villagers.filter((o) => o !== self).map((o) => o.position.distanceTo(p)));
      if (d > bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  };
  const now = () => nowMinutes(clock);
  /** 개발용 기록: 누가 누구와 뭘 했는지 / 왜 못 했는지 */
  const log: string[] = [];
  const note = (s: string) => {
    log.push(`[${clock.timeLabel()}] ${s}`);
    if (log.length > 50) log.shift();
  };
  /** 테스트용: 다음에 할 일 예약 */
  const queued = new Map<Villager, () => Promise<void>>();
  let radioOn = false;

  // ---------- 혼자 하는 일 ----------

  async function hangOut(v: Villager, place: PlaceId, rounds = Math.floor(rand(2, 5))) {
    v.activity = 'travel';
    await v.goTo(place);
    v.activity = 'wander';
    for (let i = 0; i < rounds; i++) {
      if (radioOn) return; // 폴짝 중이라 라디오 소리를 못 끊었으면 여기서 춤추러
      await v.walkTo(spot(place));
      if (Math.random() < 0.3) v.say(pick(v.info.bubbles.idle));
      await v.wait(rand(1.5, 4));
    }
  }

  async function nap(v: Villager, place: PlaceId, sec = rand(20, 45)) {
    v.activity = 'travel';
    await v.goTo(place);
    if (radioOn) return;
    await v.walkTo(spot(place, v));
    v.activity = 'nap';
    v.setPose('lieSide');
    v.zzz.visible = true;
    await v.wait(sec);
    v.setPose('stand');
  }

  async function sunbathe(v: Villager) {
    v.activity = 'travel';
    await v.goTo('bed');
    if (radioOn) return;
    await v.walkTo(spot('bed', v));
    await sunbatheHere(v);
  }

  /** 지금 자리에 벌러덩 누워 빠삭~ */
  async function sunbatheHere(v: Villager) {
    v.activity = 'sunbathe';
    v.setPose('lieBack');
    v.say(pick(v.info.bubbles.sunbathe));
    const end = now() + rand(40, 90);
    while (now() < end && isSunny(clock.minutes)) {
      await v.wait(rand(4, 8));
      if (Math.random() < 0.6) v.say(pick(v.info.bubbles.sunbathe));
    }
    v.remember('sunbathe', now());
    v.setPose('stand');
  }

  /** 라디오 앞 제자리로 가서 라디오가 꺼질 때까지 춤 */
  async function danceParty(v: Villager) {
    v.activity = 'travel';
    await v.goTo('living', 1.8); // 노래 나오면 신나서 뛰어옴
    const spot = ctx.danceSpots[villagers.indexOf(v) % ctx.danceSpots.length];
    await v.walkTo(spot, v.info.walkSpeed * 1.8);
    v.char.root.rotation.y = 0; // 카메라 쪽을 보고
    v.activity = 'dance';
    v.dancing = true;
    try {
      while (radioOn) {
        await v.wait(rand(3, 6));
        if (radioOn && Math.random() < 0.35) v.say(pick(v.info.bubbles.dance), 2);
      }
    } finally {
      v.dancing = false;
      v.setPose('stand');
    }
  }

  // ---------- 형제와 어울리기 ----------

  /** a 가 b 에게 가서 (도착했을 때 b 가 그대로면) 뭔가 함 */
  async function visit(a: Villager, b: Villager) {
    a.activity = 'travel';
    await a.goTo(b.place);
    if (a.engaged || radioOn) return; // 가는 사이에 다른 형제가 먼저 붙잡음 → 그쪽 연출을 따름
    if (a.place !== b.place || !available(b) || !available(a) || a.position.distanceTo(b.position) > 6) {
      note(`${a.info.name} → ${b.info.name} 찾아갔는데 없음 (${b.info.name}@${b.place})`);
      await hangOut(a, a.place, 1);
      return;
    }
    note(`${a.info.name} → ${b.info.name} (${b.isSleeping ? '자는 중' : b.activity})`);
    // 빠삭 중인 형제한테 가면 대개 옆에 같이 누움 (b 는 그대로 빠삭)
    if (b.activity === 'sunbathe' && isSunny(clock.minutes) && Math.random() < 0.75) {
      await approach(a, b, 0.9);
      a.say('나도 빠삭!', 1.8);
      await sunbatheHere(a);
      return;
    }
    // 둘 다 붙잡고 시작 (b 는 하던 일을 멈춤)
    a.engaged = b.engaged = true;
    b.interrupt();
    try {
      if (b.isSleeping) {
        if (a.info.id === 'ddangi' || Math.random() < 0.3) await prank(a, b);
        else await napTogether(a, b);
      } else if (Math.random() < a.info.likes.fight * 0.5 + b.info.likes.fight * 0.2) {
        await fight(a, b);
      } else {
        await chat(a, b);
      }
    } finally {
      a.engaged = b.engaged = false;
    }
  }

  /** b 옆으로 걸어감 */
  async function approach(a: Villager, b: Villager, gap = 0.95) {
    const dir = a.position.clone().sub(b.position).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize().multiplyScalar(gap);
    const target = b.position.clone().add(dir);
    if (Math.abs(ctx.heightAt(target.x, target.z) - b.position.y) > 0.02) target.copy(b.position).addScaledVector(dir, -1);
    await a.walkTo(target);
  }

  function faceEachOther(a: Villager, b: Villager) {
    a.char.root.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
    b.char.root.rotation.y = Math.atan2(a.position.x - b.position.x, a.position.z - b.position.z);
  }

  /** 상대 쪽으로 콩 부딪히기 */
  async function bump(a: Villager, b: Villager) {
    const from = a.position.clone();
    const dir = b.position.clone().sub(from).setY(0).normalize();
    let t = 0;
    await a.frames((dt) => {
      t = Math.min(1, t + dt / 0.35);
      const k = Math.sin(t * Math.PI);
      a.position.copy(from).addScaledVector(dir, k * 0.3);
      a.position.y = from.y + k * 0.25;
      return t >= 1;
    }, false);
    a.position.copy(from);
  }

  async function fight(a: Villager, b: Villager) {
    a.activity = b.activity = 'fight';
    b.setPose('stand');
    await approach(a, b, 0.9);
    faceEachOther(a, b);
    // a 가 따지고 → b 가 받아치고 → 서로 한마디씩
    for (let i = 0; i < 4; i++) {
      const [x, y] = i % 2 ? [b, a] : [a, b];
      const lines = i === 0 ? x.info.bubbles.fightStart : i === 1 ? x.info.bubbles.fightBack : x.info.bubbles.fight;
      // 붙어 서 있어서 말풍선이 겹치지 않게, 앞사람 말풍선이 사라진 뒤에 받아침
      x.say(pick(lines), 1.5);
      await bump(x, y);
      await x.wait(1.25);
    }
    // 한 명이 삐져서 돌아섬
    const [loser, winner] = Math.random() < 0.5 ? [a, b] : [b, a];
    loser.say('흥!', 1.5);
    loser.char.root.rotation.y += Math.PI;
    await a.wait(1.6);
    winner.say(pick(winner.info.bubbles.fight), 2);
    await a.wait(2);
    a.remember('fight', now(), b);
    b.remember('fight', now(), a);
  }

  /** 자는 b 에게 몰래 장난 → b 가 깨서 쫓아감 */
  async function prank(a: Villager, b: Villager) {
    a.activity = 'prank';
    a.say('쉿…', 1.5);
    await approach(a, b, 0.8);
    faceEachOther(a, b);
    await a.wait(0.8);
    a.say(b.info.id === 'shiba' ? '(꼬리 쭈욱!)' : '(쿡!)', 1.6);
    await bump(a, b);
    b.setPose('stand');
    b.activity = 'idle';
    b.char.root.rotation.y = Math.atan2(a.position.x - b.position.x, a.position.z - b.position.z);
    b.say(b.info.id === 'shiba' ? '뭔일이래?!' : '무슨 일이데오?!', 2);
    await b.wait(0.8);
    // 도망가는 a, 쫓아가는 b
    a.say('헤헤헤~', 2);
    const away = spot(a.place);
    const run = a.walkTo(away, a.info.walkSpeed * 1.6);
    await b.wait(0.3);
    const chase = b.walkTo(a.position.clone().lerp(away, 0.6), b.info.walkSpeed * 1.3);
    await Promise.all([run, chase]);
    b.say(b.info.id === 'shiba' ? '거기 서씨바!!' : pick(b.info.bubbles.fight), 2);
    a.remember('prank', now(), b);
    b.remember('pranked', now(), a);
  }

  /** 자는 b 옆에 누워서 같이 낮잠 */
  async function napTogether(a: Villager, b: Villager) {
    a.activity = b.activity = 'napTogether';
    await approach(a, b, 0.85);
    a.setPose('lieSide');
    a.zzz.visible = true;
    await a.wait(rand(20, 35));
    a.setPose('stand');
    b.setPose('stand');
    a.remember('napTogether', now(), b);
    b.remember('napTogether', now(), a);
  }

  async function chat(a: Villager, b: Villager) {
    a.activity = b.activity = 'chat';
    b.setPose('stand');
    await approach(a, b, 1.0);
    faceEachOther(a, b);
    // 짝끼리 주고받는 대본이 있으면 그대로, 없으면 번갈아 한마디씩
    const scripts = CHATS.filter((c) => c.pair.includes(a.info.id) && c.pair.includes(b.info.id));
    const lines: [Villager, string][] = scripts.length
      ? pick(scripts).lines.map(([id, text]) => [id === a.info.id ? a : b, text])
      : [0, 1, 2, 3].map((i) => (i % 2 ? [b, pick(b.info.bubbles.chat)] : [a, pick(a.info.bubbles.chat)]));
    for (const [x, text] of lines) {
      x.say(text, 2.3);
      await a.wait(2.4);
    }
    a.remember('chat', now(), b);
    b.remember('chat', now(), a);
  }

  // ---------- 할 일 고르기 ----------

  const softPlaceFor = (v: Villager): PlaceId => (v.info.home === 'sofa' ? 'sofa' : Math.random() < 0.5 ? 'bed' : 'sofa');

  async function next(v: Villager) {
    v.setPose('stand'); // 누워 있다가 다른 일로 넘어가면 먼저 일어남
    const plan0 = queued.get(v);
    if (plan0) {
      queued.delete(v);
      await plan0();
      return;
    }
    if (radioOn) {
      await danceParty(v);
      return;
    }
    const m = clock.minutes;
    const likes = v.info.likes;
    const others = villagers.filter((o) => o !== v && available(o));
    // 같은 장소 가까이에 있는 형제 (바로 어울릴 수 있음)
    const nearby = others.filter((o) => o.place === v.place && o.position.distanceTo(v.position) < 5);

    // 밤 10시 넘으면 다들 잠 (냉장고 이벤트 전까지)
    if (m >= 22 * 60) {
      await nap(v, softPlaceFor(v), rand(40, 80));
      return;
    }
    const justSunbathed = v.memories.some((mem) => mem.kind === 'sunbathe' && now() - mem.at < 60);
    const afternoon = m >= 13 * 60 && m < 18 * 60;

    const plan = choose<() => Promise<void>>([
      [isSunny(m) ? (justSunbathed ? likes.sunbathe * 0.4 : likes.sunbathe * 2) : 0, () => sunbathe(v)],
      [likes.nap * (afternoon ? 1.5 : 1), () => nap(v, softPlaceFor(v))],
      [2, () => hangOut(v, v.info.home)],
      [likes.roam, () => hangOut(v, pick(HANGOUTS))],
      [others.length ? likes.visit * 1.5 : 0, () => visit(v, pick(others))],
      [nearby.length ? 4 + likes.visit : 0, () => visit(v, pick(nearby))],
      [v.info.id === 'ddangi' ? 0.6 : 0.1, () => hangOut(v, 'fridge', 2)], // 냉장고 기웃기웃
    ]);
    await plan();
  }

  return {
    log,
    /** 테스트용: a 가 다음에 b 를 찾아가게 함 */
    queueVisit(a: Villager, b: Villager) {
      queued.set(a, () => visit(a, b));
      a.interrupt();
    },
    start() {
      for (const v of villagers) v.live(next);
    },
    get radioOn() {
      return radioOn;
    },
    /** 라디오 켜기/끄기: 하던 일을 멈추고 춤추러 가거나, 춤을 멈추고 평소대로 */
    setRadio(on: boolean) {
      radioOn = on;
      for (const v of villagers) {
        if (on ? available(v) || v.isSleeping : v.dancing || v.activity === 'travel') v.interrupt();
      }
    },
  };
}

/** 햇빛 세기 (0~1): 10시쯤 들어오기 시작해서 4시쯤 사라짐 */
export function sunStrength(minutes: number) {
  const s = THREE.MathUtils.smoothstep(minutes, SUN_START - 30, SUN_START + 30);
  const e = 1 - THREE.MathUtils.smoothstep(minutes, SUN_END - 30, SUN_END + 30);
  return s * e;
}
