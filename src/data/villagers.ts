// 주민 성격·말투·대사. 대사를 고치거나 추가하려면 이 파일만 수정하면 된다.
//
// 공통 말투: 맞다 → 마다오 / 틀리다 → 아니에오 / 무슨 일이데오? / 뭔일이래?
// 대사 속 {이름} 은 지금 노는 사람(뚱땡이/뚱순이), {상대} 는 다른 한 명,
// {친구} 는 방금 같이 뭔가 한 형제 이름으로 바뀐다.
//
// 말을 걸면 이 순서로 대사를 고른다:
//   밤 이벤트 다음 날(냉장고 털이·고양이 싸움) → 건조대에서 말리는 중 → 빨래 끝난 뒤
//   → 지금 하는 일(빠삭·낮잠) → 방금 있었던 일(싸움·장난·같이 낮잠) → 인사 → 지금 있는 장소 → 평소 대사
import type { VillagerId } from '../entities/styles';
import type { PlaceId } from '../world/places';

export interface Choice {
  label: string;
  reply: string[];
}

/** 대사 한 묶음: 여러 페이지를 차례로 말하고, choices가 있으면 마지막 페이지 뒤에 대답을 고른다 */
export interface Talk {
  pages: string[];
  choices?: Choice[];
}

export type MemoryTalkKind = 'fight' | 'prank' | 'prankShiba' | 'pranked' | 'napTogether';

export interface VillagerInfo {
  id: VillagerId;
  name: string;
  order: string; // 형제 순서
  color: string; // 대화창 이름표 색
  walkSpeed: number; // 칸/초
  home: PlaceId; // 제일 좋아하는 자리
  // 성격: 할 일 고를 때의 비중 (클수록 자주)
  likes: { sunbathe: number; nap: number; roam: number; visit: number; fight: number };
  greetings: { morning: Talk; day: Talk; night: Talk };
  wakeUp: Talk; // 자다가 깼을 때
  afterRaid: Talk; // 냉장고 털기 다음 날 처음 말 걸었을 때
  afterCatFight: Talk; // 고양이와 싸운 다음 날 (꼬질꼬질) 처음 말 걸었을 때
  drying: Talk; // 빨래하고 건조대에서 마르는 중
  afterWash: Talk; // 다 마르고 처음 말 걸었을 때
  sunbathe: Talk[]; // 햇빛 받으며 빠삭하는 중
  memory: Partial<Record<MemoryTalkKind, Talk>>; // 방금 있었던 일
  places: Partial<Record<PlaceId, Talk[]>>; // 그 장소에 있을 때만
  talks: Talk[]; // 평소
  // 머리 위 말풍선
  // 머리 위 말풍선. 싸움은 fightStart(따지기) → fightBack(받아치기) → fight(아무 말) 순서
  bubbles: { idle: string[]; chat: string[]; fight: string[]; fightStart: string[]; fightBack: string[]; sunbathe: string[] };
}

const YES_NO = (yes: string[], no: string[]): Choice[] => [
  { label: '마다오', reply: yes },
  { label: '아니에오', reply: no },
];

