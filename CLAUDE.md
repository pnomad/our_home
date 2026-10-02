# 우리 집 (our_home)

뚱땡이·뚱순이 둘이 번갈아 하는 동숲풍 3D 인형의 집 게임. 인형 넷(땅이·따몽·시바·감자)이 집 안에서 알아서 살고, 밤에는 가끔 이벤트가 벌어진다.
Three.js + TypeScript + Vite, 서버 없음. 코드 주석·커밋 메시지·대사는 모두 한국어.

## 실행 · 확인

```
npm install
npm run dev        # http://localhost:5173 (게임), /characters.html (캐릭터 도감)
npm run build      # tsc 타입 검사 + 빌드. 테스트 코드는 없음 → 바꾼 뒤엔 꼭 build 로 확인
```

테스트용 주소 옵션 (여러 개 `&` 로 이어 붙임):

| 옵션 | 뜻 |
|---|---|
| `?who=ttungsuni` / `ttungttaengi` | 시작 화면의 "누구로 놀까요?" 건너뛰기 |
| `?night=1`, `?time=18.5` | 밤 9시 / 오후 6시 반에서 시작 (새벽 1시 = 25) |
| `?event=cat` / `fridge` / `none` | 잘 때 밤 이벤트 고정 (평소엔 각각 10% 확률) |
| `?bird=crow` / `sparrow` / `pigeon` / `magpie` | 그 새가 바로 침실 창문에 찾아옴 (평소엔 매일 10:30~12:00 사이 한 번, 무작위) |
| `?day=3` | 3일째로 시작 (축구공은 3일째부터) |
| `?read=1` | 감자가 바로 소파에서 책을 읽음 |
| `?story=sock` / `sockpair` / `fashion` / `sockwash` | 양말 이야기를 바로. 평소엔 4일째 9:20~12:00 소동 → 13:00~17:00 짝 잃은 양말 → 17:00~20:30 패션쇼, 5일째 9:20~12:00 빨래 (앞 이야기를 봐야 다음이 나옴, 본 건 localStorage `our-house:<이름>-done`) |
| `?style=block` / `plush` / `voxel` | 인형 그리는 스타일 (기본 plush) |
| `?zoom=0.4` | 카메라 줌 |
| characters.html `?angle=0.5` | 도감 회전 고정 (라디안) |

개발 모드에선 브라우저 콘솔에 `__game` 이 있다: `__game.goToSleep()`, `__game.talkTo(__game.villagers[0])`, `__game.doLaundry()`, `__game.setRadio(true)`, `__game.bird('crow')`, `__game.life.queueRead(__game.villagers[3])`, `__game.clock.update(60)`(게임 시간 60분 앞당김) 등.

화면으로 확인할 때는 Playwright(크로미움)로 위 주소를 열고, 대화창은 스페이스 키로 넘기면서 스크린샷을 찍으면 된다. `goToSleep()` 처럼 연출이 끝나야 끝나는 함수는 `page.evaluate` 에서 await 하지 말 것 (대화를 넘길 수 없어서 멈춤).

## 구조

- `src/main.ts` — 루프, 플레이어 이동·점프, 말 걸기 대사 고르기(`nextTalk`), 행동 버튼(말 걸기·잘 자기·빨래하기), 밤 이벤트 고르기(`pickNightEvent`)
- `src/data/villagers.ts` — 인형 성격·말투·대사 전부. **대사 고칠 땐 이 파일만**
- `src/entities/`
  - `villager.ts` 주민 몸 동작(걷기·폴짝·눕기·말풍선), `life.ts` 주민이 하루에 뭘 할지(빠삭·낮잠·싸움·장난)
  - `shapeSpecs.ts` 캐릭터 설계도(덩어리 + 얼굴 무늬). `plushStyle.ts`·`voxelStyle.ts` 가 이걸 그림, `models.ts` 는 블록 스타일
  - `meltStyle.ts` 덩어리를 녹여 붙인 한 겹 표면 (지금은 고양이·쓰레기봉지만 사용)
  - `dirt.ts` 꼬질꼬질 흙먼지 얼룩 붙이기/떼기
  - `life.ts` 에 감자 독서(소파 위 책 두 권 중 하나를 펼쳐 듦), 축구공 패스·혼자 차기도 있음
  - `modelStyle.ts` 블렌더로 만든 진짜 3D 인형 모델(`public/models/*.glb`). 모델이 있는 인형은 말랑 인형 스타일에서 이걸로 그림 (지금은 시바)
  - `dance.ts` 라디오 춤 (땅이 땅댄스 = 날개 쫙 벌리고 몸만 흔들기, 나머지는 각자 흔들흔들). 팔은 설계도 덩어리의 `part: 'armL' | 'armR'` 로 따로 움직임
