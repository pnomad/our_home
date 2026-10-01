// 주민 몸과 기본 동작: 걷기, 폴짝, 눕기, 말풍선.
// 무엇을 할지는 life.ts 가 정하고, 여기서는 "어떻게 움직이는지"만 담당한다.
// 동작은 await 로 이어 쓰는 방식이고, 매 프레임 update(dt) 가 진행시킨다.
import * as THREE from 'three';
import type { Character } from './models';
import type { VillagerInfo } from '../data/villagers';
import type { Zone } from '../world/house';
import { findPath, nearestPlace, PLACES, type PlaceId } from '../world/places';
import { applyDance, setArms } from './dance';

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function turnToward(obj: THREE.Object3D, target: number, dt: number, speed = 12) {
  let diff = target - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  obj.rotation.y += diff * Math.min(1, dt * speed);
}

export function createZzz() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7a8cc9';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('Z', 20, 110);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('z', 58, 72);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('z', 88, 40);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.scale.set(0.6, 0.6, 1);
  sprite.position.set(0.45, 1.2, 0);
  sprite.visible = false;
  return sprite;
}

/** 머리 위 말풍선 */
export function createBubble() {
  const W = 440; // 주고받는 대사가 길어도 글자가 찌그러지지 않게 넉넉히
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 11;
  sprite.visible = false;
  sprite.scale.set(1.6 * (W / 320), 0.48, 1);
  const draw = (text: string) => {
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, W, 96);
    g.font = 'bold 34px sans-serif';
    const w = Math.min(W - 20, g.measureText(text).width + 40);
    const x = (W - w) / 2;
    g.fillStyle = '#fffaf0';
    g.strokeStyle = '#e0d2b8';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(x, 6, w, 60, 30);
    g.moveTo(W / 2 - 10, 64);
    g.lineTo(W / 2, 88);
    g.lineTo(W / 2 + 12, 64);
    g.fill();
    g.stroke();
    g.fillStyle = '#5a4630';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, 38, W - 40);
    tex.needsUpdate = true;
  };
  return { sprite, draw };
}

/** 하던 동작이 끊겼을 때 (말 걸기, 싸움에 끌려가기 등) */
export class Interrupt extends Error {}
/** 이벤트 연출이 주민을 가져갈 때 */
class Abort extends Error {}

type Pose = 'stand' | 'lieSide' | 'lieBack';
export type Activity = 'idle' | 'wander' | 'travel' | 'nap' | 'sunbathe' | 'fight' | 'prank' | 'chat' | 'napTogether' | 'dance' | 'bird' | 'read' | 'ball';

/** 최근에 한 일 (대사에 쓰임) */
export interface Memory {
  kind: 'fight' | 'prank' | 'pranked' | 'chat' | 'napTogether' | 'sunbathe';
  with?: Villager;
  at: number; // 누적 게임 시각(분)
  told?: boolean; // 플레이어한테 이미 이야기했는지
}

interface Waiter {
  step: (dt: number) => boolean; // true 면 끝
  resolve: () => void;
  reject: (e: Error) => void;
  interruptible: boolean;
}

export interface World {
  player: THREE.Vector3;
  heightAt(x: number, z: number): number;
}

const PERSONAL_SPACE = 1.1; // 이만큼 가까워지면 비켜 가기 시작
const BODY = 0.75; // 이보다 가까이 붙지는 않음

export class Villager {
  /** 모든 주민 (서로 피해 걷기용) */
  static all: Villager[] = [];
  place: PlaceId;
  activity: Activity = 'idle';
  memories: Memory[] = [];
  /** 싸움·장난 등 다른 주민과 엮여 있는 중 (말 걸기 불가) */
  engaged = false;
  /** 말 거는 중 (움직임 멈춤) */
  talking = false;
  scripted = false;
  /** 빨래 뒤 건조대에서 마르는 중 (움직이지 않지만 말은 걸 수 있음) */
  drying = false;
  /** 라디오 듣고 춤추는 중 (몸 흔들기는 update 에서) */
  dancing = false;
  walking = false;
  airborne = false;
  zzz = createZzz();
  private bubble = createBubble();
  private bubbleTime = 0;
  private waiters: Waiter[] = [];
  private walkTime = 0;
  private phase = Math.random() * 10;
  private pose: Pose = 'stand';
  private world: World | null = null;

