// 화면 암전 + 가운데 글씨 ("쿨… 쿨…", "다음 날 아침" 등)
export function createFade() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', inset: '0', background: '#0d1020', color: '#fdf3e0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: "700 28px 'Malgun Gothic', sans-serif", letterSpacing: '2px',
    opacity: '0', pointerEvents: 'none', transition: 'opacity .9s ease',
  });
  document.body.appendChild(el);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    /** 화면을 가림 (text가 있으면 가운데 표시) */
    async out(text = '') {
      el.textContent = text;
      el.style.pointerEvents = 'auto';
      el.style.opacity = '1';
      await wait(950);
    },
    async in() {
      el.style.opacity = '0';
      await wait(950);
      el.style.pointerEvents = 'none';
      el.textContent = '';
    },
    setText(text: string) {
      el.textContent = text;
    },
  };
}

export type Fade = ReturnType<typeof createFade>;
