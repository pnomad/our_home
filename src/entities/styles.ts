// 캐릭터 스타일 모음. 기본은 말랑 인형(plush), 주소 뒤 ?style=block 처럼 다른 스타일도 볼 수 있다.
import type { Character } from './models';
import { createDdangi, createGamja, createDdamong, createShiba } from './models';
import { ddangi, gamja, ddamong, shiba, ttungttaengi, ttungsuni, type CharacterSpec } from './shapeSpecs';
import { buildPlush } from './plushStyle';
import { buildVoxel } from './voxelStyle';

export type VillagerId = 'ddangi' | 'gamja' | 'ddamong' | 'shiba';
export type StyleId = 'block' | 'plush' | 'voxel';
export type PlayerId = 'ttungttaengi' | 'ttungsuni';

export const PLAYER_NAMES: Record<PlayerId, string> = { ttungttaengi: '뚱땡이', ttungsuni: '뚱순이' };

/** 플레이어 인형 (항상 말랑 인형 스타일) */
export function createPlayerCharacter(id: PlayerId): Character {
  return buildPlush(id === 'ttungttaengi' ? ttungttaengi : ttungsuni);
}

const specs: Record<VillagerId, CharacterSpec> = { ddangi, gamja, ddamong, shiba };
const blockBuilders: Record<VillagerId, () => Character> = {
  ddangi: createDdangi, gamja: createGamja, ddamong: createDdamong, shiba: createShiba,
};

export const STYLE_NAMES: Record<StyleId, string> = { block: '블록', plush: '말랑 인형', voxel: '복셀' };

export function createVillager(id: VillagerId, style: StyleId): Character {
  if (style === 'plush') return buildPlush(specs[id]);
  if (style === 'voxel') return buildVoxel(specs[id]);
  return blockBuilders[id]();
}

export function styleFromUrl(fallback: StyleId = 'plush'): StyleId {
  const s = new URLSearchParams(location.search).get('style');
  return s === 'block' || s === 'plush' || s === 'voxel' ? s : fallback;
}
