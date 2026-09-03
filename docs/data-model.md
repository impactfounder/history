# history — 데이터 모델과 큐레이션 파이프라인

| 항목 | 내용 |
|---|---|
| 버전 | 0.7 (초안) |
| 작성일 | 2026-09-03 (0.7 갱신 2026-09-04) |
| 변경 이력 | 0.1 → 0.2: `event_names`(관점별 명칭) 신설. 기본 4열을 한국·중국·일본·미국으로 변경하고 유럽 롤업은 P1로 이동. `regions`에 수록 범위 필드 추가(PRD §11 C-3). 청크 발행을 연속 줌 전제로 정리(§6)<br>0.2 → 0.3: 기원전 세기 라벨 오류 수정(§3-4). **청크 파일 단위 확대**(연도 1년 → 10년 묶음 등)와 **요약문 분리**를 네이티브 스크롤 전환에 맞춰 반영(§6). PRD 0.4 §5-5·§5-5A 연동. 대표 지시 2026-09-04<br>0.3 → 0.4: 저장소를 M1 동안 **레포 내 파일(JSONL) + git 이력**으로(PRD 부록 A-14). §4-4 상태 전이를 파일·커밋 기준으로 다시 쓰고 §4-5 파일 배치를 신설. 대표 지시 2026-09-04<br>0.4 → 0.5: §4-1에 **검증 기준 층**을 신설(editorial-policy §1-7). 권위 있는 자료의 이용 조건을 실제로 확인해 기록했다<br>0.5 → 0.6: **원천 프로브 실측**(`tools/source-probe.mjs`). 미국 연표가 시기별 문서로 쪼개져 있고 상위 문서는 표를 잃었다. §4-1 원천 표를 실측으로 교체하고 §5 처리량을 재작성. 발행 목표를 절대 건수에서 밀도로 바꿨다(PRD §11 C-12)<br>0.6 → 0.7: **한국 열 수집 실측**(`tools/collect.mjs`). 오탐 가설이 틀렸음을 확인하고 §5-1 신설. QID가 사건이 아니라 인물을 가리키는 문제가 드러나 §4-2 [정규화]의 중복 병합 규칙을 개정 |
| 상태 | 스키마 확정 전. **M1은 마이그레이션 없이 JSONL로 시작**하고, 실제 데이터 모양을 본 뒤 스키마를 굳힌다(PRD 부록 A-14) |
| 관련 문서 | `docs/PRD.md` §5-3, §5-5A(시간축 좌표계), §6 · `docs/editorial-policy.md` |
| 저장소 | **M1은 레포 내 파일(JSONL) + git 이력**(PRD 부록 A-14). Supabase(Postgres)는 트리거가 참일 때 도입. 읽기 경로는 어느 쪽이든 §6 정적 JSON |

---

## 1. 설계 원칙

1. **사건–지역은 다대다 + 지역별 중요도.** 단일 `importance`로는 열별 top-N이 왜곡된다(임진왜란: 한국·일본 5, 중국 3~4).
2. **날짜는 관용 연도 + 원문 보존.** 자동 역법 변환 금지. 정밀도·근사·역법·전승 여부를 별도 필드로.
3. **연도는 천문학적 연수 정수.** 1 BC = 0, 2 BC = −1. 산술이 연속이고 정렬이 단순해진다.
4. **발행은 정적 JSON 생성.** DB는 진실 원본, 사용자는 CDN 파일만 읽는다.
5. **모든 파생 값은 별도 보존.** LLM 초안 중요도는 `importance_auto`, 확정값은 `importance`. 감사 가능해야 한다.
6. **명칭은 관점별.** 사건 이름은 열 국가 관점별로 `event_names`에 저장한다(한글 옮김 `text_ko` + 원문 `text_native`). 사건 레코드는 QID당 하나, 이름은 관점당 하나. 셀은 자기 열의 관점 명칭을 표시하고 없으면 중립 라벨 `events.title_ko`로 폴백한다. 관점은 명칭에만 적용되고 `event_regions`(귀속)에는 영향을 주지 않는다.

---

## 2. 스키마 (Postgres 표기, 마이그레이션 아님)

M1에서는 이 스키마가 **JSONL 레코드의 모양**이기도 하다. 테이블 하나 = 파일 하나, 행 하나 = 줄 하나로 읽으면 된다(§4-5). Supabase로 옮길 때 그대로 테이블이 된다.