export const VILLAGERS: Record<VillagerId, VillagerInfo> = {
  ddangi: {
    id: 'ddangi',
    name: '땅이',
    order: '첫째',
    color: '#f2b233',
    walkSpeed: 1.6,
    home: 'table',
    likes: { sunbathe: 3, nap: 0.6, roam: 3, visit: 3, fight: 0.6 },
    greetings: {
      morning: { pages: ['일어났땅?! 나는 벌써 집 한 바퀴 돌았땅!'] },
      day: { pages: ['{이름} 왔땅! 마침 심심했땅. 나랑 놀자땅!'] },
      night: { pages: ['밤인데 하나도 안 졸리땅!', '쉿, 동생들 깨기 전에 몰래 놀자땅!'] },
    },
    wakeUp: { pages: ['음냐… 누구땅?', '아, {이름}이었땅! 안 잤땅! 눈만 감았땅!'] },
    afterRaid: {
      pages: ['마, 만두?! 나 아니땅!', '…입가에 묻은 거 만두 아니땅. 그냥 묻었땅.', '…믿었땅?'],
      choices: YES_NO(['그치땅? 역시 내 편이땅! 헤헤.'], ['…들켰땅. 대장이 책임졌땅!']),
    },
    afterCatFight: { pages: ['어젯밤에 고양이랑 한판 붙었땅!', '대문 앞 쓰레기봉지를 뒤지길래 대장이 먼저 돌격했땅!', '…그래서 이렇게 꼬질꼬질해졌땅. 그래도 이겼땅!'] },
    drying: { pages: ['세탁기 빙글빙글 너무 재밌었땅!!', '다 마르면 한 번 더 탔땅!'] },
    afterWash: { pages: ['뽀송뽀송해졌땅! 냄새 맡아봤땅?', '섬유유연제 냄새 났땅~ 헤헤.'] },
    sunbathe: [
      { pages: ['빠삭빠삭했땅~', '햇빛 받으니까 털이 뽀송해졌땅!'] },
      { pages: ['{이름}도 여기 누웠땅!', '빠삭 자리는 내가 맡아놨땅. 첫째니까땅!'] },
    ],
    memory: {
      fight: { pages: ['방금 {친구}랑 싸웠땅!', '{친구}가 먼저 그랬땅! 진짜땅!'] },
      prankShiba: { pages: ['방금 {친구} 꼬리 몰래 잡아당겼땅.', '헤헤, "뭔일이래?!" 하는 거 봤땅?'] },
      prank: { pages: ['방금 자는 {친구} 몰래 쿡 찔렀땅.', '헤헤, 깜짝 놀라는 거 봤땅?'] },
      napTogether: { pages: ['{친구}랑 같이 낮잠 잤땅.', '{친구}가 코 골았땅. 나는 안 골았땅!'] },
    },
    places: {
      table: [{ pages: ['식탁 위가 제일 명당이땅.', '냉장고가 제일 잘 보였땅. 헤헤헤.'] }],
      fridge: [{ pages: ['킁킁… 여기서 만두 냄새 났땅!', '…아무것도 안 했땅. 진짜땅.'] }],
    },
    talks: [
      { pages: ['내가 첫째땅! 동생들은 내 말 잘 들어야 된땅.', '근데 아무도 안 들었땅…'] },
      { pages: ['따몽이한테 장난쳐도 하나도 안 놀랐땅.', '따몽이는 너무 듬직했땅…'] },
      { pages: ['냉장고에 만두 있는 거 알았땅?', '밤에 다 같이 탑 쌓아서 꺼내 먹었땅!', '내가 맨 위였땅. 대장이니까땅!'] },
      { pages: ['감자가 또 책 읽었땅.', '옆에서 꽥꽥 했더니 감자가 째려봤땅. 헤헤.'] },
      { pages: ['{상대}는 오늘 안 왔땅?', '보고 싶었땅! 꼭 데려왔땅!'] },
      { pages: ['냉장고 문 열면 불이 확 켜졌땅!', '처음엔 깜짝 놀라서 꽥 했땅…'] },
      {
        pages: ['너 나랑 놀 거땅?'],
        choices: YES_NO(['역시 최고땅!', '술래는 너땅! 도망갔땅~!'], ['흥! 삐졌땅…', '…거짓말이땅~ 헤헤, 놀랐땅?']),
      },
      {
        pages: ['나 오늘 좀 멋있지땅?'],
        choices: YES_NO(['마다오! 역시 보는 눈 있었땅!'], ['아니에오…?', '무슨 일이데오?! 다시 봤땅, 멋있었땅!']),
      },
    ],
    bubbles: {
      idle: ['꽥!', '심심했땅~', '헤헤헤', '어디 갔땅?'],
      chat: ['놀자땅!', '내가 첫째땅!', '마다오?', '헤헤'],
      fight: ['꽥꽥!!', '내가 첫째땅!!', '덤벼땅!', '꽥!!!'],
      fightStart: ['내 자리였땅!', '내 간식 먹었땅?!', '대장 말 안 들었땅!'],
      fightBack: ['아니에오! 땅!', '대장한테 덤볐땅?!', '나 아니었땅!'],
      sunbathe: ['빠삭~', '빠삭빠삭땅~ ☀️', '뽀송해졌땅~'],
    },
  },

  ddamong: {
    id: 'ddamong',
    name: '따몽',
    order: '둘째',
    color: '#9d74d4',
    walkSpeed: 0.8,
    home: 'sofa',
    likes: { sunbathe: 3, nap: 1, roam: 1, visit: 1.2, fight: 0.1 },
    greetings: {
      morning: { pages: ['좋은 아침이었따몽. 아침은 챙겨 먹었따몽?'] },
      day: { pages: ['{이름} 왔따몽. 오늘도 잘 지냈따몽?'] },
      night: { pages: ['늦은 시간이었따몽.', '동생들은 내가 다 재웠따몽. 너도 푹 자야 했따몽.'] },
    },
    wakeUp: { pages: ['…음, {이름}이었따몽.', '잠깐 눈 붙였따몽. 괜찮았따몽.'] },
    afterRaid: { pages: ['…마다오. 어젯밤 만두는 우리가 먹었따몽.', '땅이가 작전 짜고 내가 가운데서 받쳤따몽.', '미안했따몽. 다음엔 하나 남겨뒀따몽.'] },
    afterCatFight: { pages: ['…어젯밤에 대문 밖에서 부스럭 소리가 났따몽.', '고양이가 쓰레기봉지를 뜯고 있었따몽. 다 같이 쫓아냈따몽.', '동생들 지키느라 좀 더러워졌따몽. 괜찮았따몽.'] },
    drying: { pages: ['세탁기 안에서 동생들 꼭 안고 있었따몽.', '이제 뽀송해지는 중이었따몽…'] },
    afterWash: { pages: ['깨끗해지니까 기분 좋았따몽.', '고마웠따몽. 다음엔 고양이한테 좀 살살 했따몽.'] },
    sunbathe: [
      { pages: ['햇빛이 따뜻했따몽…', '이럴 때는 아무 생각 안 했따몽.'] },
      { pages: ['동생들이랑 같이 빠삭하니까 좋았따몽.', '{이름}도 누워봤따몽. 자리 있었따몽.'] },
    ],
    memory: {
      fight: { pages: ['방금 {친구}랑 조금 다퉜따몽.', '괜찮았따몽. 나중에 먼저 사과했따몽.'] },
      pranked: { pages: ['방금 {친구}가 또 장난쳤따몽.', '괜찮았따몽. 나는 듬직하니까따몽.'] },
      napTogether: { pages: ['방금 {친구}랑 같이 잤따몽.', '따뜻했따몽. 동생이 붙어 자면 좋았따몽.'] },
    },
    places: {
      sofa: [{ pages: ['소파는 내 자리였따몽.', '다 같이 앉아도 넉넉했따몽. 듬직했따몽.'] }],
    },
    talks: [
      { pages: ['땅이가 또 사고 쳤따몽.', '괜찮았따몽. 내가 다 수습했따몽.'] },
      { pages: ['컴퓨터 책상 위 연필을 세어봤따몽.', '전부 열두 자루였따몽. 정확했따몽.'] },
      { pages: ['{상대}도 잘 지냈따몽?', '둘 다 밥 잘 챙겨 먹어야 했따몽.'] },
      { pages: ['TV 리모컨은 내가 지켰따몽.', '땅이한테 주면 큰일 났따몽.'] },
      { pages: ['냉장고 만두 탑 쌓을 때 나는 가운데였따몽.', '위아래 다 받쳐야 해서 제일 중요한 자리였따몽.'] },
      { pages: ['시바는 틈만 나면 잤따몽.', '셋째는 잠이 많았따몽. 그래도 귀여웠따몽.'] },
      { pages: ['무슨 일이데오?', '고민 있으면 언제든 말해도 됐따몽. 다 들어줬따몽.'] },
      {
        pages: ['오늘 밥은 잘 챙겨 먹었따몽?'],
        choices: YES_NO(['마다오? 기특했따몽.'], ['그럴 줄 알았따몽.', '이따 같이 냉장고에서 간식 꺼내 먹자따몽.']),
      },
      {
        pages: ['감자가 제일 똑똑하다고 우겼따몽.', '내가 더 똑똑했따몽. 마다오?'],
        choices: YES_NO(['역시 알아봤따몽.'], ['아니에오…?', '…감자한테는 비밀로 해줬따몽.']),
      },
    ],
    bubbles: {
      idle: ['따몽~', '음…', '평화로웠따몽', '…'],
      chat: ['무슨 일이데오?', '밥은 먹었따몽?', '마다오.', '괜찮았따몽'],
      fight: ['그만했따몽!', '진정했따몽…', '아니에오!'],
      fightStart: ['그건 형아 거였따몽!', '줄 서야 했따몽!', '또 사고 쳤따몽?'],
      fightBack: ['아니에오!', '형아가 참았따몽…', '오해였따몽!'],
      sunbathe: ['따뜻했따몽…', '빠삭~', '말랑해졌따몽~'],
    },
  },

  shiba: {
    id: 'shiba',
    name: '시바',
    order: '셋째',
    color: '#e89a3a',
    walkSpeed: 1.2,
    home: 'bed',
    likes: { sunbathe: 6, nap: 3, roam: 1, visit: 1, fight: 0.4 },
    greetings: {
      morning: { pages: ['하아암… 벌써 아침이었씨바…?', '오 분만 더 잤씨바…'] },
      day: { pages: ['{이름}! 반가웠씨바!'] },
      night: { pages: ['쿨… 음냐…', '…아 왔씨바? 반가웠씨바… 쿨…'] },
    },
    wakeUp: { pages: ['쿨… 쿨…', '음냐… 뭔일이래?', '…방금 잠들었씨바.'] },
    afterRaid: { pages: ['나는 맨 아래에서 계속 잤씨바…', '아무것도 몰랐씨바.', '…근데 이상하게 배불렀씨바.'] },
    afterCatFight: { pages: ['자고 있었는데 부스럭부스럭 소리 났씨바…', '나가 보니까 고양이였씨바! 앙 물었씨바!', '…근데 입에 털 들어갔씨바. 퉤퉤.'] },
    drying: { pages: ['…어지러웠씨바.', '그래도 여기 누워 있으니까 좋았씨바… 쿨…'] },
    afterWash: { pages: ['뽀송해졌씨바…', '뽀송하니까 또 졸렸씨바… 쿨…'] },
    sunbathe: [
      { pages: ['빠삭~ 최고였씨바…', '여기서 평생 살았씨바…'] },
      { pages: ['햇빛 받으면 졸렸씨바…', '빠삭하다가 잠들면 더 좋았씨바… 쿨…'] },
    ],
    memory: {
      fight: { pages: ['방금 {친구}가 괴롭혔씨바!', '…근데 나도 앙 물었씨바.'] },
      pranked: { pages: ['방금 {친구}가 자는데 꼬리 당겼씨바!!', '"뭔일이래?!" 하고 깼씨바…', '다음엔 꼭 복수했씨바.'] },
      napTogether: { pages: ['방금 {친구}랑 같이 잤씨바…', '최고의 낮잠이었씨바.'] },
    },
    places: {
      bed: [
        { pages: ['침대가 제일 좋았씨바…', '이불 속이 따뜻했씨바… 쿨…'] },
        { pages: ['{상대} 베개 자리 따뜻했씨바…', '거기서 낮잠 잤씨바. 비밀이었씨바.'] },
      ],
    },
    talks: [
      { pages: ['오늘 낮잠 세 번 잤씨바.', '이따 네 번째 잘 거였씨바!'] },
      { pages: ['땅이 형아랑 장난치다가 피곤해졌씨바…', '그래서 또 잤씨바.'] },
      { pages: ['냉장고 만두 탑 쌓을 때 맨 아래는 늘 나였씨바.', '그래서 누워 있었씨바. 편했씨바!'] },
      { pages: ['감자 꼬리 없는 거 알았씨바?!', '오늘 알았씨바. 충격이었씨바!'] },
      { pages: ['따몽이 형아 배 위에서 자면 말랑했씨바.', '최고의 베개였씨바…'] },
      {
        pages: ['같이 낮잠 잘 거씨바?'],
        choices: YES_NO(['좋았씨바…', '쿨…'], ['그럼 나 혼자 잤씨바…', '쿨…']),
      },
      {
        pages: ['나 오늘 하나도 안 졸렸씨바.', '…진짜였씨바. 믿었씨바?'],
        choices: YES_NO(['헤헤, 속았씨바! 사실 엄청 졸렸씨바!'], ['아니에오…? 들켰씨바…']),
      },
    ],
    bubbles: {
      idle: ['하암…', '킁킁', '졸렸씨바…', '멍!'],
      chat: ['뭔일이래?', '졸렸씨바…', '마다오~', '같이 잤씨바?'],
      fight: ['왈왈!!', '아니에오!!', '앙!!', '멍멍!!'],
      fightStart: ['내 빠삭 자리였씨바!', '자는데 깨웠씨바!', '꼬리 밟았씨바!'],
      fightBack: ['아니에오!!', '나 아니었씨바!', '뭔일이래?!'],
      sunbathe: ['빠삭~', '빠삭빠삭씨바~ ☀️', '쿨… 빠삭…'],
    },
  },

  gamja: {
    id: 'gamja',
    name: '감자',
    order: '넷째',
    color: '#d4a86a',
    walkSpeed: 1.0,
    home: 'desk',
    likes: { sunbathe: 3, nap: 0.6, roam: 1, visit: 1.2, fight: 0.3 },
    greetings: {
      morning: { pages: ['좋은 아침이었감자!', '아침에 책 한 권 다 읽었감자.'] },
      day: { pages: ['{이름} 안녕했감자! 오늘은 뭐 배웠감자?'] },
      night: { pages: ['거실 창문으로 별이 잘 보였감자.', '저건 북극성이었감자. 책에서 봤감자!'] },
    },
    wakeUp: { pages: ['으음… 꿈에서 책 읽었감자.', '{이름}이었감자? 깜짝 놀랐감자.'] },
    afterRaid: { pages: ['탑 높이 계산은 완벽했감자.', '땅이 형아가 만두 보고 신나서 흔들었감자.', '그래서 무너졌감자. 과학적으로 땅이 형아 잘못이었감자.'] },
    afterCatFight: { pages: ['고양이는 우리보다 열 배는 무거웠감자.', '그래도 넷이 힘을 합치니까 이겼감자. 과학이었감자!', '…근데 흙먼지 때문에 기침 났감자. 콜록.'] },
    drying: { pages: ['드럼세탁기는 1분에 천 번 돌았감자.', '…다 세어봤감자. 어지러웠감자.'] },
    afterWash: { pages: ['빨래하고 나니까 털이 1.3배 부풀었감자.', '측정했감자. 과학이었감자!'] },
    sunbathe: [
      { pages: ['햇빛에는 비타민D가 있었감자.', '그래서 빠삭하면 똑똑해졌감자!'] },
      { pages: ['빠삭 온도를 재봤감자.', '…너무 따뜻해서 까먹었감자.'] },
    ],
    memory: {
      fight: { pages: ['방금 {친구}랑 논쟁했감자.', '과학적으로 내가 이겼감자.'] },
      pranked: { pages: ['방금 {친구}가 자는데 쿡 찔렀감자!', '수면 방해는 나빴감자!'] },
      napTogether: { pages: ['방금 {친구} 옆에서 잤감자.', '포근했감자. 공부는 이따 했감자.'] },
    },
    places: {
      desk: [{ pages: ['형아들이 시끄러워서 여기서 공부했감자.', '여기가 제일 조용했감자.'] }],
    },
    talks: [
      { pages: ['오리 발은 차가운 물에 들어가도 안 시리다고 책에서 읽었감자.', '신기했감자!'] },
      { pages: ['컴퓨터로 오리에 대해 검색했감자.', '오리는 하루에 잠을 조금씩 여러 번 잤감자. 시바 형아랑 비슷했감자.'] },
      { pages: ['{이름}랑 {상대}는 우리를 인형뽑기에서 데려왔감자.', '그날이 우리 생일이었감자!'] },
      { pages: ['막내라서 다들 나를 챙겨줬감자.', '…고마웠감자. 형아들한테는 비밀이었감자.'] },
      { pages: ['냉장고 만두 탑에서 나는 셋째 칸이었감자.', '시바 형아 위에 앉았는데 폭신했감자.'] },
      { pages: ['땅이 형아가 또 꽥꽥거렸감자.', '뭔일이래? 하고 봤더니 그냥 심심했던 거였감자.'] },
      {
        pages: ['퀴즈 냈감자!', '오리는 헤엄을 칠 수 있었감자?'],
        choices: YES_NO(['마다오! 정답이었감자!', '역시 똑똑했감자.'], ['아니에오~ 땡이었감자!', '오리는 헤엄 엄청 잘 쳤감자.']),
      },
      {
        pages: ['퀴즈 냈감자!', '우리 집에서 제일 잠이 많은 건 따몽이 형아였감자?'],
        choices: YES_NO(['땡이었감자!', '정답은 시바 형아였감자.'], ['정답이었감자!', '시바 형아는 지금도 자고 있을 거였감자.']),
      },
    ],
    bubbles: {
      idle: ['흠흠', '그렇구나감자', '📖', '음~'],
      chat: ['아니에오!', '책에서 봤감자', '마다오!', '퀴즈 냈감자!'],
      fight: ['아니에오!!', '과학적으로 틀렸감자!', '흥!'],
      fightStart: ['내 책 가져갔감자?!', '과학적으로 틀렸감자!', '조용히 해야 했감자!'],
      fightBack: ['아니에오!', '증거 있었감자?!', '내가 맞았감자!'],
      sunbathe: ['빠삭~', '비타민D 충전감자 ☀️', '따뜻했감자~'],
    },
  },
};

