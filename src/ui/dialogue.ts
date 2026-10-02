// 동숲풍 대화창: 화면 아래 말풍선, 한 글자씩 타이핑, 클릭/스페이스로 넘김, 마다오/아니에오 선택지.
import type { Choice, Talk } from '../data/villagers';

const TYPE_MS = 35;

const css = `
.dlg { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  width: min(640px, calc(100% - 32px)); box-sizing: border-box;
  background: #fffaf0; border-radius: 28px; padding: 30px 28px 26px;
  box-shadow: 0 6px 0 #e8dcc4, 0 10px 24px rgba(0,0,0,.18);
  font: 500 19px/1.6 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #5a4630;
  display: none; user-select: none; cursor: pointer; }
.dlg.show { display: block; animation: dlg-pop .18s ease-out; }
@keyframes dlg-pop { from { transform: translateX(-50%) scale(.92); opacity: 0; } }
.dlg-name { position: absolute; top: -16px; left: 28px; padding: 4px 18px; border-radius: 999px;
  color: #fff; font-weight: 700; font-size: 17px; transform: rotate(-3deg); }
.dlg-name small { font-weight: 500; opacity: .85; margin-right: 6px; font-size: 13px; }
.dlg-text { min-height: 3.2em; white-space: pre-wrap; }
.dlg-next { position: absolute; right: 26px; bottom: 12px; color: #e8a33a; font-size: 14px;
  animation: dlg-bob .7s ease-in-out infinite alternate; }
@keyframes dlg-bob { to { transform: translateY(4px); } }
.dlg-choices { position: absolute; right: 12px; bottom: calc(100% + 14px); display: flex; flex-direction: column; gap: 8px; }
.dlg-choices button { font: inherit; font-weight: 700; padding: 8px 22px; border: none; border-radius: 999px;
  background: #fffaf0; color: #5a4630; box-shadow: 0 3px 0 #e8dcc4; cursor: pointer; text-align: left; }
.dlg-choices button.sel { background: #f2b233; color: #fff; box-shadow: 0 3px 0 #c98f1f; }
.dlg-choices button.sel::before { content: '▶ '; }
.talk-btn { position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%);
  font: 700 18px 'Malgun Gothic', sans-serif; color: #5a4630; background: #fffaf0;
  border: none; border-radius: 999px; padding: 12px 26px; box-shadow: 0 4px 0 #e8dcc4, 0 6px 14px rgba(0,0,0,.15);
  display: none; cursor: pointer; }
.talk-btn.show { display: block; }
`;

export interface Speaker {
  name: string;
  order: string;
  color: string;
}

export class DialogueBox {
  isOpen = false;
  private root = document.createElement('div');
  private nameEl = document.createElement('div');
  private textEl = document.createElement('div');
  private nextEl = document.createElement('div');
  private choicesEl = document.createElement('div');
  private typingTimer = 0;
  private closeTimer = 0;
  private fullText = '';
  private onAdvance: (() => void) | null = null;
  private choosing: { buttons: HTMLButtonElement[]; sel: number; pick: (i: number) => void } | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.root.className = 'dlg';
    this.nameEl.className = 'dlg-name';
    this.textEl.className = 'dlg-text';
    this.nextEl.className = 'dlg-next';
    this.nextEl.textContent = '▼';
    this.choicesEl.className = 'dlg-choices';
    this.root.append(this.nameEl, this.textEl, this.nextEl, this.choicesEl);
    document.body.appendChild(this.root);

