import * as THREE from 'three';
import { createHouse, HOP_HEIGHT, JUMP_HEIGHT } from './world/house';
import { createNameTag } from './entities/models';
import { createPlayerCharacter, createVillager, styleFromUrl, PLAYER_NAMES, type PlayerId, type VillagerId } from './entities/styles';
import { choosePlayer } from './ui/chooser';
import { Villager, turnToward, type World } from './entities/villager';
import { VILLAGERS, greetingFor, fillNames, pick, type Talk, type MemoryTalkKind } from './data/villagers';
import { createLife, nowMinutes, sunStrength } from './entities/life';
import { DialogueBox, createActionButton } from './ui/dialogue';
import { createFade } from './ui/fade';
import { createLighting } from './world/lighting';
import { createClock } from './world/clock';
import { createClockHud } from './ui/hud';
import { runFridgeRaid } from './events/fridgeRaid';
import { runCatFight } from './events/catFight';
import { runLaundry, finishDrying } from './events/laundry';
import { runQuietNight, NARRATOR, type EventContext } from './events/common';
import { getMoveInput } from './input';

const PLAYER_SPEED = 4; // 칸/초
const PLAYER_RADIUS = 0.3;
const GRAVITY = 30;
const JUMP_SPEED = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);

// ---------- 렌더러 · 씬 · 조명 ----------
const container = document.getElementById('game')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const lighting = createLighting(scene);
const { sun } = lighting;
const clock = createClock(); // 게임 시계 (하루 = 실제 20분)
const clockHud = createClockHud();
lighting.setTime(clock.minutes);

// 동숲처럼 비스듬히 내려다보는 카메라
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const CAMERA_OFFSET = new THREE.Vector3(0, 14, 12);
// 줌: 마우스 휠 (주소 뒤에 ?zoom=0.4 처럼 시작 배율 지정 가능)
let zoom = Number(new URLSearchParams(location.search).get('zoom')) || 1;
// 이벤트 연출 중에는 카메라가 플레이어 대신 이 지점을 봄
let cameraOverride: { focus: THREE.Vector3; zoom: number } | null = null;
let snapCamera = false; // 다음 프레임에 카메라를 부드럽게 말고 바로 이동
window.addEventListener('wheel', (e) => {
  zoom = THREE.MathUtils.clamp(zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.35, 1.6);
}, { passive: true });

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- 월드 ----------
const house = createHouse();
scene.add(house.group);

// 누구로 놀지 고른 다음 그 인형을 만든다
const who: PlayerId = await choosePlayer();
const other: PlayerId = who === 'ttungttaengi' ? 'ttungsuni' : 'ttungttaengi';
const player = createPlayerCharacter(who);
player.root.add(createNameTag(PLAYER_NAMES[who], 1.55));
player.root.position.copy(house.spawn);
scene.add(player.root);
let vy = 0; // 위아래 속도
let grounded = true;

/** 인형 발 밑(몸 너비만큼)에서 가장 높은 면 */
function groundUnder(x: number, z: number) {
  const r = PLAYER_RADIUS;
  return Math.max(
    house.heightAt(x - r, z - r), house.heightAt(x + r, z - r),
    house.heightAt(x - r, z + r), house.heightAt(x + r, z + r),
  );
}

/** 그 위치로 갈 수 있는지: 땅에선 저절로 폴짝 오를 높이까지, 공중에선 발이 걸리지 않는 높이까지 */
function canStep(x: number, z: number) {
  const g = groundUnder(x, z);
  const y = player.root.position.y;
  return grounded ? g - y <= HOP_HEIGHT : g <= y + 0.15;
}

function jump() {
  if (!grounded || dialogue.isOpen || cutscene) return;
  vy = JUMP_SPEED;
  grounded = false;
}

// 캐릭터 스타일: 주소 뒤 ?style=block | plush | voxel
const style = styleFromUrl();
const ids: VillagerId[] = ['ddangi', 'ddamong', 'shiba', 'gamja'];
const nameTags: THREE.Sprite[] = [];
const villagers = ids.map((id) => {
  const v = new Villager(VILLAGERS[id], createVillager(id, style), house.zones[id]);
  const tag = createNameTag(v.info.name, 1.75);
  nameTags.push(tag);
  v.char.root.add(tag);
  scene.add(v.char.root);
  return v;
});
// 주민들이 알아서 돌아다니며 빠삭·낮잠·싸움·장난을 시작
const life = createLife({ clock, villagers, heightAt: house.heightAt });
life.start();