- `src/events/` — 밤 이벤트. `common.ts` 에 잠들기·다음 날 아침·연출 도구(tween, hop, walk)
  - `fridgeRaid.ts` 냉장고 털기: 시바→감자→따몽→땅이 탑 쌓기 → 와르르 → 만두 몰래 먹기
  - `catFight.ts` 고양이 소동: 대문 앞 쓰레기봉지 뒤지는 고양이와 한판 → 꼬질꼬질
  - `laundry.ts` 씻는 날: 빨래망 → 드럼세탁기 → 빨래건조대에서 말리기
  - `sockStory.ts` 4일째 점심 전 양말 소동 (낮 연출, 대화창): 시바 발견 → 땅이 머리에 "모자땅!" → 감자 "양말이었감자" → 따몽 "나는 발이 없는데…" → 시바도 머리에 → 감자가 발에 신고 "내꺼다!" → 땅이 추격. 그날은 양말 그대로, 잘 때 벗음
    - 양말 소품·입히기(`createSock`, `wearOnHead`/`Foot`/`Ear`, `wearAsScarf`, 머리에 쌓아 들기 `carryOnHead`)도 여기. 입으면 그 자리 모양(비니·발 감싸기·목에 한 바퀴·귀에 씌워 대롱)으로 바뀌고, 날아갈 땐 원래 양말 모양. 인형별 머리 크기는 `HEADS`. 잘 때 `takeOffSocks`
  - `sockAfternoon.ts` 4일째 오후: 짝 잃은 양말(소파에 뻗음 → 감자 책 "두 짝이 한 켤레" → 침대 위 시바 머리 양말 몰래 작전 → 따몽이 이불 덮어 주고 중재 → 감자 두 짝 행진) · 양말 패션쇼(땅이가 옷장 양말 꺼내 옴 → 라디오 → 런웨이 → "누가 제일 멋있었땅?" 고르기)
  - `sockWash.ts` 5일째 아침 양말 빨래: 땅이 킁킁 "…빨아야 했땅!" → 세탁기 → 건조대 "내 모자땅!" "아니에오, 양말이었감자!" → 한 짝씩 나눠 가짐
  - 양말 이야기 순서·시각은 `main.ts` 의 `SOCK_STORIES`, 본 뒤 대사는 `villagers.ts` 의 `afterSock[이야기]`
  - `birdVisit.ts` 아침 손님 (낮, 게임 안 멈춤, 말풍선): 침실 창밖 창턱에 새. 참새·비둘기·까치는 땅이·감자가 헤드보드 위에서 대화, 까마귀는 땅이 깜짝·따몽 "문 열면 위험해!"·감자 창문 잠금·시바 구경. 새 모양은 `entities/birds.ts`
