// 밤 이벤트들이 같이 쓰는 것: 연출 도구(트윈, 폴짝, 걷기)와 잠들기 · 다음 날 아침 장면.
import * as THREE from 'three';
import type { Character } from '../entities/models';
import { createZzz, type Villager } from '../entities/villager';
import type { VillagerId } from '../entities/styles';
import type { House } from '../world/house';
import type { Lighting } from '../world/lighting';
import type { DialogueBox, Speaker } from '../ui/dialogue';
import type { Fade } from '../ui/fade';

export interface EventContext {
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

export const NARRATOR: Speaker = { name: '', order: '', color: '' };

export const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
export const wait = (sec: number) => new Promise((r) => setTimeout(r, sec * 1000));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** sec초 동안 k(0→1)로 fn을 부름 */
export async function tween(sec: number, fn: (k: number) => void, easing = ease) {
  const start = performance.now();
  for (;;) {
    const k = Math.min(1, (performance.now() - start) / 1000 / sec);
    fn(easing(k));
    if (k >= 1) return;
    await frame();
  }
}

export function face(obj: THREE.Object3D, to: THREE.Vector3) {
  obj.rotation.y = Math.atan2(to.x - obj.position.x, to.z - obj.position.z);
}

/** 포물선을 그리며 폴짝 */
export async function hop(obj: THREE.Object3D, to: THREE.Vector3, sec = 0.55, height = 0.8, spin = 0) {
  const from = obj.position.clone();
  const ry = obj.rotation.y;
  await tween(sec, (k) => {
    obj.position.lerpVectors(from, to, k);
    obj.position.y += 4 * height * k * (1 - k);
    obj.rotation.y = ry + spin * k;
  }, (k) => k);
}

export async function walk(v: Villager, to: THREE.Vector3, speed = 2.2) {
  const obj = v.char.root;
  face(obj, to);
  const from = obj.position.clone();
  v.walking = true;
  await tween(from.distanceTo(to) / speed, (k) => obj.position.lerpVectors(from, to, k), (k) => k);
  v.walking = false;
}

/** 캐릭터 키 (납작하게 줄인 것도 반영) */
export function heightOf(c: Character) {
  c.root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(c.body).max.y - c.root.position.y;
}

export function sayer(dialogue: DialogueBox) {
  return (v: Villager | Speaker | null, ...pages: string[]) =>
    dialogue.play(!v ? NARRATOR : 'info' in v ? v.info : v, [{ pages }]);
}

/** 암전 → 밤 → 플레이어는 침대에 눕고 인형들은 연출 차지. 돌려받은 zzz는 wakeUp 에 넘김 */
export async function fallAsleep(ctx: EventContext) {
  const { player, lighting, fade } = ctx;
  const playerZzz = createZzz();
  await fade.out('쿨… 쿨…');
  await wait(0.8);
  lighting.setNight(true);
  player.root.position.set(-16.3, 1.85, -3.4);
  player.root.rotation.set(-Math.PI / 2, 0, 0);
  player.root.add(playerZzz);
  playerZzz.visible = true;
  playerZzz.position.set(0.4, 0.4, 0.9);
  ctx.setNameTags(false);
  for (const v of Object.values(ctx.villagers)) v.setScripted(true);
  return playerZzz;
}

/** 다음 날 아침: 인형들은 제자리로, 플레이어는 침대 가장자리에서 깸. 화면이 밝아지기 직전에 prepare 실행 */
export async function wakeUp(ctx: EventContext, playerZzz: THREE.Object3D, prepare?: () => void) {
  const { player, fade } = ctx;
  const day = ctx.nextDay();
  await fade.out(`${day}일째 아침 ☀️`);
  await wait(1.2);
  for (const v of Object.values(ctx.villagers)) {
    const z = v.zone;
    v.char.root.position.set((z.x0 + z.x1) / 2, z.y, (z.z0 + z.z1) / 2);
    v.char.root.rotation.set(0, 0, 0);
    v.char.root.scale.set(1, 1, 1);
    v.char.root.visible = true;
    v.setScripted(false);
  }
  prepare?.();
  player.root.remove(playerZzz);
  player.root.rotation.set(0, 0, 0);
  player.root.position.set(-13.8, 1.6, -1.2); // 침대 가장자리에서 깸 (가운데는 시바 자리)
  ctx.setNameTags(true);
  ctx.setCamera(null, 1, true);
  await wait(0.5);
  await fade.in();
}

/** 아무 일도 없는 밤 */
export async function runQuietNight(ctx: EventContext) {
  const zzz = await fallAsleep(ctx);
  await wait(1.2);
  await wakeUp(ctx, zzz);
}