### 2-1. regions — 열의 정체
```sql
create type region_kind as enum ('macro', 'lineage', 'alias');

create table regions (
  id          text primary key,            -- 'kr', 'cn', 'jp', 'eu', 'us', 'mn'
  kind        region_kind not null,
  parent_id   text references regions(id), -- alias→lineage, lineage→macro
  name_ko     text not null,
  name_en     text not null,
  color         text not null,             -- 열 색상 토큰 키(hex 직접 기입 금지)
  sort_order    int not null default 0,
  is_default    boolean not null default false,  -- 기본 4열: kr, cn, jp, us
  coverage_from int,                       -- 수록 시작 연도. 이전 구간은 "미수록"으로 표시
  coverage_to   int,                       -- 수록 끝 연도(보통 전년도). PRD §11 C-2
  coverage_note text                       -- 열 헤더 보조 문구: '1607년~ 수록'
);
```
- `alias` 행은 사건을 갖지 않는다. 검색·진입용.
- **기본 4열은 `kr`, `cn`, `jp`, `us`**(대표 결정 2026-09-03). `eu`(macro)는 P1.
- `macro` 열은 자식 `lineage`의 `event_regions`를 롤업한다(§6-1). **P1이므로 MVP 발행 대상 아님.**
- **`coverage_*`는 "데이터 없음"과 "사건 없음"을 구분하기 위한 필드다**(PRD §11 C-3). 미국 열의 1500년은 빈 셀이 아니라 "미수록" 구간으로 그려야 한다. 모르는 것을 아는 척하지 않는다.

### 2-2. polities — 시대 밴드
```sql
create table polities (
  id                 text primary key,     -- 'kr-joseon'
  region_id          text not null references regions(id),
  secondary_regions  text[] not null default '{}',
  lane               smallint not null default 1,  -- 병존 시 서브 컬럼
  name_ko            text not null,        -- 자칭(自稱)의 한글 표기: '조선', '중화민국'
  name_native        text,                 -- 자칭 원문: '朝鮮', '中華民國'
  name_en            text,
  start_year         int not null,         -- 천문학적 연수
  end_year           int,                  -- null = 진행 중
  start_precision    date_precision not null default 'year',
  end_precision      date_precision,
  historicity        historicity not null default 'historical',
  note               text
);
```

### 2-3. events — 사건
```sql
create type event_kind      as enum ('point', 'period');
create type date_precision  as enum ('day', 'month', 'year', 'decade', 'century', 'millennium');
create type calendar_kind   as enum ('gregorian', 'julian', 'lunisolar_kr', 'lunisolar_cn', 'lunisolar_jp', 'unknown');
create type historicity     as enum ('historical', 'traditional', 'legendary');
create type event_scope     as enum ('local', 'regional', 'global');
create type event_category  as enum ('politics', 'war', 'culture', 'science', 'economy', 'religion', 'disaster', 'person');
create type event_status    as enum ('draft', 'needs_review', 'reviewed', 'published', 'rejected');

create table events (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique,                    -- P1 사건 페이지용
  kind                event_kind not null,
  -- 날짜
  start_year          int not null,                   -- 천문학적 연수
  start_month         smallint,
  start_day           smallint,
  end_year            int,                            -- period만
  end_month           smallint,
  end_day             smallint,
  start_precision     date_precision not null default 'year',
  end_precision       date_precision,
  approximate         boolean not null default false, -- "무렵·경"
  calendar            calendar_kind not null default 'unknown',
  original_date_text  text,                           -- '태조 1년 7월 17일'
  display_date_ko     text,                           -- 큐레이터 수동 오버라이드
  historicity         historicity not null default 'historical',
  -- 내용
  title_ko            text not null,                  -- 중립 라벨(폴백용). Wikidata ko 라벨 기반. 셀 표시는 event_names 우선
  summary_ko          text not null,                  -- 사실에서 새로 작성(위키 요약 금지). 사건당 하나, 중립 서술
  perspective_note    text,                           -- 관점 차이 설명(선택). 상세 패널 "관점" 단락
  category            event_category not null,
  scope               event_scope not null default 'local',
  -- 연결
  wikidata_qid        text unique,                    -- 'Q…' 중복 제거 키
  parent_event_id     uuid references events(id),     -- 전쟁의 하위 전투
  merged_into         uuid references events(id),
  -- 워크플로
  status              event_status not null default 'draft',
  importance_auto     numeric(4,2),                   -- LLM·프록시 초안(감사용)
  review_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  published_at        timestamptz,
  constraint period_has_end check (kind = 'point' or end_year is not null)
);
create index on events (start_year);
create index on events (status);
```