    // 대화창을 눌러도 조이스틱이 생기지 않도록 여기서 멈춤
    this.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.choosing) this.advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const k = e.key.toLowerCase();
      if (this.choosing) {
        const c = this.choosing;
        if (k === 'arrowup' || k === 'w') c.sel = (c.sel + c.buttons.length - 1) % c.buttons.length;
        if (k === 'arrowdown' || k === 's') c.sel = (c.sel + 1) % c.buttons.length;
        c.buttons.forEach((b, i) => b.classList.toggle('sel', i === c.sel));
        if (k === ' ' || k === 'enter' || k === 'e') c.pick(c.sel);
      } else if (k === ' ' || k === 'enter' || k === 'e') {
        this.advance();
      }
      e.preventDefault();
    });
  }

  /** 대사 묶음들을 차례로 끝까지 재생 */
  async play(speaker: Speaker, talks: Talk[]): Promise<Choice | null> {
    clearTimeout(this.closeTimer); // 대사를 연달아 띄울 때 앞 대화의 닫기 예약 취소
    this.isOpen = true;
    this.nameEl.innerHTML = `<small>${speaker.order}</small>${speaker.name}`;
    this.nameEl.style.background = speaker.color;
    this.nameEl.style.display = speaker.name ? '' : 'none'; // 이름 없으면 해설
    this.textEl.style.fontStyle = speaker.name ? '' : 'italic';
    this.root.classList.add('show');

    let picked: Choice | null = null; // 마지막으로 고른 대답
    for (const talk of talks) {
      const pages = talk.pages;
      for (let i = 0; i < pages.length; i++) {
        const isQuestion = talk.choices && i === pages.length - 1;
        await this.showPage(pages[i], !isQuestion);
      }
      if (talk.choices) {
        const choice = await this.ask(talk.choices);
        picked = choice;
        for (const page of choice.reply) await this.showPage(page, true);
      }
    }

    this.root.classList.remove('show');
    // 마지막 클릭/키가 바로 다음 대화를 시작하지 않도록 한 박자 늦게 닫음
    this.closeTimer = window.setTimeout(() => (this.isOpen = false), 150);
    return picked;
  }

  private showPage(text: string, waitForClick: boolean) {
    return new Promise<void>((resolve) => {
      this.fullText = text;
      this.textEl.textContent = '';
      this.nextEl.style.visibility = 'hidden';
      let n = 0;
      clearInterval(this.typingTimer);
      const finishTyping = () => {
        clearInterval(this.typingTimer);
        this.typingTimer = 0;
        this.textEl.textContent = this.fullText;
        if (!waitForClick) {
          this.onAdvance = null;
          resolve();
          return;
        }
        this.nextEl.style.visibility = 'visible';
        this.onAdvance = () => {
          this.onAdvance = null;
          resolve();
        };
      };
      this.typingTimer = window.setInterval(() => {
        n++;
        this.textEl.textContent = text.slice(0, n);
        if (n >= text.length) finishTyping();
      }, TYPE_MS);
      // 타이핑 중에 누르면 글자를 한 번에 다 보여줌
      this.onAdvance = finishTyping;
    });
  }

  private advance() {
    this.onAdvance?.();
  }

  private ask(choices: Choice[]) {
    return new Promise<Choice>((resolve) => {
      this.choicesEl.innerHTML = '';
      const pick = (i: number) => {
        this.choosing = null;
        this.choicesEl.innerHTML = '';
        resolve(choices[i]);
      };
      const buttons = choices.map((c, i) => {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          pick(i);
        });
        b.addEventListener('pointerenter', () => {
          if (!this.choosing) return;
          this.choosing.sel = i;
          buttons.forEach((bb, j) => bb.classList.toggle('sel', j === i));
        });
        this.choicesEl.appendChild(b);
        return b;
      });
      buttons[0].classList.add('sel');
      this.choosing = { buttons, sel: 0, pick };
    });
  }
}

/** 할 수 있는 행동이 있을 때 뜨는 버튼 ([말 걸기], [잘 자기] 등) */
export function createActionButton(onPress: () => void) {
  const btn = document.createElement('button');
  btn.className = 'talk-btn';
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    onPress();
  });
  document.body.appendChild(btn);
  return {
    show(label: string | null) {
      btn.classList.toggle('show', !!label);
      if (label) btn.textContent = label;
    },
  };
}
