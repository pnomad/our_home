// 블렌더로 만든 진짜 3D 인형 모델 (public/models/*.glb, 만드는 스크립트는 tools/blender/).
// 모델이 있는 인형은 말랑 인형 스타일에서 덩어리 대신 이 모델로 그린다. 없으면 기존 설계도 그대로.
// 모델은 게임 좌표 그대로 (키 약 1칸, +z 앞, 발바닥 y=0) 만들어 둔다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeCharacter, type Character } from './models';
import type { VillagerId } from './styles';

const MODEL_FILES: Partial<Record<VillagerId, string>> = {
  shiba: 'models/shiba.glb',
};

const loaded = new Map<VillagerId, THREE.Object3D>();

/** 게임 시작 전에 한 번: 모델 파일 불러오기 (실패하면 그 인형은 기존 모양으로) */
export async function preloadModels() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(MODEL_FILES).map(async ([id, file]) => {
    try {
      const gltf = await loader.loadAsync(file);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        // 천은 보송하게(안 반짝), 단추 눈·코만 살짝 반짝
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.metalness = 0;
        if (mat.roughness > 0.5) mat.roughness = 1;
      });
      loaded.set(id as VillagerId, gltf.scene);
    } catch (e) {
      console.warn(`모델을 못 불러왔어요: ${file}`, e);
    }
  }));
}

export function hasModel(id: VillagerId) {
  return loaded.has(id);
}

/** 모델로 만든 인형 (재질은 같이 쓰고 모양만 복제) */
export function buildModel(id: VillagerId): Character {
  const src = loaded.get(id)!;
  return makeCharacter((b) => b.add(src.clone(true)));
}