### 2-4. event_regions — 사건–지역 관계 (핵심)
```sql
create type region_role as enum ('primary', 'secondary', 'mention');

create table event_regions (
  event_id    uuid not null references events(id) on delete cascade,
  region_id   text not null references regions(id),
  importance  smallint not null check (importance between 1 and 5),
  role        region_role not null default 'primary',
  primary key (event_id, region_id)
);
create index on event_regions (region_id, importance desc);
```
- 연도 페이지용 전역 중요도는 `max(importance)`로 파생.
- 사건당 `primary`는 1개 이상. `mention`은 셀에 표시하지 않고 상세 패널 "관련 지역"에만.

### 2-5. event_names — 관점별 명칭 (핵심)
```sql
create type name_source as enum ('sitelink', 'curator', 'llm_draft', 'fallback');

create table event_names (
  event_id        uuid not null references events(id) on delete cascade,
  perspective_id  text not null references regions(id),  -- 열 국가(lineage). macro 열은 자식 계보의 관점을 씀
  text_ko         text not null,        -- 한글 옮김: '분로쿠·게이초의 역'
  text_native     text,                 -- 원문: '文禄・慶長の役'
  lang            text,                 -- 원문 언어 코드: 'ja', 'zh', 'en', 'fr' …
  source          name_source not null, -- 원문 출처: 사이트링크 표제어 / 큐레이터 / LLM 초안 / 폴백
  reviewed        boolean not null default false,
  note            text,                 -- 같은 나라 안의 복수 표기 등
  primary key (event_id, perspective_id)
);
```
- **표시 규칙.** 열 `r`의 셀에서 사건 `e`의 이름 = `event_names[e][r].text_ko`. 없으면 `events.title_ko`(중립 라벨). 폴백 여부는 UI에 표시하지 않는다.
- **원천.** Wikidata 사이트링크의 각 언어판 표제어를 `text_native`로 자동 수집(`source = sitelink`). 한글 옮김은 LLM 초안(`llm_draft`) → 큐레이터 검토 시 `reviewed = true`. `reviewed = false`인 이름은 발행하지 않고 폴백한다.
- **macro 열(유럽, P1).** 사건이 태깅된 `lineage`의 관점을 그대로 쓴다. 프랑스 사건은 fr 표제어의 한글 옮김.
- **미국 열.** en.wikipedia 표제어의 한글 옮김. 1607년 이전은 수록하지 않으므로 관점 명칭도 없다.
- **언어 ≠ 관점.** 중국 열(cn)과 대만은 둘 다 zh이지만 관점이 다를 수 있다. MVP는 lineage 하나에 관점 하나로 단순화하고, 같은 나라 안 복수 표기는 `note`에 기록(editorial-policy E-12·E-13).
- **인물명은 저장하지 않는다.** 인물명은 UI 언어 관용을 따르므로(editorial-policy §3-4) 관점별 이름이 없다.
- polities는 자칭 하나만 있으므로 `polities.name_ko / name_native`로 충분하다. 타칭(이씨조선 등)은 사건 본문·`perspective_note`에서만 등장한다.

### 2-6. sources — 출처
```sql
create table sources (
  id           bigserial primary key,
  event_id     uuid not null references events(id) on delete cascade,
  url          text not null,
  title        text,
  revision     text,                -- 위키 리비전 ID
  accessed_at  date not null,
  license      text not null        -- 'CC BY-SA 4.0', 'CC0', 'public domain', …
);
```

### 2-7. review_log — 수정 이력
```sql
create table review_log (
  id          bigserial primary key,
  event_id    uuid not null references events(id),
  actor       uuid not null,        -- auth.users.id
  from_status event_status,
  to_status   event_status,
  diff        jsonb,                -- 변경 필드
  note        text,
  created_at  timestamptz not null default now()
);
```

---

## 3. 날짜 규칙

### 3-1. 버킷 소속
| kind | 버킷 질의 | `+N` 카운트 |
|---|---|---|
| point | `start_year`가 속한 버킷만 | 시작 버킷 |
| period | `start ≤ bucket_end AND end ≥ bucket_start` (겹치는 모든 버킷) | 시작 버킷에서만 |

### 3-2. 표시 규칙
- period가 현재 레벨에서 2행 이상이면 셀 좌측 거터에 세로 막대(라벨은 시작 행). 1행 이하면 시작 버킷에 칩 + "(1592–1598)".
- 전쟁의 하위 전투는 별도 `point` + `parent_event_id`.
- 정밀도가 레벨보다 거친 사건은 대표 연도에 점선 + "~" 접두.
- `historicity = traditional`은 "(전승)" 접미 + 별도 스타일.