// ---------- 대화 ----------
const TALK_DISTANCE = 1.7;
const dialogue = new DialogueBox();
const actionButton = createActionButton(() => doAction());
const fade = createFade();
const greeted = new Set<VillagerId>();
let cutscene = false; // 이벤트 연출 중이면 조작 막음
let raidDone = false; // 냉장고 털기 다음 날
const heardAfterRaid = new Set<VillagerId>();
// 고양이 소동 → 꼬질꼬질 → 네 명 다 이야기 들으면 빨래 → 건조대에서 마름 → 뽀송
let needsWash = false;
const heardCatFight = new Set<VillagerId>();
let dryUntil = -1; // 다 마르는 게임 시각(분), -1 이면 말리는 중 아님
const DRY_MINUTES = 90;
let washed = false;
const heardAfterWash = new Set<VillagerId>();
const talkBags = new Map<VillagerId, Talk[]>();

function nearestVillager() {
  let best: Villager | null = null;
  let bestDist = TALK_DISTANCE;
  for (const v of villagers) {
    if (!v.talkable) continue; // 싸움·장난 중이거나 점프 중이면 말 걸 수 없음
    const p = player.root.position;
    // 건조대에 널린 인형은 바닥에서 올려다보며 말 걸기 (높이 차이 무시)
    const d = v.drying ? Math.hypot(v.position.x - p.x, v.position.z - p.z) : v.position.distanceTo(p);
    if (d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

const FRESH_MINUTES = 120; // 게임 시간 2시간 안에 있었던 일이면 "방금"

/** 방금 있었던 일 중 아직 이야기 안 한 것 */
function freshMemoryTalk(v: Villager): { talk: Talk; friend: string } | null {
  for (const mem of v.memories) {
    if (mem.told || nowMinutes(clock) - mem.at > FRESH_MINUTES || !mem.with) continue;
    const kind: MemoryTalkKind | null =
      mem.kind === 'prank' ? (mem.with.info.id === 'shiba' ? 'prankShiba' : 'prank')
      : mem.kind === 'chat' || mem.kind === 'sunbathe' ? null
      : mem.kind;
    const talk = kind && v.info.memory[kind];
    if (!talk) continue;
    mem.told = true;
    return { talk, friend: mem.with.info.name };
  }
  return null;
}

/** 상황에 맞는 대사 고르기 (순서는 data/villagers.ts 맨 위 설명 참고) */
function nextTalk(v: Villager): { talk: Talk; friend?: string } {
  if (raidDone && !heardAfterRaid.has(v.info.id)) {
    heardAfterRaid.add(v.info.id);
    return { talk: v.info.afterRaid };
  }
  if (needsWash && !heardCatFight.has(v.info.id)) {
    heardCatFight.add(v.info.id);
    return { talk: v.info.afterCatFight };
  }
  if (v.drying) return { talk: v.info.drying };
  if (washed && !heardAfterWash.has(v.info.id)) {
    heardAfterWash.add(v.info.id);
    return { talk: v.info.afterWash };
  }
  if (v.activity === 'sunbathe') return { talk: pick(v.info.sunbathe) };
  const memory = freshMemoryTalk(v);
  if (memory) return memory;
  if (!greeted.has(v.info.id)) {
    greeted.add(v.info.id);
    return { talk: greetingFor(v.info, clock.hour) };
  }
  const placeTalks = v.info.places[v.place];
  if (placeTalks && Math.random() < 0.4) return { talk: pick(placeTalks) };
  let bag = talkBags.get(v.info.id);
  if (!bag || bag.length === 0) {
    bag = [...v.info.talks].sort(() => Math.random() - 0.5);
    talkBags.set(v.info.id, bag);
  }
  return { talk: bag.pop()! };
}

async function talkTo(v: Villager | null) {
  if (!v || dialogue.isOpen || !v.talkable) return;
  const wasSleeping = v.isSleeping;
  const { talk, friend } = nextTalk(v); // 말 걸기 전 상황(빠삭 중 등)으로 고름
  v.startTalk();
  actionButton.show(null);
  const names = { 이름: PLAYER_NAMES[who], 상대: PLAYER_NAMES[other], 친구: friend };
  const talks = (wasSleeping ? [v.info.wakeUp, talk] : [talk]).map((t) => fillNames(t, names));
  await dialogue.play(v.info, talks);
  v.endTalk();
  if (readyToWash() && heardCatFight.has(v.info.id) && talk === v.info.afterCatFight) {
    await dialogue.play(NARRATOR, [{ pages: ['다들 흙먼지 투성이다…', '오늘은 씻는 날! 🫧', '(부엌 세탁기 앞에서 빨래를 할 수 있어요)'] }]);
  }
}

/** 네 명 모두에게 고양이 이야기를 들었으면 빨래 가능 */
function readyToWash() {
  return needsWash && heardCatFight.size === villagers.length;
}

/** 세탁기 앞 바닥에 서 있는지 */
function nearWasher() {
  const p = player.root.position;
  const f = house.washer.front;
  return grounded && p.y < 0.1 && Math.hypot(p.x - f.x, p.z - f.z) < 1.8;
}

async function doLaundry() {
  cutscene = true;
  actionButton.show(null);
  await runLaundry(eventContext());
  needsWash = false;
  heardCatFight.clear();
  dryUntil = nowMinutes(clock) + DRY_MINUTES;
  cutscene = false;
}

/** 다 말랐으면 건조대에서 내려옴 */
function dryDone(instant = false) {
  dryUntil = -1;
  washed = true;
  heardAfterWash.clear();
  return finishDrying(villagers, house.rack, instant);
}

/** 침대 위에 서 있는지 */
function onBed() {
  const p = player.root.position;
  const b = house.bed;
  return grounded && Math.abs(p.y - b.y) < 0.05 && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
}

async function goToSleep() {
  if (!clock.isNight()) {
    await dialogue.play({ name: '', order: '', color: '' }, [{ pages: ['아직 밤이 아니라 잠이 안 온다…', '(밤 9시부터 잘 수 있어요)'] }]);
    return;
  }
  await sleepAndRaid();
}

/** 새벽 2시까지 안 자면 그 자리에서 스르륵 */
async function passOut() {
  cutscene = true;
  await fade.out('너무 늦게까지 놀다가… 스르륵 잠들어 버렸다');
  await new Promise((r) => setTimeout(r, 1500));
  await sleepAndRaid();
}

function eventContext(): EventContext {
  return {
    house, player, dialogue, lighting, fade,
    villagers: Object.fromEntries(villagers.map((v) => [v.info.id, v])) as Record<VillagerId, Villager>,
    setCamera(focus, z = 1, snap = false) {
      cameraOverride = focus ? { focus, zoom: z } : null;
      snapCamera = snap;
    },
    setNameTags(visible) {
      for (const t of nameTags) t.visible = visible;
    },
    nextDay() {
      const day = clock.nextDay();
      lighting.setTime(clock.minutes);
      return day;
    },
  };
}

type NightEvent = 'fridge' | 'cat' | 'none';
/** 밤 이벤트는 각각 10% 확률 (테스트용: 주소 뒤 ?event=fridge | cat | none 으로 고정) */
function pickNightEvent(): NightEvent {
  const forced = new URLSearchParams(location.search).get('event');
  if (forced === 'fridge' || forced === 'cat' || forced === 'none') return forced;
  const r = Math.random();
  return r < 0.1 ? 'fridge' : r < 0.2 ? 'cat' : 'none';
}

/** 잠들면 (가끔) 밤 이벤트 → 다음 날 아침 */
async function sleepAndRaid() {
  cutscene = true;
  actionButton.show(null);
  if (dryUntil >= 0) await dryDone(true); // 건조대에 널린 채로 밤이 되면 그냥 다 마른 걸로
  const night = pickNightEvent();
  const ctx = eventContext();
  if (night === 'fridge') await runFridgeRaid(ctx);
  else if (night === 'cat') await runCatFight(ctx);
  else await runQuietNight(ctx);
  raidDone = night === 'fridge';
  heardAfterRaid.clear();
  if (night === 'cat') {
    needsWash = true;
    heardCatFight.clear();
  }
  vy = 0;
  grounded = true;
  cutscene = false;
}

/** 지금 할 수 있는 행동: 주민 근처면 말 걸기, 침대 위면 잘 자기 */
function currentAction(): { label: string; run: () => void } | null {
  if (cutscene || dialogue.isOpen) return null;
  const near = nearestVillager();
  if (near) return { label: `💬 ${near.info.name}에게 말 걸기`, run: () => talkTo(near) };
  if (onBed()) return { label: '🛏️ 잘 자기', run: () => goToSleep() };
  if (readyToWash() && nearWasher()) return { label: '🧺 빨래하기', run: () => doLaundry() };
  return null;
}

function doAction() {
  currentAction()?.run();
}

// E·엔터 = 행동(말 걸기, 잘 자기), 스페이스 = 점프 (대화 중에는 대화창이 키를 가져감)
window.addEventListener('keydown', (e) => {
  if (dialogue.isOpen || cutscene) return;
  const k = e.key.toLowerCase();
  if (k === 'e' || k === 'enter') doAction();
  if (k === ' ' && !e.repeat) jump();
});

// 폰용 점프 버튼
if (matchMedia('(pointer: coarse)').matches) {
  const btn = document.createElement('button');
  btn.textContent = '점프';
  Object.assign(btn.style, {
    position: 'fixed', right: '20px', bottom: '100px', width: '76px', height: '76px', borderRadius: '50%',
    border: 'none', background: 'rgba(255,250,240,.9)', color: '#5a4630', font: '700 17px sans-serif',
    boxShadow: '0 4px 0 #e8dcc4, 0 6px 14px rgba(0,0,0,.15)',
  });
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    jump();
  });
  document.body.appendChild(btn);
}

// ---------- 루프 ----------
const frameClock = new THREE.Clock();
let walkTime = 0;

const world: World = { player: player.root.position, heightAt: house.heightAt };

function update(dt: number, t: number) {
  const p = player.root.position;

  // 시간 흐름 (대화·이벤트 중엔 멈춤) + 시각에 맞는 조명
  if (!cutscene && !dialogue.isOpen) clock.update(dt);
  if (!cutscene) {
    lighting.setTime(clock.minutes);
    house.setSunbeam(sunStrength(clock.minutes));
  }
  clockHud.update(clock);
  if (clock.isOver() && !cutscene && !dialogue.isOpen) passOut();
  if (dryUntil >= 0 && nowMinutes(clock) >= dryUntil && !cutscene && !dialogue.isOpen) dryDone();

  // 플레이어 이동 (대화 중엔 멈춤). 축별로 따로 검사해서 벽에 비비며 미끄러지게
  const input = dialogue.isOpen || cutscene ? { x: 0, y: 0 } : getMoveInput();
  const moving = input.x !== 0 || input.y !== 0;
  if (moving) {
    const nx = p.x + input.x * PLAYER_SPEED * dt;
    const nz = p.z + input.y * PLAYER_SPEED * dt;
    if (canStep(nx, p.z) && !hitsVillager(nx, p.z)) p.x = nx;
    if (canStep(p.x, nz) && !hitsVillager(p.x, nz)) p.z = nz;
    turnToward(player.root, Math.atan2(input.x, input.y), dt);
    walkTime += dt;
  } else {
    walkTime = 0;
  }
  player.body.position.y = moving && grounded ? Math.abs(Math.sin(walkTime * 12)) * 0.12 : 0;
  // 낮은 턱은 저절로 폴짝, 그 외엔 점프·낙하 (중력). 연출 중엔 연출이 위치를 정함
  const ground = groundUnder(p.x, p.z);
  if (cutscene) {
    // 그대로 둠
  } else if (grounded && ground > p.y) {
    p.y = Math.min(ground, p.y + Math.max(0.05, (ground - p.y) * dt * 14));
  } else {
    vy -= GRAVITY * dt;
    p.y += vy * dt;
    grounded = p.y <= ground;
    if (grounded) {
      p.y = ground;
      vy = 0;
    }
  }

  for (const v of villagers) v.update(dt, t, world);

  // 대화 상대 쪽을 바라보고, 할 수 있는 행동이 있으면 버튼 표시
  const partner = villagers.find((v) => v.talking);
  if (dialogue.isOpen && partner && !cutscene) {
    turnToward(player.root, Math.atan2(partner.position.x - p.x, partner.position.z - p.z), dt);
  }
  actionButton.show(currentAction()?.label ?? null);

  // 카메라와 그림자가 플레이어를 따라감 (집 앞 빈 공간이 너무 보이지 않게 앞쪽은 제한)
  const offset = CAMERA_OFFSET.clone().multiplyScalar(cameraOverride?.zoom ?? zoom);
  const focus = cameraOverride
    ? cameraOverride.focus.clone()
    : new THREE.Vector3(THREE.MathUtils.clamp(p.x, -15, 17), p.y, Math.min(p.z, 0.5));
  const camTarget = focus.clone().add(offset);
  if (snapCamera) camera.position.copy(camTarget);
  else camera.position.lerp(camTarget, Math.min(1, dt * (cameraOverride ? 2.5 : 5)));
  snapCamera = false;
  camera.lookAt(camera.position.x, camera.position.y - offset.y + 0.5, camera.position.z - offset.z);
  house.updateFade(camera.position, focus, dt);
  sun.position.set(focus.x + 8, 15, focus.z + 6);
  sun.target.position.set(focus.x, 0, focus.z);
}

function tick() {
  const dt = Math.min(frameClock.getDelta(), 0.05);
  update(dt, frameClock.elapsedTime);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function hitsVillager(x: number, z: number) {
  const y = player.root.position.y;
  return villagers.some((v) => Math.hypot(v.position.x - x, v.position.z - z) < 0.8 && Math.abs(v.position.y - y) < 1);
}

// 개발 중 브라우저 콘솔에서 테스트용 (예: __game.talkTo(__game.villagers[0]))
if (import.meta.env.DEV) Object.assign(window, { __game: { player, villagers, talkTo, dialogue, update, jump, goToSleep, clock, life, doLaundry } });

camera.position.set(THREE.MathUtils.clamp(player.root.position.x, -15, 17), 0, Math.min(player.root.position.z, 0.5)).add(CAMERA_OFFSET.clone().multiplyScalar(zoom));
tick();
