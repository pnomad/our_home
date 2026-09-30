// 라디오 노래: 브라우저에서 바로 만드는 짧고 신나는 반복 멜로디 (파일 없음).
// 빠르기 126 BPM = 1초에 2.1박 (entities/dance.ts 의 춤 박자와 같음).
// 소리는 사용자가 누른 뒤에만 날 수 있어서, 라디오 켜기 버튼을 누를 때 시작한다.

const BPM = 126;
const EIGHTH = 60 / BPM / 2;
const note = (name: string) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)!;
  const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const n = semis[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (n / 12);
};
// 8분음표 32개 = 4마디 (- 는 쉼표)
const MELODY = ('E5 G5 A5 G5 E5 C5 D5 E5 G5 - E5 - D5 C5 D5 - ' + 'E5 G5 A5 C6 A5 G5 E5 G5 D5 E5 D5 C5 C5 - - -').split(' ');
// 4분음표 16개
const BASS = 'C3 C3 G2 G2 A2 A2 E2 E2 F2 F2 C3 C3 G2 G2 C3 C3'.split(' ');

export function createRadioMusic() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer = 0;
  let step = 0;
  let nextTime = 0;

  const tone = (freq: number, at: number, len: number, type: OscillatorType, vol: number) => {
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + len);
    osc.connect(g).connect(master!);
    osc.start(at);
    osc.stop(at + len + 0.02);
  };

  const hat = (at: number) => {
    const buf = ctx!.createBuffer(1, ctx!.sampleRate * 0.04, ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx!.createBufferSource();
    src.buffer = buf;
    const hp = ctx!.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ctx!.createGain();
    g.gain.value = 0.25;
    src.connect(hp).connect(g).connect(master!);
    src.start(at);
  };

  // 조금 앞서서 박자를 예약해 두는 방식 (끊기지 않게)
  const schedule = () => {
    while (nextTime < ctx!.currentTime + 0.12) {
      const m = MELODY[step % MELODY.length];
      if (m !== '-') tone(note(m), nextTime, EIGHTH * 0.9, 'triangle', 0.5);
      if (step % 2 === 0) tone(note(BASS[(step / 2) % BASS.length]), nextTime, EIGHTH * 1.8, 'sine', 0.6);
      else hat(nextTime);
      nextTime += EIGHTH;
      step++;
    }
  };

  return {
    start() {
      try {
        ctx ??= new AudioContext();
        void ctx.resume();
        master = ctx.createGain();
        master.gain.value = 0.12;
        master.connect(ctx.destination);
        step = 0;
        nextTime = ctx.currentTime + 0.05;
        clearInterval(timer);
        timer = window.setInterval(schedule, 25);
      } catch {
        // 소리를 못 내는 환경이면 조용히 춤만
      }
    },
    stop() {
      clearInterval(timer);
      if (ctx && master) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        const old = master;
        setTimeout(() => old.disconnect(), 400);
      }
      master = null;
    },
  };
}