### 3-3. Wikidata 매핑
| Wikidata | 우리 필드 |
|---|---|
| P585 point in time | `kind=point`, start_* |
| P580 start time / P582 end time | `kind=period`, start_*/end_* |
| 정밀도 코드 7/8/9/10/11 | century/decade/year/month/day |
| 역법 모델 Q1985727 / Q1985786 | gregorian / julian |
| P31 instance of (battle·war·treaty …) | `category` 초안 |
| P276 location, P710 participant | 지역 귀속 **힌트**(결정은 사람) |
| P17 country | **사용하지 않음** — 현대 국가를 가리켜 전근대 귀속에 부적합 |

### 3-4. 표시 변환
- 연도: `y <= 0` 이면 `기원전 ${1 - y}년`, 아니면 `${y}년`
- 세기 라벨: 버킷은 `Math.floor(y / 100) * 100`의 **균일 floor**를 유지한다. 서기는 현행대로 "1500년대"(1500–1599).
- **기원전 라벨은 범위 표기다.** `floor` 버킷 `[−500, −401]`의 실제 범위는 기원전 501년~기원전 402년이므로 "기원전 500년대"라는 이름과 어긋난다(0.2의 "(−599~−500)" 표기는 어느 floor 버킷과도 일치하지 않는 오류였다). 기원전 구간 버킷은 `[−500,−401]` … `[−100,−1]` **다섯 개뿐**이라 범위 표기가 장황해지지 않는다.
  - 예: `−500` 버킷 → "기원전 501–402년"
  - 이음매 버킷 `[0, 99]`는 "기원전 1년–서기 99년". 데이터가 가장 희소한 구간이라 비용이 사실상 0이다.
- 기원전만 원점을 옮겨 "기원전 5세기 = 500~401년"에 맞추는 안은 **채택하지 않는다** — 축에 이음매가 생기고 PRD §5-5A `visibleRows`의 O(1) floor 계산에 분기가 붙는다.
- 이 절의 규칙은 PRD §5-5A `formatRowLabel`의 명세다. 표시 문자열은 그 함수 하나에서만 만든다.

---

## 4. 큐레이션 파이프라인

### 4-1. 원천과 우선순위 (2026-09-03 실존 확인)
| 순위 | 원천 | 열 | 라이선스 | 비고 |
|---|---|---|---|---|
| 1 | ko.wikipedia 「한국사 연표」 | 한국 | CC BY-SA 4.0 | 시대별 표, BC 70만~2026, `BC.2333년` 표기 |
| 1 | ko.wikipedia 「세계사 연표」 | 세계 보조 | CC BY-SA 4.0 | "세계 / 한국" 2열 표 |
| 2 | en.wikipedia Timeline of Chinese history | 중국 | CC BY-SA 4.0 | Year/Date/Event 표, 약 500건+, BC 841 이전 연대 논쟁 명시 |
| 2 | en.wikipedia Timeline of Japanese history | 일본 | CC BY-SA 4.0 | Year/Date/Event 표, 메이지 이후 밀도 급증 |
| 1 | en.wikipedia Timeline of Korean history | 한국 | CC BY-SA 4.0 | 목록형 166항목, **링크 99%**. ko 연표보다 깨끗하다 |
| 2 | en.wikipedia **Timeline of the history of the United States (시기별 9개)** + Timeline of pre–United States history | **미국(P0, 기본 4열)** | CC BY-SA 4.0 | 목록형. `Timeline of United States history`는 이제 `Outline of the history of the United States`로 리다이렉트되고 표가 없다(2026-09-04 확인) |
| 3 | Wikidata | 전체 | CC0 | QID·날짜 정밀도·사이트링크. 동아시아 전근대 커버리지 약함 |
| 4 | ko.wikipedia 「일본사 시대 구분표」, 각 왕조 문서 | polities | CC BY-SA 4.0 | 시대 밴드 시작·종료 연도. 표 1개·38행 확인 |

ko.wikipedia에 중국·일본·미국 단일 연표 문서는 **없다**. 이 열들은 영어 원천 → LLM 초안 → 사람 검토가 기본 흐름이다.

**위키백과 연표는 표와 불릿 목록을 섞어 쓴다.** 미국 시기별 문서와 en:Timeline of Korean history는 표가 0개이고 전부 목록이다. 수집기는 둘 다 다뤄야 한다 — 표만 파싱하면 미국 열이 통째로 비어 버린다.

