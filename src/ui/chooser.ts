// 시작 화면: "누구로 놀까요? [뚱땡이] [뚱순이]"
// 같은 컴퓨터를 번갈아 쓰니까 매번 물어본다. 주소 뒤 ?who=ttungsuni 로 건너뛸 수 있다.
import { PLAYER_NAMES, type PlayerId } from '../entities/styles';

const CARD_COLORS: Record<PlayerId, [string, string]> = {
  ttungttaengi: ['#8cc0ea', '#5f95c4'],
  ttungsuni: ['#f6aabd', '#d9819a'],
};

export function choosePlayer(): Promise<PlayerId> {
  const who = new URLSearchParams(location.search).get('who');
  if (who === 'ttungttaengi' || who === 'ttungsuni') return Promise.resolve(who);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '28px', background: '#f3e6d8', zIndex: '50',
      font: "700 18px 'Malgun Gothic', sans-serif", color: '#5a4630',
    });
    const title = document.createElement('div');
    title.textContent = '누구로 놀까요?';
    title.style.fontSize = '30px';
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' });
    for (const id of Object.keys(PLAYER_NAMES) as PlayerId[]) {
      const [color, shadow] = CARD_COLORS[id];
      const btn = document.createElement('button');
      btn.textContent = PLAYER_NAMES[id];
      Object.assign(btn.style, {
        width: '150px', height: '150px', borderRadius: '36px', border: 'none', cursor: 'pointer',
        background: color, color: '#fff', font: "700 26px 'Malgun Gothic', sans-serif",
        boxShadow: `0 8px 0 ${shadow}, 0 12px 24px rgba(0,0,0,.12)`,
      });
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        overlay.remove();
        resolve(id);
      });
      row.appendChild(btn);
    }
    overlay.append(title, row);
    document.body.appendChild(overlay);
  });
}
