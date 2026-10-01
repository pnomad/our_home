// 캐릭터 도감: 주민 모델을 스타일별로 줄지어 비교하는 개발용 페이지 (/characters.html)
// 위쪽 버튼으로 스타일 전환. ?style=voxel 로 시작 스타일, ?angle=0.5 로 회전 고정(라디안)
import * as THREE from 'three';
import { createNameTag } from './entities/models';
import { preloadModels } from './entities/modelStyle';
import { createPlayerCharacter, createVillager, styleFromUrl, PLAYER_NAMES, STYLE_NAMES, type PlayerId, type StyleId, type VillagerId } from './entities/styles';
import { VILLAGERS } from './data/villagers';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfdf3e7);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b0, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(3, 8, 6);
sun.castShadow = true;
sun.shadow.normalBias = 0.02; // 둥근 몸이 겹치는 곳의 얼룩 그림자 방지
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
scene.add(sun);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0xf3e2c9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

await preloadModels(); // 블렌더로 만든 인형 모델 (있는 것만)
const styles: StyleId[] = ['block', 'plush', 'voxel'];
const ids: VillagerId[] = ['ddangi', 'gamja', 'ddamong', 'shiba'];
type RowId = StyleId | 'players';
const rows = new Map<RowId, THREE.Group>();
const roots: THREE.Object3D[] = [];
for (const style of styles) {
  const row = new THREE.Group();
  ids.forEach((id, i) => {
    const c = createVillager(id, style);
    c.root.position.x = (i - 1.5) * 1.4;
    const tag = createNameTag(VILLAGERS[id].name, 1.45);
    tag.scale.multiplyScalar(0.55);
    c.root.add(tag);
    row.add(c.root);
    roots.push(c.root);
  });
  rows.set(style, row);
  scene.add(row);
}

// 플레이어 줄: 뚱땡이 · 뚱순이
const playerRow = new THREE.Group();
(['ttungttaengi', 'ttungsuni'] as PlayerId[]).forEach((id, i) => {
  const c = createPlayerCharacter(id);
  c.root.position.x = (i - 0.5) * 1.6;
  const tag = createNameTag(PLAYER_NAMES[id], 1.45);
  tag.scale.multiplyScalar(0.55);
  c.root.add(tag);
  playerRow.add(c.root);
  roots.push(c.root);
});
rows.set('players', playerRow);
scene.add(playerRow);

const bar = document.createElement('div');
Object.assign(bar.style, { position: 'fixed', top: '16px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '8px' });
document.body.appendChild(bar);
const buttons = new Map<RowId, HTMLButtonElement>();
function show(style: RowId) {
  for (const [s, row] of rows) row.visible = s === style;
  for (const [s, btn] of buttons) {
    btn.style.background = s === style ? '#e89a3a' : '#fff';
    btn.style.color = s === style ? '#fff' : '#5a4630';
  }
}
for (const style of [...styles, 'players'] as RowId[]) {
  const btn = document.createElement('button');
  btn.textContent = style === 'players' ? '플레이어' : STYLE_NAMES[style];
  Object.assign(btn.style, { font: 'bold 16px sans-serif', padding: '8px 16px', border: 'none', borderRadius: '999px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.15)' });
  btn.onclick = () => show(style);
  bar.appendChild(btn);
  buttons.set(style, btn);
}
show(new URLSearchParams(location.search).get('style') === 'players' ? 'players' : styleFromUrl());

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 2.2, 7);
camera.lookAt(0, 0.6, 0);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const fixed = new URLSearchParams(location.search).get('angle');
renderer.setAnimationLoop((ms) => {
  const a = fixed !== null ? Number(fixed) : Math.sin(ms / 1500) * 0.8;
  for (const r of roots) r.rotation.y = a;
  renderer.render(scene, camera);
});