**검증 기준 — 수집하지 않고 대조만 하는 자료** (editorial-policy §1-7, 2026-09-04 확인)

| 자료 | 열 | 이용 조건 | 쓰임 |
|---|---|---|---|
| 국사편찬위원회 한국사데이터베이스 | 한국 | 공공데이터포털에 XML 개방. **출처 표시·비상업적·변경 금지** | 연도·사실 대조, `sources`에 링크 병기 |
| 한국민족문화대백과사전 | 한국 | **자유 이용 표기 없음**("All Rights Reserved") | 사람이 열어 대조만 |
| Library of Congress loc.gov JSON API | 미국 | 인증 키 불필요, 퍼블릭 도메인 콘텐츠 다수 | 1차 사료 링크, `sources` 병기 |
| 교과서·수능 색인 | 한국 | — | 중요도 가산 신호(§4-3) |

이 층의 텍스트는 **본문에 들어가지 않는다.** 복제·재배포가 아니라 대조와 링크만 하므로 라이선스 문제가 생기지 않는다.

**라이선스가 열려 있어도 선별은 공짜가 아니다.** Library of Congress API는 퍼블릭 도메인 자료를 키 없이 대량으로 주지만, 그것은 신문 지면 1,200만 장이지 "미국사에서 일어난 600건"이 아니다. **무엇이 그 해의 사건인가를 판단한 결과물은 여전히 연표 문서뿐이고, 그래서 수집 원천은 위키백과로 남는다.** 공신력 높은 자료를 원천으로 바꾸는 선택지는 라이선스와 선별 양쪽에서 성립하지 않는다.

### 4-2. 단계
```
[수집]   연표 문서 파싱 → staging(raw_events: 원문 행, 출처 URL·리비전)
   ↓
[정규화] Wikidata 사이트링크로 QID 부착. **QID 하나로 중복 병합하지 않는다**(§5-1)
         사이트링크의 각 언어판 표제어(ko·ja·zh·en·fr …) → event_names.text_native (source=sitelink)
         날짜 파싱(연도·정밀도·역법 초안) → 실패 시 needs_review 플래그
   ↓
[초안]   LLM(별칭 standard): title_ko(중립 라벨)·summary_ko 초안, category, scope,
         importance_auto, 지역 귀속 힌트,
         관점 명칭 한글 옮김 text_ko (source=llm_draft, editorial-policy §3-5 규칙을 프롬프트에 포함)
         ※ summary_ko는 "사실 3요소(연도·주체·결과)로 새로 작성" 지시. 원문 문장 인용 금지
         ※ 인물명은 옮기지 않음(UI 언어 관용). 사건명만
   ↓
[검토]   어드민 큐: 큐레이터가 editorial-policy §6 체크리스트로 확인
         importance 4·5는 사람이 확정. 지역 귀속은 "어느 연표에서 왔는가" + 사람 판단
         관점 명칭 text_ko 검토 → reviewed=true. primary 지역마다 이름이 있는지 확인
         draft → needs_review → reviewed → published (rejected / merged_into 별도)
   ↓
[발행]   published만 정적 JSON 청크 생성 → CDN 업로드 → /y/{year} ISR 재검증
```

### 4-3. 중요도 초안 프록시 (가정치, 검토 데이터로 재보정)
| 신호 | 가중치 | 의미 |
|---|---|---|
| 위키 언어판 사이트링크 수 | 40% | 범문화적 의의 |
| ko.wikipedia 인바운드 링크 수 | 30% | 한국 관점 관련성 |
| ko.wikipedia 30일 평균 페이지뷰 | 20% | 대중 관심(최근성 편향 주의) |
| 교과서·수능 색인 등재 | 가산(수동) | 한국 우선 신호 |

- 정규화 후 1~5로 양자화해 `importance_auto`에 저장. 확정값 `event_regions.importance`는 사람이 입력(초안 그대로 수락 가능).
- 지역별로 다르게 매길 것. 초안은 primary 지역에만 부여하고 secondary는 −1 시작.

### 4-4. 상태 전이와 권한
| 전이 | 누가 | 조건 |
|---|---|---|
| draft → needs_review | 파이프라인 | 초안 필드 채워짐 |
| needs_review → reviewed | 큐레이터 | 체크리스트 통과 |
| reviewed → published | 큐레이터(발행 권한) | 출처 1개 이상, primary 지역 1개 이상 |
| * → rejected | 큐레이터 | 사유 필수 |
| * → merged_into | 큐레이터 | QID 중복 확인 |
| published → needs_review | 큐레이터 | 오류 신고(P1) 접수 시 |

