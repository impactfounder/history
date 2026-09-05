# 진행 상황 — 2026-09-05

이어서 작업할 때 이 문서부터 본다. 결정 기록은 PRD 부록 A·§11, 데이터 규칙은 data-model, 원문 정책은
editorial-policy에 있다. 여기는 **지금 어디까지 왔고 다음에 무엇을 하는가**만 적는다.

## 한눈에

| 항목 | 상태 |
|---|---|
| 사건 | **11,615건** (한국 3,263 · 중국 4,722 · 일본 1,409 · 미국 2,055) |
| 덮인 십년 버킷 | 한국 80% · 중국 98% · 일본 72% · 미국 100% |
| 원천 | 위키백과 연표 9편(ko·en·ja·zh) + 중국 왕조별 5편 + 국사편찬위원회 연표 + 위키데이터 사건·재위 |
| UI | 4개 언어(ko 기본·en·ja·zh), 네이티브 스크롤 축, 3레벨 줌, 상세 패널 폭 사다리, 모바일 핀치·스크러버 |
| 배포 | 빌드·SSG(2,525쪽)·sitemap·robots 준비 완료. **아직 배포 안 함** |
| 테스트 | 68개 통과(axis 46 · nikh-match 13 · i18n 9). typecheck 통과 |

## 대표 손이 필요한 것 (막힌 순서대로)

1. **API 키** — `.env`에 `ANTHROPIC_API_KEY=…` 한 줄. 그러면 `node --env-file=.env tools/translate.mjs --sample 100`
   (약 $0.2)로 품질을 보고, 괜찮으면 전체 4,819줄(약 $5~10). **지금 가장 큰 구멍**: 한국어 UI인데
   중국·일본·미국 열의 88~93%가 원문(영·중·일) 그대로다. 검색 스니펫·애드센스 심사도 같은 문제에 걸린다.
2. **배포** — `npx vercel login` → `npx vercel --prod`. 도메인 없이 `*.vercel.app`로 바로 나온다.
   링크가 있어야 폰 실기기 확인(부록 A-10)이 가능하다.
3. **국사편찬위 매칭 검수** — `curation/_probe/nikh-match-sample.md`에 ○/×/△. 40건, 한국사 판단이라 사람 몫.
4. **미정** — 도메인(historymap.world 등 후보 조사됨: `.world` 3년 14.2만 원, `.app`도 가능),
   후원 방식(Ko-fi 대 카카오페이 송금), 브랜드·서비스명(A-3·A-4·C-10).

## 다음에 할 일 (키 없이 가능한 것)

- `/y`·`/sources` 페이지 다국어 — 지금 한국어만. 색인 대상이라 `?lang=`이 아니라 언어별 URL이어야 한다.
- 일본 열 72% 재도전 — 위키 계열은 한계에 닿았다(연표 문서 없음, 위키데이터 사건도 고대는 비어 있음).
  일본 국립국회도서관·국사대사전 같은 자국 자료의 이용 조건부터 조사.
- 성능 실측 C-9 — 줌·스크롤 중 프레임. **탭이 앞에 있어야** 잰다(백그라운드는 rAF가 멈춘다).
- 정치체 연도 재검토 — 삼국 시대 시작 등은 자국어판 문서 첫 문단을 따랐다(data-model §4-5). 남은 이견 확인.

## 데이터 파이프라인 (순서대로)

```
node tools/collect.mjs [kr cn jp us]     위키백과 연표 → curation/raw/{region}/candidates.jsonl
node tools/wikidata-events.mjs [지역]     위키데이터 사건·재위 → curation/raw/{region}/wikidata.jsonl
node tools/fetch-nikh.mjs                국사편찬위 CSV → curation/raw/nikh/timeline.jsonl (131MB, 레포 밖)
node tools/nikh-events.mjs               고려·조선 구간 2,143건 → curation/events/kr-nikh.jsonl
node tools/enrich.mjs                    QID → 언어판 수·유형·사이트링크 (curation/raw/_qid-sitelinks.json)
node tools/summaries.mjs                 ko 표제어 → 한국어 위키백과 첫 문단 (curation/summaries/ko.jsonl)
node tools/translate.mjs                 원문 → 한국어 (API 키 필요, curation/translations/ko.jsonl)
node tools/derive.mjs                    위 전부 → curation/events/{region}.jsonl (git 추적)
npm run publish:preview                  → public/data/v1 (gitignore, 빌드 때 재생성)
```

수집기를 돌릴 때는 위키미디어 예절상 `MVMT_CONTACT=you@example.com`을 앞에 붙인다.

## 최근에 고친 함정 (다시 밟지 말 것)

- **연도 오파싱 세 겹** — "3年間弱に…"(기간), "1 大化"(목록 번호), **"3 to 11 May"·"6 and 9 August"(날짜 범위)**.
  마지막 것이 제일 나빴다: 그 줄이 서기 3년이 되면 **뒤따르는 날짜 줄들이 그 해를 물려받아** 미드웨이 해전이
  서기 4년에 놓였다. 일본 열 서기 1~99년 행 120 → 3.
- **한 QID에 매달린 여러 줄** — 송나라 42줄·쓰촨성 15줄이 세기 화면을 채웠다. 한 QID는 세기·십년에 한 번만.
- **개념 항목이 세기 대표** — 불교·컴퓨터·철기 시대. 순위 점수는 "사건임을 증명해야 1점"이다.
- **사건 id에 연도가 없었다** — 같은 문장이 여러 해에 반복되면 같은 id가 됐다(React 중복 키).
- **발행 파일 캐시** — 경로가 발행마다 같아 브라우저가 옛 청크를 붙들었다. 요청에 `?v=publishedAt`.
- **SPARQL 날짜에 부호가 없다** — "1592-05-23". 부호를 필수로 둔 정규식이 전부 걸러 1건만 남겼다.
- **위키데이터 SPARQL은 유형 하나씩** 던진다. 27종을 묶으면 59초, 하위분류까지 얹으면 504.
- **문서 구간 치환 사고** — 마커가 변경 이력에도 있어 절이 통째로 지워졌다. 절 제목 이후에서만 찾고
  `git diff --stat`을 본다.
- **백그라운드 탭** — rAF가 멈추고 타이머가 조여져 성능 측정·긴 스크립트가 실패한다.