/** 형제끼리 주고받는 수다 (머리 위 말풍선). 둘 중 누가 먼저 찾아갔든 이 순서대로 말함 */
export interface ChatScript {
  pair: [VillagerId, VillagerId];
  lines: [VillagerId, string][];
}

export const CHATS: ChatScript[] = [
  // 땅이 · 따몽
  { pair: ['ddangi', 'ddamong'], lines: [['ddangi', '따몽아 놀자땅!'], ['ddamong', '뭐 하고 놀았따몽?'], ['ddangi', '술래잡기땅!'], ['ddamong', '나 느린 거 알았따몽…']] },
  { pair: ['ddangi', 'ddamong'], lines: [['ddangi', '냉장고 가자땅!'], ['ddamong', '아까 먹었따몽.'], ['ddangi', '또 먹었땅!'], ['ddamong', '…하나만이따몽.']] },
  // 땅이 · 시바
  { pair: ['ddangi', 'shiba'], lines: [['ddangi', '시바 일어났땅?'], ['shiba', '…쿨…'], ['ddangi', '꼬리 당긴다땅!'], ['shiba', '뭔일이래?!']] },
  { pair: ['ddangi', 'shiba'], lines: [['ddangi', '빠삭하러 가자땅!'], ['shiba', '좋았씨바…'], ['ddangi', '내가 먼저땅!'], ['shiba', '자리 맡았씨바!']] },
  // 땅이 · 감자
  { pair: ['ddangi', 'gamja'], lines: [['ddangi', '감자 뭐 읽었땅?'], ['gamja', '오리 백과사전!'], ['ddangi', '나도 나왔땅?'], ['gamja', '대장은 없었감자.']] },
  { pair: ['ddangi', 'gamja'], lines: [['gamja', '퀴즈 냈감자!'], ['ddangi', '정답은 만두땅!'], ['gamja', '아직 안 냈감자…'], ['ddangi', '헤헤헤~']] },
  // 따몽 · 시바
  { pair: ['ddamong', 'shiba'], lines: [['ddamong', '또 졸렸따몽?'], ['shiba', '조금 졸렸씨바…'], ['ddamong', '배 위에서 자따몽.'], ['shiba', '말랑했씨바…']] },
  { pair: ['ddamong', 'shiba'], lines: [['shiba', '형아 베개 해줘씨바'], ['ddamong', '마다오. 누웠따몽.'], ['shiba', '쿨…'], ['ddamong', '벌써 잤따몽…']] },
  // 따몽 · 감자
  { pair: ['ddamong', 'gamja'], lines: [['ddamong', '밥은 먹었따몽?'], ['gamja', '마다오! 먹었감자.'], ['ddamong', '기특했따몽.'], ['gamja', '헤헤, 좋았감자']] },
  { pair: ['ddamong', 'gamja'], lines: [['gamja', '연필 몇 자루였감자?'], ['ddamong', '열두 자루였따몽.'], ['gamja', '열세 자루였감자!'], ['ddamong', '…다시 셌따몽.']] },
  // 시바 · 감자
  { pair: ['shiba', 'gamja'], lines: [['gamja', '형아 꼬리 봤감자!'], ['shiba', '뭔일이래?'], ['gamja', '난 꼬리 없었감자'], ['shiba', '…충격이었씨바.']] },
  { pair: ['shiba', 'gamja'], lines: [['shiba', '같이 잤씨바?'], ['gamja', '공부해야 했감자.'], ['shiba', '딱 오 분만씨바…'], ['gamja', '…오 분만이었감자.']] },
];

/** 대사 속 {이름}·{상대}·{친구} 를 실제 이름으로 */
export function fillNames(talk: Talk, names: { 이름: string; 상대: string; 친구?: string }): Talk {
  const f = (text: string) =>
    text.replaceAll('{이름}', names.이름).replaceAll('{상대}', names.상대).replaceAll('{친구}', names.친구 ?? '');
  return {
    pages: talk.pages.map(f),
    choices: talk.choices?.map((c) => ({ label: c.label, reply: c.reply.map(f) })),
  };
}

/** 게임 시각(시) 기준 인사 */
export function greetingFor(info: VillagerInfo, h: number): Talk {
  if (h >= 5 && h < 11) return info.greetings.morning;
  if (h >= 11 && h < 19) return info.greetings.day;
  return info.greetings.night;
}

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