M1에서 상태 전이는 **파일의 `status` 필드를 바꾸고 커밋하는 것**이다. `review_log` 테이블은 만들지 않는다 — 누가·언제·무엇을이 git 이력에 그대로 남고, **왜**는 커밋 메시지에 쓴다(전이 사유는 `rejected`·`merged_into`에서 특히 필수). 배포면에 관리자 화면이 없으므로 인증도 없다.

Supabase로 옮기는 시점(PRD 부록 A-14)에 `review_log` 테이블과 `/admin/*` SSR 미들웨어 인증, `/api/admin/*` 라우트 내부 검증을 **함께** 붙인다.

### 4-5. M1 파일 배치
```
curation/
  raw/{region}/{source-slug}.jsonl   -- 수집 원문 행 + 출처 URL·revid·접근일
  events/{region}.jsonl              -- 정규화·초안·검토 상태를 담은 사건 레코드
  polities/{region}.json             -- 시대 밴드(수작업, 약 60개)
```
- 한 줄 = 사건 하나. `status` 필드가 §4-4의 상태다.
- 발행(§6)은 이 파일들에서 정적 JSON 청크를 생성한다. **`curation/`은 원본, `/data/v1/`은 파생물**이다.
- 한 줄이 한 사건이므로 diff가 사건 단위로 읽힌다. editorial-policy §5-4의 결정을 뒤집을 때 영향 범위를 `git diff`로 본다.

---

## 5. 처리량 — 2026-09-04 실측

### 5-1. 한국 열 수집 관통 (`node tools/collect.mjs kr`)

| 단계 | 건수 | 비율 |
|---|---|---|
| 후보 행 | 1,501 | 표 576 · 목록 925 |
| 본문 링크 보유 | 849 | 57% |
| QID 부착 | 812 | 54% — **링크 있는 것 중 96%** |
| 관점 명칭 3개 언어 이상 | 729 | QID 보유의 **90%** |
| 덮인 십년 버킷 | 195 / 253 | 77% |
| **고유 QID** | **361** | 부착 812건 대비 평균 2.25행/QID |

**오탐 가설은 틀렸다.** 0.6에서 "링크 없는 줄은 연표 항목이 아니라 산문일 것"이라고 적었는데, 표본을 보니 "1506년 중종반정으로 조선 연산군 폐위", "756년 발해가 상경 용천부로 천도", "1174년 조위총의 난" 같은 **진짜 연표 항목**이었다. `ko:한국사 연표`는 항목에 링크를 잘 걸지 않을 뿐이다. **링크 보유율을 데이터 품질 지표로 쓰면 안 된다.**

**대신 다른 위험이 드러났다 — QID가 사건이 아니라 인물·정치체를 가리킨다.** 부착된 812건의 고유 QID가 **361개뿐**이다. "875년 신라 헌강왕 즉위"에 붙는 QID는 사건이 아니라 헌강왕이고, 같은 왕의 다른 사건에도 같은 QID가 붙는다. §4-2를 문자 그대로 "QID 기준 중복 병합"으로 구현하면 **한 인물의 서로 다른 사건이 하나로 합쳐진다.**

개정: 병합은 `(연도, QID 집합)`이 함께 겹칠 때만 하고, 사건 자체의 QID는 사람이 확정한다. **QID의 1차 용도는 중복 판정이 아니라 관점 명칭 원천**(사이트링크 표제어)이다 — 그 쪽은 90%로 아주 잘 나온다.

**아직 남은 것 — 한 줄에 여러 사건.** "1920년 홍범도가 봉오동 전투에서 일본군을 격퇴, 김좌진이 청산리 대첩에서 일본군을 대파, 훈춘 사건"처럼 같은 해의 사건이 쉼표로 이어진다. 연도 경계로는 쪼갤 수 없으므로 §4-2 [초안] 단계에서 LLM이 나눈다.

수집기가 두 번 틀렸고 고쳤다. ① 표만 보다가 목록형 문서를 통째로 놓쳤다 ② en 연표가 연도를 부모 항목에 두고 자식에 날짜만 적는 구조(1994 → "21 October. …")라 성수대교 붕괴가 서기 21년이 됐다. 쪼갠 조각을 다시 파싱할 때도 같은 가드가 필요했다.

### 5-2. 처리량 가정

`tools/source-probe.mjs`로 §4-1 원천을 전부 받아 **후보 행**(첫 셀이 연도로 읽히는 표 행 + 연도로 시작하는 목록 항목)을 셌다. 전체 보고서는 `curation/_probe/report.md`.

