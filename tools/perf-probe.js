/*
 * 성능 실측 C-9 — 프레임 간격. **앱 페이지의 DevTools 콘솔에 통째로 붙여넣어 실행한다.**
 *
 * PRD §11 C-9(537줄) 명세 그대로다:
 *   · 뷰포트 중앙에 Ctrl+휠 40회(16ms 간격, 확대 20 · 축소 20)
 *   · 프레임당 300px 스크롤 50회
 *   · requestAnimationFrame 간격을 기록해 33ms·50ms 초과 프레임 수를 센다
 *
 * ── 왜 콘솔에서 사람이 돌리는가 ────────────────────────────────────────────
 * **탭이 보이는 상태여야 한다.** 자동화(Chrome 확장 탭)는 visibilityState가 "hidden"이라
 * 두 번 실패했다(2026-09-05, 2026-09-20):
 *   · rAF가 2초에 0프레임 — 기다리면 렌더러가 통째로 멎는다(45초 타임아웃)
 *   · setTimeout(16)이 실제 1000ms — 명세의 16ms 간격 자체가 불가능
 * 그래서 이 스크립트는 **숨은 탭이면 즉시 거부한다.** 먹통이 되는 것보다 낫다.
 *
 * ── 쓰는 법 ────────────────────────────────────────────────────────────────
 *   1. 앱을 연다(프로덕션 빌드로: `npm run build && npx next start -p 3008`).
 *      **개발 서버로 재지 말 것** — 개발 React는 2배 느려 중앙값이 34.5 → 71.2ms가 된다.
 *   2. 창을 **앞으로** 두고 다른 창으로 가리지 않는다. 최소화·백그라운드 금지.
 *   3. F12 → Console → 이 파일 전체를 붙여넣고 Enter.
 *   4. 약 3초. 표가 찍히고 마지막 줄의 JSON을 복사해 두면 된다.
 *
 * 결과 읽는 법: 60fps = 프레임 예산 16.7ms. 33ms 초과는 "한 프레임 건너뜀",
 * 50ms 초과는 "세 프레임 건너뜀"이다. 기준선(가만히 둔 상태)과 견줘서 봐야 한다 —
 * 모니터가 60Hz가 아니면 기준선부터 16.7이 아니다.
 */
(async () => {
  const $ = (m) => console.log(m);

  if (document.visibilityState !== "visible") {
    $("%c중단 — 이 탭이 보이는 상태가 아닙니다.", "color:#c00;font-weight:bold");
    $("창을 앞으로 두고(최소화·다른 창에 가림 없이) 다시 실행하세요.");
    $("숨은 탭에서는 rAF가 멈추고 setTimeout이 1초로 조여져 측정 자체가 불가능합니다.");
    return;
  }

  const grid = document.querySelector('[role="grid"]');
  if (!grid) { $("%c중단 — 격자를 찾지 못했습니다. 그리드 화면(/)에서 실행하세요.", "color:#c00"); return; }

  /** 앱의 스크롤러 = 격자를 품은 스크롤 가능한 조상. 휠 리스너가 여기 붙어 있다. */
  const scroller = (() => {
    for (let el = grid; el; el = el.parentElement) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) return el;
    }
    return document.scrollingElement;
  })();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** rAF 간격을 모으는 기록기. 멈출 때까지 돈다. */
  const recorder = () => {
    const ts = [];
    let on = true;
    const step = (t) => { ts.push(t); if (on) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    return { stop: () => { on = false; return ts.slice(1).map((x, i) => x - ts[i]); } };
  };

  const stat = (d) => {
    if (!d.length) return { 표본: 0 };
    const s = [...d].sort((a, b) => a - b);
    const q = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
    return {
      표본: s.length, 중앙값: q(0.5), p95: q(0.95), 최대: +s[s.length - 1].toFixed(1),
      "33ms초과": d.filter((v) => v > 33).length,
      "50ms초과": d.filter((v) => v > 50).length,
      "초과율%": +((d.filter((v) => v > 33).length / d.length) * 100).toFixed(1),
    };
  };

  $("%c성능 실측 C-9 — 약 3초 걸립니다. 창을 건드리지 마세요.", "color:#1B9E7E;font-weight:bold");

  // ── 0. 기준선 — 아무것도 하지 않을 때의 프레임 간격(모니터 주사율이 여기 드러난다)
  let rec = recorder();
  await sleep(1000);
  const base = rec.stop();

  // ── 1. 확대·축소 — Ctrl+휠 40회, 16ms 간격, 뷰포트 중앙
  const cx = Math.round(innerWidth / 2), cy = Math.round(innerHeight / 2);
  rec = recorder();
  for (let i = 0; i < 40; i++) {
    scroller.dispatchEvent(new WheelEvent("wheel", {
      deltaY: i < 20 ? -100 : 100, ctrlKey: true,
      clientX: cx, clientY: cy, bubbles: true, cancelable: true,
    }));
    await sleep(16);
  }
  await sleep(200); // 마지막 렌더가 끝나도록
  const zoom = rec.stop();

  // ── 2. 스크롤 — 프레임당 300px, 50프레임
  const top0 = scroller.scrollTop;
  rec = recorder();
  await new Promise((done) => {
    let n = 0;
    const step = () => {
      scroller.scrollTop += 300;
      if (++n < 50) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  await sleep(200);
  const scroll = rec.stop();
  scroller.scrollTop = top0;

  const out = {
    측정시각: new Date().toISOString(),
    환경: {
      주소: location.origin + location.pathname,
      빌드힌트: document.querySelector("script[src*='_next/static']") ? "next" : "?",
      화면: `${innerWidth}×${innerHeight}`, dpr: devicePixelRatio,
      코어: navigator.hardwareConcurrency ?? null,
      메모리GB: navigator.deviceMemory ?? null,
      그리드DOM노드: grid.querySelectorAll("*").length,
      브라우저: (navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/) || ["?"])[0],
    },
    기준선_가만히: stat(base),
    확대축소_40회: stat(zoom),
    스크롤_50프레임: stat(scroll),
  };

  console.table({ 기준선: out.기준선_가만히, 확대축소: out.확대축소_40회, 스크롤: out.스크롤_50프레임 });
  $("%c아래 JSON을 통째로 복사해서 전달하세요 ↓", "color:#1B9E7E;font-weight:bold");
  $(JSON.stringify(out, null, 1));
  return out;
})();
