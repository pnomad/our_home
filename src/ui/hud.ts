// 오른쪽 위 시계: "☀️ 1일째 · 오전 9:30"
import type { GameClock } from '../world/clock';

export function createClockHud() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '14px', right: '14px', padding: '8px 16px', borderRadius: '999px',
    background: 'rgba(255,250,240,.92)', color: '#5a4630', boxShadow: '0 3px 0 #e8dcc4, 0 6px 14px rgba(0,0,0,.12)',
    font: "700 16px 'Malgun Gothic', sans-serif", pointerEvents: 'none', userSelect: 'none',
  });
  document.body.appendChild(el);
  let last = '';

  return {
    update(clock: GameClock) {
      const h = clock.hour;
      const icon = h >= 6 && h < 17 ? '☀️' : h >= 17 && h < 20 ? '🌇' : '🌙';
      const text = `${icon} ${clock.day}일째 · ${clock.timeLabel()}`;
      if (text !== last) el.textContent = last = text; // 바뀔 때만 다시 그림
    },
    setVisible(v: boolean) {
      el.style.display = v ? '' : 'none';
    },
  };
}
