// 집 조명: 게임 시각에 따라 새벽 → 낮 → 해질녘 → 밤으로 부드럽게 바뀐다.
import * as THREE from 'three';

interface Preset {
  sky: number; // 위에서 오는 빛
  ground: number; // 아래에서 반사되는 빛
  skyI: number;
  sun: number; // 햇빛/달빛
  sunI: number;
  bg: number; // 집 밖 배경색
}

const DAWN: Preset = { sky: 0xffd9c2, ground: 0x9c8a86, skyI: 1.0, sun: 0xffc9a0, sunI: 0.9, bg: 0xe8cfc4 };
const DAY: Preset = { sky: 0xfff8ee, ground: 0xb89f86, skyI: 1.5, sun: 0xfff0dc, sunI: 1.4, bg: 0xf3e6d8 };
const SUNSET: Preset = { sky: 0xffc9a0, ground: 0x8a6f6a, skyI: 1.1, sun: 0xff9a5a, sunI: 1.1, bg: 0xe6b89c };
const NIGHT: Preset = { sky: 0x8a97c8, ground: 0x2c2640, skyI: 0.55, sun: 0xa9b8ff, sunI: 0.45, bg: 0x1b2036 };

// [시각(분), 조명] — 사이 시각은 섞어서 부드럽게
const KEYFRAMES: [number, Preset][] = [
  [6 * 60, DAWN],
  [8 * 60, DAY],
  [16 * 60, DAY],
  [18.5 * 60, SUNSET],
  [20.5 * 60, NIGHT],
  [26 * 60, NIGHT],
];

export function createLighting(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.normalBias = 0.02; // 둥근 몸이 겹치는 곳의 얼룩 그림자 방지
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  scene.add(hemi, sun, sun.target);
  const bg = new THREE.Color();
  scene.background = bg;
  const a = new THREE.Color();
  const b = new THREE.Color();
  const mix = (target: THREE.Color, from: number, to: number, k: number) => target.copy(a.set(from).lerp(b.set(to), k));

  /** 게임 시각(분)에 맞는 조명 */
  function setTime(minutes: number) {
    let i = 0;
    while (i < KEYFRAMES.length - 2 && minutes >= KEYFRAMES[i + 1][0]) i++;
    const [t0, p0] = KEYFRAMES[i];
    const [t1, p1] = KEYFRAMES[i + 1];
    const k = THREE.MathUtils.clamp((minutes - t0) / (t1 - t0), 0, 1);
    mix(hemi.color, p0.sky, p1.sky, k);
    mix(hemi.groundColor, p0.ground, p1.ground, k);
    hemi.intensity = THREE.MathUtils.lerp(p0.skyI, p1.skyI, k);
    mix(sun.color, p0.sun, p1.sun, k);
    sun.intensity = THREE.MathUtils.lerp(p0.sunI, p1.sunI, k);
    mix(bg, p0.bg, p1.bg, k);
  }

  return {
    sun,
    setTime,
    setNight(night: boolean) {
      setTime(night ? 23 * 60 : 12 * 60);
    },
  };
}

export type Lighting = ReturnType<typeof createLighting>;