- `src/world/` — `house.ts` 집·가구(인형 키 1칸 기준, 전부 축 정렬 상자, 거실 테이블 위 라디오), `places.ts` 주민 이동 지도, `clock.ts` 게임 시계(하루 = 실제 20분, 날짜는 localStorage), `lighting.ts`, `radioMusic.ts` 라디오 노래(126 BPM, 파일 없이 브라우저에서 합성), `ball.ts` 축구공(굴러감·튕김·밀림, 3일째부터 소파 앞)
- `src/ui/` — 대화창, 암전, 시계, 시작 화면
- `src/claw/` + `claw.html` — 거실 컴퓨터로 하는 인형뽑기 (pnomad/zzang 에서 가져옴). Rapier 물리. 집에서는 화면 가득 iframe 으로 열고, 오락실에서 Esc → `postMessage('claw:exit')` 로 집에 돌아옴
  - `physics/plushMesh.ts` 인형 부품을 녹여 붙인 한 겹 천 겉모습, `prizes/plushDent.ts` 집게 발이 파고든 자리가 움푹
  - 인형 천 접촉: 마찰은 큰 쪽(Max), 튕김 0, 회전 감쇠 큼 (`prizes/ragdoll.ts`). 속심(PLUSH_CORE)을 줄이면 오히려 잘 미끄러지니 0.8 유지
  - 배출구 앞 힘 빠짐은 집은 뒤(올라갈 때부터)에만 (`game/controller.ts powerFor`)
  - 개발 콘솔 `__claw` (enter, rig, ctrl, `pause = true` 로 물리 멈춤). 같은 더미로 비교하려면 `Math.random` 을 시드 고정한 뒤 `rig.fillPrizes()`

집 좌표: x -21~23 (침실 · 거실 · 부엌 순), z -6(뒷벽)~6(앞, 벽 없음), y 위. 캐릭터는 +z 를 앞으로 본다.

## 3D 모델 만들기 (블렌더)

블렌더를 파이썬 모듈(bpy)로 설치해서 스크립트로 모델을 만든다. 블렌더 프로그램을 열 필요 없음.

```
python3 -m venv .blender && .blender/bin/pip install bpy==4.2.0   # 약 500MB, 파이썬 3.11 필요
.blender/bin/python tools/blender/shiba.py [미리보기.png]          # public/models/shiba.glb 로 내보냄
```

- `tools/blender/common.py` — 타원체 덩어리 합치기 → 복셀 리메시 + 매끈하게, 솔기 홈, 정점 색칠, 얼굴 단추(눈·코) 붙이기, glb 내보내기, Cycles 미리보기
- 좌표: 블렌더 Z 위 · -Y 앞으로 만들면 glb 에서 게임 좌표(Y 위, +Z 앞)가 된다. 크기는 게임 그대로 (키 약 1칸)

## 인형들 · 말투

공통: 맞다 → **마다오**, 틀리다 → **아니에오**, "무슨 일이데오?", "뭔일이래?". 대사는 과거형으로 끝나는 게 특징 ("~했땅", "~였씨바").

| 인형 | 순서 | 모습 | 말끝 | 성격 |
|---|---|---|---|---|
| 땅이 | 첫째 | 흰 오리 | ~땅 | 대장, 장난꾸러기, 냉장고 좋아함 |
| 따몽 | 둘째 | 보라 말랑이 | ~따몽 | 듬직한 형아, 동생들 챙김 |
| 시바 | 셋째 | 주황 시바견 인형 (엎드린 식빵 모양, 참고 사진 기준) | ~씨바 | 잠꾸러기, 빠삭(햇빛) 좋아함, 물 싫어함 |
| 감자 | 넷째 | 크림색 달걀 오리 | ~감자 | 똑똑이, "책에서 봤감자", "과학이었감자" |

## 작업 규칙

- 요청받은 캐릭터·파일만 건드린다. 특히 캐릭터 모양을 고칠 땐 다른 캐릭터는 그대로.
- 모양을 바꾸면 characters.html 이나 게임 화면을 스크린샷으로 찍어서 전후 비교.
- 새 밤 이벤트는 `events/common.ts` 의 `fallAsleep` / `wakeUp` 을 써서 만들고, `main.ts` 의 `pickNightEvent` 에 연결.
- 코드 스타일: 주변 코드처럼 짧은 한국어 주석, `// ---------- 1. 제목 ----------` 식 구역 나누기.