  constructor(
    public info: VillagerInfo,
    public char: Character,
    public zone: Zone, // 원래 자리 (냉장고 이벤트 뒤 돌아가는 곳)
  ) {
    char.root.position.set((zone.x0 + zone.x1) / 2, zone.y, (zone.z0 + zone.z1) / 2);
    char.root.add(this.zzz, this.bubble.sprite);
    this.place = nearestPlace(char.root.position);
    Villager.all.push(this);
  }

  get position() {
    return this.char.root.position;
  }

  get isSleeping() {
    return this.activity === 'nap' || this.activity === 'napTogether';
  }

  /** 말 걸 수 있는 상태인지 */
  get talkable() {
    return this.drying || (!this.engaged && !this.airborne && !this.scripted);
  }

  remember(kind: Memory['kind'], at: number, withV?: Villager) {
    this.memories.unshift({ kind, with: withV, at });
    this.memories.length = Math.min(this.memories.length, 8);
  }

  // ---------- 기본 동작 (await 해서 이어 씀) ----------

  /** 매 프레임 step(dt) 를 부르다가 true 가 되면 끝 */
  frames(step: (dt: number) => boolean, interruptible = true) {
    return new Promise<void>((resolve, reject) => this.waiters.push({ step, resolve, reject, interruptible }));
  }

  wait(sec: number) {
    let t = 0;
    return this.frames((dt) => (t += dt) >= sec);
  }

  /** 앞을 막는 것들: 다른 주민 + 플레이어 (같은 높이만) */
  private obstacles() {
    const me = this.position;
    const list = Villager.all.filter((o) => o !== this && !o.scripted && !o.airborne).map((o) => o.position);
    if (this.world) list.push(this.world.player);
    return list.filter((p) => Math.abs(p.y - me.y) < 0.6);
  }

