// 키보드(WASD/방향키) + 터치 조이스틱. 결과는 길이 0~1의 이동 벡터.

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const JOY_RADIUS = 50;
const joy = { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };

const base = document.createElement('div');
const knob = document.createElement('div');
Object.assign(base.style, {
  position: 'fixed', width: `${JOY_RADIUS * 2}px`, height: `${JOY_RADIUS * 2}px`,
  borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.6)',
  transform: 'translate(-50%,-50%)', display: 'none', pointerEvents: 'none',
});
Object.assign(knob.style, {
  position: 'absolute', left: '50%', top: '50%', width: '44px', height: '44px',
  borderRadius: '50%', background: 'rgba(255,255,255,0.8)', transform: 'translate(-50%,-50%)',
});
base.appendChild(knob);
document.body.appendChild(base);

window.addEventListener('pointerdown', (e) => {
  if (joy.active) return;
  Object.assign(joy, { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
  base.style.left = `${e.clientX}px`;
  base.style.top = `${e.clientY}px`;
  base.style.display = 'block';
  knob.style.transform = 'translate(-50%,-50%)';
});
window.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.sx;
  let dy = e.clientY - joy.sy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) {
    dx = (dx / len) * JOY_RADIUS;
    dy = (dy / len) * JOY_RADIUS;
  }
  joy.dx = dx / JOY_RADIUS;
  joy.dy = dy / JOY_RADIUS;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const endJoy = (e: PointerEvent) => {
  if (e.pointerId !== joy.id) return;
  joy.active = false;
  joy.dx = joy.dy = 0;
  base.style.display = 'none';
};
window.addEventListener('pointerup', endJoy);
window.addEventListener('pointercancel', endJoy);

/** 화면 기준 이동 방향: x = 오른쪽, y = 아래쪽(= 월드 +z) */
export function getMoveInput() {
  let x = 0;
  let y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 0) return { x: x / len, y: y / len };
  if (Math.hypot(joy.dx, joy.dy) > 0.15) return { x: joy.dx, y: joy.dy };
  return { x: 0, y: 0 };
}
