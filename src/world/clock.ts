// 게임 시계: 하루 = 실제 20분 (아침 6시 → 새벽 2시, 실제 1초 = 게임 1분).
// 날짜는 브라우저에 저장된다 (나중에 둘이 공유하는 저장소로 옮길 예정).

export const DAY_START = 6 * 60; // 아침 6:00
export const DAY_END = 26 * 60; // 새벽 2:00 (다음 날 기준 24+2시)
export const NIGHT_START = 21 * 60; // 밤 9시부터 잘 수 있음
const GAME_MINUTES_PER_SECOND = 1;
const SAVE_KEY = 'our-house:day';

function loadDay() {
  try {
    return Number(localStorage.getItem(SAVE_KEY)) || 1;
  } catch {
    return 1;
  }
}

function saveDay(day: number) {
  try {
    localStorage.setItem(SAVE_KEY, String(day));
  } catch {
    // 저장이 막힌 브라우저면 그냥 넘어감
  }
}

export function createClock() {
  // 테스트용: 주소 뒤 ?night=1 이면 밤 9시, ?time=18.5 면 오후 6시 반에서 시작 (새벽 1시 = 25), ?day=3 이면 3일째
  const q = new URLSearchParams(location.search);
  const startAt = q.get('night') === '1' ? NIGHT_START : Number(q.get('time')) * 60 || DAY_START;
  // 테스트용: ?day=3 이면 3일째로 시작 (저장된 날짜는 안 바꿈)
  const state = { day: Number(q.get('day')) || loadDay(), minutes: Math.min(Math.max(startAt, DAY_START), DAY_END) };

  return {
    get day() {
      return state.day;
    },
    /** 하루가 시작된 뒤의 시각(분). 24시 이후는 24*60 이상으로 이어짐 */
    get minutes() {
      return state.minutes;
    },
    get hour() {
      return Math.floor(state.minutes / 60) % 24;
    },
    update(dt: number) {
      state.minutes = Math.min(DAY_END, state.minutes + dt * GAME_MINUTES_PER_SECOND);
    },
    isNight() {
      return state.minutes >= NIGHT_START;
    },
    isOver() {
      return state.minutes >= DAY_END;
    },
    /** 다음 날 아침 6시로 */
    nextDay() {
      state.day += 1;
      state.minutes = DAY_START;
      saveDay(state.day);
      return state.day;
    },
    /** 시계 표시용 (10분 단위): "오전 9:30" */
    timeLabel() {
      const m = Math.floor(state.minutes / 10) * 10;
      const h = Math.floor(m / 60) % 24;
      const mm = String(m % 60).padStart(2, '0');
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${mm}`;
    },
  };
}

export type GameClock = ReturnType<typeof createClock>;