| 열 | 후보 행 | 수록 범위 | 연당 밀도 | 십년당 1건 기준 | 배수 | 링크 보유 |
|---|---|---|---|---|---|---|
| 한국 | 907 | 2,526년 | 0.36 | 253 | 3.6배 | **38%** |
| 중국 | 1,082 | 2,526년 | 0.43 | 253 | 4.3배 | 98% |
| 일본 | 1,581 | 2,526년 | 0.63 | 253 | 6.2배 | **35%** |
| 미국 | 279 | 420년 (1607~) | **0.66** | 42 | 6.6배 | 89~100% |

**목표는 절대 건수가 아니라 밀도다**(PRD §11 C-12). 0.4의 "3,000건(한국 1,000 / 중국 800 / 일본 600 / 미국 600)"은 근거 없이 붙은 숫자였고, 특히 미국 열 600건은 수록 범위가 1/6이라는 것을 무시한 값이었다. 미국은 연당 0.66건으로 **네 열 중 가장 촘촘하다.**

**후보 행은 상한이고 오탐을 포함한다.** 연도로 시작하는 목록 항목을 모두 세므로 본문 서술 문장, 다른 시기 문서로 가는 내비게이션(`1760–1789`), 연도가 아닌 표기(`c. 15,500 year old arrowhead`)가 섞인다. **링크 보유율이 낮은 원천은 그만큼 오탐이 많다고 읽어야 한다** — 링크 없는 줄은 대개 연표 항목이 아니라 산문이다.

- 큐레이터 1인 시간당 약 100건 **(가정, 미검증)**. 첫 50건을 파이프라인 전 구간에 통과시킨 뒤 실측한다.
- 정치체 밴드 약 60개 **(가정)**는 수작업 입력.
- **다음에 잴 것은 건수가 아니라 오탐률이다.** 링크 보유율이 낮은 한국(38%)·일본(35%)은 후보 행의 상당수가 연표 항목이 아니라 산문 문장일 수 있다. 한국 열 50건을 파이프라인에 통과시키면서 `후보 행 → 연도 파싱 → 링크 보유 → QID 부착` 깔때기를 실측한다. 그 비율이 나오면 네 열의 실제 규모가 한 번에 정해진다.

---

## 6. 정적 JSON 발행 포맷

### 6-1. 파일 배치
```
/data/v1/
  regions.json                       -- 열 메타 전체
  polities/{region}.json             -- 시대 밴드
  events/{region}/{level}/{bucket}.json
        예: events/kr/century/all.json    (전 세기, 중요도 5)
            events/kr/decade/1500.json    (1500–1599의 십년 행, 중요도 ≥4)
            events/kr/year/1590.json      (1590–1599의 연도 행, 전부)
  events/detail/{id}.json            -- 요약문·출처 등 상세 전용
  years/{year}.json                  -- /y/{year} SSG 입력: 모든 지역 + 앞뒤 문맥
  manifest.json                      -- 발행 시각, 청크 해시, 사건 수
```
- 청크는 불변. 재발행 시 `manifest.json`의 해시가 바뀌고 클라이언트는 매니페스트만 재검증. **오류 수정 경로(재발행 → 해시 갱신 → CDN 무효화)는 M1부터 동작해야 한다**(PRD §11 C-8).
- 화면의 줌은 연속이지만 **청크는 세 의미 레벨로만 발행**한다. 클라이언트는 현재 스케일에 해당하는 레벨의 청크를 쓰고, 레벨 경계에서는 인접 레벨을 미리 받아 전환 시 빈 셀이 보이지 않게 한다.
- **청크 파일 단위는 행 단위보다 한 자릿수 크다.** PRD 0.4에서 시간 이동이 네이티브 스크롤이 되면서 관성 때문에 축을 훨씬 빠르게 훑게 됐다. 연도 레벨 `s=120`·뷰포트 800px이면 화면에 6.7년이 들어오고, 초당 2,000px 관성이면 **초당 약 17개 연도 청크**를 요청한다. 파일당 1년이던 것을 키워 요청 수를 1/10로 줄인다.

  | 레벨 | 행 단위 | 파일 단위 | 예 |
  |---|---|---|---|
  | 세기 | 100년 | **열당 1파일** | `century/all.json` |
  | 십년 | 10년 | **100년 묶음** | `decade/1500.json` = 1500–1599 |
  | 연도 | 1년 | **10년 묶음** | `year/1590.json` = 1590–1599 |

  행 버킷 → 파일 키 변환은 PRD §5-5A `chunkKeyFor` 하나에 모은다.
