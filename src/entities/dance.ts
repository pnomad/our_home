// 라디오 춤: 인형마다 다른 춤. Villager.update 가 춤추는 동안 매 프레임 부른다.
//   땅이: 땅댄스 — 팔(날개)을 옆으로 쫙 벌린 채 몸만 좌우로 흔들흔들
//   따몽: 크게 기우뚱기우뚱, 말랑하게 눌렸다 펴졌다
//   시바: 제자리 콩콩 뛰면서 엉덩이 씰룩(좌우 비틀기)
//   감자: 고개 까딱까딱 + 옆으로 스텝
import type * as THREE from 'three';
import type { Character } from './models';
import type { VillagerId } from './styles';

const BEAT = 2.1; // 1초에 박자 수 (라디오 노래 빠르기와 맞춤)

export function applyDance(id: VillagerId, char: Character, t: number) {
  const body = char.body;
  const w = t * BEAT * Math.PI; // 한 박자에 반 바퀴
  const s = Math.sin(w);
  const bounce = Math.abs(Math.sin(w));
  body.rotation.set(0, 0, 0);
  body.position.set(0, 0, 0);
  body.scale.set(1, 1, 1);
  switch (id) {
    case 'ddangi': {
      body.rotation.z = s * 0.2;
      body.position.x = s * 0.06;
      body.position.y = bounce * 0.04;
      setArms(char, 1.35 + Math.sin(w * 2) * 0.05); // 거의 수평으로 쫙 (살짝만 파닥)
      break;
    }
    case 'ddamong': {
      body.rotation.z = Math.sin(w / 2) * 0.25;
      const squash = bounce * 0.07;
      body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      break;
    }
    case 'shiba': {
      body.position.y = bounce * 0.2;
      body.rotation.y = s * 0.35;
      break;
    }
    case 'gamja': {
      body.rotation.x = Math.sin(w * 2) * 0.12;
      body.position.x = Math.sin(w / 2) * 0.14;
      body.position.y = bounce * 0.03;
      break;
    }
  }
}

/** 팔 벌리기 (0 = 내림, 1.5 ≈ 수평). 팔이 따로 없는 인형은 그냥 넘어감 */
export function setArms(char: Character, angle: number) {
  const l = char.body.getObjectByName('armL') as THREE.Object3D | undefined;
  const r = char.body.getObjectByName('armR') as THREE.Object3D | undefined;
  if (l) l.rotation.z = -angle;
  if (r) r.rotation.z = angle;
}
