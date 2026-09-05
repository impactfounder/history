# history — 나라별 비교 연표

여러 나라의 역사를 **같은 연도 축** 위에 나란히 놓는다. 그 해, 그 나라에 무슨 일이 있었나.
기본 4열 한국·중국·일본·미국, 기원전 500년~2026년. 시간 이동은 브라우저 스크롤, 확대는 Ctrl+휠.

- 사건 본문은 **원천의 원문 그대로**다 — 위키백과 연표 한 줄, 한국 열은 국사편찬위원회 연표 항목까지.
  우리가 쓴 문장은 없고, 사건마다 출처와 라이선스를 표기한다(NOTICE, `/sources`).
- LLM·서버·DB 없음. 수집 → 파생 → 발행이 전부 스크립트이고 읽기 경로는 정적 JSON뿐이다.

## 실행

```
npm install
npm run dev          # http://localhost:3000
npm test             # vitest — 좌표계(axis)·매칭(nikh-match)
npm run typecheck
```

## 데이터 파이프라인

```
node tools/collect.mjs kr cn jp us   # 위키백과 연표 → curation/raw/{region}/candidates.jsonl
node tools/enrich.mjs                # QID → 언어판 수 (중요도 프록시)
node tools/fetch-nikh.mjs            # 국사편찬위 연표 CSV → curation/raw/nikh/timeline.jsonl
node tools/derive.mjs                # → curation/events/{region}.jsonl (git 추적, 발행 원본)
npm run publish                      # → public/data/v1/ (정적 JSON 청크)
```

`curation/raw/`와 `public/data/`는 재현 가능한 파생물이라 추적하지 않는다. 위키미디어 API
예절상 `MVMT_CONTACT=you@example.com`을 붙여 수집기를 돌린다.

## 배포

`npm run build`가 발행(`prebuild` → `public/data/v1`)까지 포함한다. 국사편찬위 연표 원본이 없는 CI는
`curation/nikh/official-years.json`(추적됨)으로 같은 파일을 만든다. Vercel이면 레포를 import하거나
`npx vercel --prod`. 환경변수는 없어도 되고, 도메인이 정해지면 `NEXT_PUBLIC_SITE_URL`로 sitemap·canonical의
기준 URL을 준다(없으면 Vercel 프로덕션 호스트).

## 문서

- **`docs/status.md` — 진행 상황. 이어서 작업할 때 여기부터**
- `docs/PRD.md` — 제품 정의와 결정 기록(부록 A)
- `docs/data-model.md` — 스키마·파이프라인·발행 포맷
- `docs/editorial-policy.md` — 열 귀속·관점별 명칭·원문 사용 원칙

## 라이선스

코드·문서 MIT(LICENSE). 사건 본문은 제3자 자료 — 위키백과 CC BY-SA 4.0, 국사편찬위원회
공공누리 제1유형(NOTICE).