- **요약문은 처음부터 청크에서 분리한다**(`events/detail/{id}.json`). 0.2는 이것을 "크기 목표를 넘으면" 쓰는 예비책으로 두었는데 **기본값으로 승격**한다. 근거: 요약문이 필요한 시점은 언제나 한 번 더 탭·클릭한 뒤다 — 셀의 칩에도, 모바일 행 시트의 사건 목록에도 요약문은 나오지 않고 상세 패널을 열어야 비로소 필요하다(PRD §5-7·§5-10). 처음부터 빼두면 청크 크기가 사건 수에 선형으로만 반응해 예측이 안정되고, 근현대 밀집 구간에서 한계를 넘어 전량 재발행하는 위험이 사라진다.
- **프리페치는 스크롤 방향·속도 기반**으로 진행 방향 **±1.5화면 (가정)** + 인접 레벨 1단계. 관성이 있으므로 예측 거리가 드래그 모델보다 길어야 한다. 지나간 구간의 인플라이트 요청은 `AbortController`로 취소한다.
- `macro` 열(유럽)은 발행 시점에 자식 계보를 롤업해 자체 청크로 생성(클라이언트에서 합치지 않음). **P1.**
- **크기 목표 (가정, 모바일 기준).** 요약문을 뺀 **10년 묶음** 청크 1개 ≤ 20KB gzip, 폰 첫 뷰포트 합계 ≤ 50KB(2열 × 10년 묶음 2개 ≈ 40KB **(가정)**). 십년·세기 청크는 중요도 임계값 덕분에 더 작다. M1 발행 후 실측해 재보정한다.

### 6-2. 사건 청크 레코드
```json
{
  "id": "…", "kind": "period",
  "y0": 1592, "y1": 1598, "prec": "year", "approx": false,
  "hist": "historical",
  "title": "임진왜란",
  "names": {
    "kr": { "ko": "임진왜란" },
    "jp": { "ko": "분로쿠·게이초의 역", "nat": "文禄・慶長の役", "lang": "ja" },
    "cn": { "ko": "만력조선의 역", "nat": "萬曆朝鮮之役", "lang": "zh" }
  },
  "cat": "war", "scope": "regional",
  "regions": [ { "r": "kr", "imp": 5, "role": "primary" },
               { "r": "jp", "imp": 5, "role": "primary" },
               { "r": "cn", "imp": 3, "role": "secondary" } ],
  "date_ko": "1592년 4월", "orig": "선조 25년 4월 13일"
}
```
- **요약문(`summary`)과 출처(`src`)는 이 레코드에 없다.** `events/detail/{id}.json`에 따로 발행하고 상세 패널을 열 때 받는다. 목록 청크에는 셀과 행 시트를 그리는 데 필요한 것만 싣는다.
- 정렬은 발행 시 `imp desc, y0 asc, id asc`로 고정 저장. 클라이언트는 재정렬하지 않는다.
- 교차 사건은 관련된 모든 지역 청크에 중복 수록(클라이언트 조인 회피).
- `title`은 중립 라벨(폴백). 셀은 `names[열].ko`를 먼저 쓰고 없으면 `title`. `names`에는 `reviewed = true`인 이름만 들어가며, 모바일 행 시트가 모든 열의 이름을 한 번에 보여줘야 하므로 청크마다 전체 `names`를 싣는다.

---

## 7. 열린 사항
- 유럽 롤업 임계값(세기 레벨 5, 십년 ≥4, 연도 ≥3?) — P1 착수 시 결정.
- 레벨별 청크의 중요도 임계값이 PRD §5-3 표와 일치하는지, 그리고 **청크 파일 단위(§6-1)**가 실측 크기에 맞는지 M1에서 확인. 둘 다 바뀌면 전량 재발행이 필요하므로 **M1 발행 전에 확정한다**(대표 결정 2026-09-04).
- P2 다국어 시 `event_names`에 UI 언어 축이 추가된다(`text_ko` → `text_{ui_lang}`). 관점 × UI 언어 행렬이 되므로 그때 컬럼 확장 대신 `event_name_texts(event_id, perspective_id, ui_lang, text)`로 분리할지 결정.
- 한 lineage 안 복수 관점(중국 본토/대만, 남/북) 분리 여부 — MVP는 하나, P2 검토.
- 인물(`category = person`) 처리: MVP에서는 생몰을 point 사건 2개로 두고, P2 lifeline에서 `people` 테이블로 승격.
