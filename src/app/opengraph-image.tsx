import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

/**
 * 공유·북마크될 때 제품의 얼굴. 지금까지는 없었다 — 링크를 붙이면 미리보기가 빈 채로 나갔다.
 *
 * 그림은 **실제 밀도**다. `regions.json`의 `density`(축을 26칸으로 나눈 사건 수,
 * tools/publish.mjs가 낸다)를 그대로 그린다. 처음에는 기둥 시작점을 눈대중으로 찍었는데,
 * 이 프로젝트에서 그건 작은 거짓말이다 — "모르는 것을 아는 척하지 않는다"는 그림에도 적용된다.
 *
 * **열마다 그 열의 최댓값으로 정규화한다.** 그림이 말할 것은 "어느 열이 큰가"가 아니라
 * "이 열의 무게가 어디 있는가"이기 때문이다. 크기는 라벨 밑의 건수가 말한다 — 둘 다 보인다.
 * 그래서 읽히는 것: AI는 고대부터 흐린 점이 이어지다 맨 아래에서 검게 차고, 미국은 80% 지점까지
 * 새하얗다(1607년 수록 시작). 위가 기원전, 아래가 지금 — 앱의 스크롤과 같은 방향이다.
 *
 * **satori 함정**: 자식이 둘 이상인 `<div>`에는 `display: flex`가 있어야 한다. JSX에서
 * `{`값 ${식} 단위`}`가 아니라 `값 {식} 단위`로 쓰면 **자식이 셋**으로 세어져 빌드가 깨진다
 * (`Error: Expected <div> to have explicit "display: flex"`). 개발 서버에서는 이유 없이
 * `failed to pipe response`로만 보이므로, satori를 의심할 때는 `npm run build`로 봐야 한다.
 *
 * 색은 `globals.css` 라이트 팔레트의 사본이다(satori는 CSS 변수를 읽지 못한다). 폰트는
 * node_modules의 Pretendard TTF(OFL)를 빌드 때 읽는다 — satori 기본 폰트에 한글 글리프가 없다.
 */
export const alt = "AI & Human History — AI의 역사를 인류사와 같은 축에";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
const FONT = (w: "Bold" | "Regular") => path.join(process.cwd(), "node_modules/pretendard/dist/public/static/alternative", `Pretendard-${w}.ttf`);
export default async function Image() {
  const [bold, regular, raw] = await Promise.all([readFile(FONT("Bold")), readFile(FONT("Regular")),
    readFile(path.join(process.cwd(), "public/data/v1/regions.json"), "utf8")]);
  const regions = (JSON.parse(raw).regions as Array<{ id: string; count?: number; density?: number[] }>)
    .filter((r) => r.density?.length);
  const total = regions.reduce((a, r) => a + (r.count ?? 0), 0);
  const C: Record<string, string> = { ai: "#a1490b", kr: "#0047a0", cn: "#c8102e", jp: "#6d28d9", us: "#1f6e43" };
  const L: Record<string, string> = { ai: "AI", kr: "한국", cn: "중국", jp: "일본", us: "미국" };
  const comma = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4f2ee", fontFamily: "Pretendard", padding: 64 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: "#191713" }}>{SITE_NAME}</div>
        <div style={{ fontSize: 30, color: "#56524b", marginTop: 20 }}>AI의 역사를 인류사와 같은 축에</div>
        <div style={{ fontSize: 22, color: "#7a746c", marginTop: 32 }}>{`기원전 500년 – 2026년 · ${comma(total)}건`}</div>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {regions.map((r) => (
          <div key={r.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 78, height: 502 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: C[r.id] ?? "#000" }}>{L[r.id] ?? r.id}</div>
            <div style={{ fontSize: 15, color: "#7a746c", marginTop: 3, marginBottom: 10 }}>{comma(r.count ?? 0)}</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", background: "#fff" }}>
            {(r.density ?? []).map((n, i) => (
              <div key={i} style={{ display: "flex", flex: 1, background: C[r.id] ?? "#000",
                opacity: n === 0 ? 0 : 0.14 + 0.86 * Math.sqrt(n / Math.max(...(r.density ?? [1]), 1)) }} />
            ))}
            </div>
          </div>
        ))}
      </div>
    </div>,
    { ...size, fonts: [{ name: "Pretendard", data: bold, weight: 700, style: "normal" }, { name: "Pretendard", data: regular, weight: 400, style: "normal" }] },
  );
}