  /** 같은 높이에서 걸어가기. 다른 인형·플레이어는 비켜 가고, 한참 막히면 포기 */
  async walkTo(to: THREE.Vector3, speed = this.info.walkSpeed) {
    const root = this.char.root;
    const pos = root.position;
    this.walking = true;
    let best = Infinity;
    let stuckTime = 0;
    try {
      await this.frames((dt) => {
        const dx = to.x - pos.x;
        const dz = to.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= speed * dt) {
          pos.set(to.x, to.y, to.z);
          return true;
        }
        const others = this.obstacles();
        // 목적지에 이미 누가 있으면 그 앞에서 멈춤
        if (dist < BODY + 0.2 && others.some((o) => Math.hypot(o.x - to.x, o.z - to.z) < BODY)) return true;
        const fx = dx / dist; // 가려는 방향
        const fz = dz / dist;
        let mx = fx;
        let mz = fz;
        // 가까운 인형·플레이어에게서 밀려나면서 옆으로 비켜 감
        for (const o of others) {
          const ox = pos.x - o.x;
          const oz = pos.z - o.z;
          const d = Math.hypot(ox, oz);
          if (d >= PERSONAL_SPACE || d < 0.001) continue;
          const push = (PERSONAL_SPACE - d) / PERSONAL_SPACE;
          // 이미 비켜 있는 쪽으로 계속 비킴 (정면이면 둘 다 자기 왼쪽으로 → 서로 엇갈림)
          const px = -fz;
          const pz = fx;
          const side = ox * px + oz * pz >= 0 ? 1 : -1;
          // 옆으로 비키는 힘을 크게, 뒤로 밀리는 힘은 몸이 닿을 만큼 가까울 때만
          const back = d < BODY ? 1.5 : 0.3;
          mx += (ox / d) * push * back + px * side * push * 1.8;
          mz += (oz / d) * push * back + pz * side * push * 1.8;
        }
        const len = Math.hypot(mx, mz) || 1;
        let nx = pos.x + (mx / len) * speed * dt;
        let nz = pos.z + (mz / len) * speed * dt;
        // 비켜 가다가 가구·벽으로 들어가면 원래 방향으로
        if (this.world && Math.abs(this.world.heightAt(nx, nz) - pos.y) > 0.02) {
          nx = pos.x + (dx / dist) * speed * dt;
          nz = pos.z + (dz / dist) * speed * dt;
        }
        turnToward(root, Math.atan2(nx - pos.x, nz - pos.z), dt, 10);
        pos.x = nx;
        pos.z = nz;
        // 목적지에 가까워지지 않은 채로 2.5초 지나면 포기
        if (dist < best - 0.05) {
          best = dist;
          stuckTime = 0;
        } else if ((stuckTime += dt) > 2.5) {
          return true;
        }
        return false;
      });
    } finally {
      this.walking = false;
    }
  }

  /** 포물선을 그리며 폴짝 (중간에 끊기지 않음) */
  async hopTo(to: THREE.Vector3, sec = 0.6) {
    const root = this.char.root;
    const from = root.position.clone();
    const peak = Math.max(from.y, to.y) + 0.9;
    root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    this.airborne = true;
    let t = 0;
    try {
      await this.frames((dt) => {
        t = Math.min(1, t + dt / sec);
        root.position.x = from.x + (to.x - from.x) * t;
        root.position.z = from.z + (to.z - from.z) * t;
        // 출발 높이 → 꼭대기 → 도착 높이
        root.position.y = t < 0.5
          ? from.y + (peak - from.y) * (1 - (1 - 2 * t) ** 2)
          : peak + (to.y - peak) * (2 * t - 1) ** 2;
        return t >= 1;
      }, false);
    } finally {
      this.airborne = false;
    }
  }

  /** 장소까지 길 찾아 이동 (문 지나고, 가구는 폴짝). hurry 배만큼 빨리 걸음 */
  async goTo(target: PlaceId, hurry = 1) {
    const speed = this.info.walkSpeed * hurry;
    const here = PLACES[this.place];
    // 먼저 지금 장소의 기준점으로 (같은 높이일 때만)
    if (target !== this.place && Math.abs(here.p.y - this.position.y) < 0.05 && this.position.distanceTo(here.p) > 0.2) {
      await this.walkTo(here.p, speed);
    }
    for (const id of findPath(this.place, target)) {
      const p = PLACES[id].p;
      if (Math.abs(p.y - this.position.y) < 0.05) await this.walkTo(p, speed);
      else {
        await this.hopTo(p);
        await this.stepAside();
      }
      this.place = id;
    }
  }

  /** 내려선 자리에 누가 있으면 살짝 비킴 */
  async stepAside() {
    const me = this.position;
    const o = this.obstacles().find((p) => Math.hypot(p.x - me.x, p.z - me.z) < BODY);
    if (!o || !this.world) return;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const to = me.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.9));
      if (Math.abs(this.world.heightAt(to.x, to.z) - me.y) < 0.02 && Math.hypot(o.x - to.x, o.z - to.z) > BODY) {
        await this.walkTo(to);
        return;
      }
    }
  }

  setPose(pose: Pose) {
    this.pose = pose;
    this.char.body.rotation.set(pose === 'lieBack' ? -Math.PI / 2 : 0, 0, pose === 'lieSide' ? Math.PI / 2 : 0);
    this.char.body.position.x = 0;
    setArms(this.char, 0);
    this.zzz.visible = false;
  }

  /** 머리 위 말풍선 */
  say(text: string, sec = 2.2) {
    this.bubble.draw(text);
    this.bubble.sprite.visible = true;
    this.bubbleTime = sec;
  }

  // ---------- 제어 ----------

  /** 하던 동작을 끊음 (끊을 수 있는 동작만) */
  interrupt() {
    const keep: Waiter[] = [];
    for (const w of this.waiters) {
      if (w.interruptible) w.reject(new Interrupt());
      else keep.push(w);
    }
    this.waiters = keep;
  }

  startTalk() {
    this.talking = true;
    this.interrupt();
    if (this.isSleeping) this.setPose('stand');
  }

  endTalk() {
    this.talking = false;
  }

  /** 이벤트 연출이 주민을 가져가거나(true) 돌려줌(false) */
  setScripted(on: boolean) {
    this.scripted = on;
    for (const w of this.waiters) w.reject(new Abort());
    this.waiters = [];
    this.engaged = false;
    this.walking = false;
    this.airborne = false;
    this.setPose('stand');
    this.activity = 'idle';
    this.bubble.sprite.visible = false;
    if (!on) this.place = nearestPlace(this.position);
  }

  /** 할 일 고르기(next)를 계속 반복 */
  async live(next: (v: Villager) => Promise<void>) {
    for (;;) {
      try {
        if (this.scripted) await new Promise((r) => setTimeout(r, 300));
        else if (this.engaged) await this.frames(() => !this.engaged, false);
        else await next(this);
      } catch (e) {
        if (!(e instanceof Interrupt || e instanceof Abort)) {
          console.error(e);
          await new Promise((r) => setTimeout(r, 1000));
        }
        // 다른 주민이 데려간 경우(engaged)엔 그쪽 연출이 자세·상태를 정함
        if (!this.engaged && !this.scripted) {
          this.setPose('stand');
          this.activity = 'idle';
        }
      }
    }
  }

  update(dt: number, t: number, world: World) {
    this.world = world;
    const root = this.char.root;
    const body = this.char.body;

    if (!this.talking && !this.scripted) {
      const running = this.waiters;
      this.waiters = [];
      for (const w of running) {
        let done = false;
        try {
          done = w.step(dt);
        } catch (e) {
          w.reject(e as Error);
          continue;
        }
        if (done) w.resolve();
        else this.waiters.push(w);
      }
    }
    if (this.talking) {
      turnToward(root, Math.atan2(world.player.x - root.position.x, world.player.z - root.position.z), dt);
    }

    // 말풍선
    if (this.bubble.sprite.visible) {
      this.bubbleTime -= dt;
      this.bubble.sprite.position.y = this.pose === 'stand' ? 2.2 : 1.75; // 이름표 위
      if (this.bubbleTime <= 0) this.bubble.sprite.visible = false;
    }

    // 몸 애니메이션: 걷기 통통 / 서서 숨쉬기 / 누워서 천천히 숨쉬기
    const lying = this.pose !== 'stand';
    if (this.dancing && !this.walking && !this.talking) {
      applyDance(this.info.id, this.char, t + this.phase * 0.02);
    } else if (this.walking) {
      this.walkTime += dt;
      body.position.y = Math.abs(Math.sin(this.walkTime * this.info.walkSpeed * 7)) * 0.08;
      body.scale.set(1, 1, 1);
    } else {
      this.walkTime = 0;
      body.position.y = lying ? 0.33 : 0;
      const speed = lying ? 1.2 : 3;
      const amt = lying ? 0.05 : 0.04;
      const s = Math.sin(t * speed + this.phase);
      body.scale.set(1 + s * amt * 0.6, 1 - s * amt, 1 + s * amt * 0.6);
    }
    if (this.zzz.visible) {
      this.zzz.position.y = (lying ? 0.9 : 1.2) + Math.sin(t * 1.5) * 0.06;
      this.zzz.material.opacity = 0.6 + Math.sin(t * 2) * 0.3;
    }
  }
}
