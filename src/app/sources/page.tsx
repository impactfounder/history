import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "출처와 라이선스 — history",
  description: "이 연표의 본문은 원천의 원문을 그대로 싣고 사건마다 출처와 라이선스를 표기한다.",
};

/**
 * 출처 페이지 — editorial-policy §1-6·§1-7, PRD §7(A-15·A-16).
 * 본문은 우리가 쓴 문장이 아니라 원천의 원문이다. 그래서 라이선스 고지가 제품의 일부다.
 * 위키백과는 CC BY-SA 4.0(동일 조건 — 이 사이트의 사건 본문도 같은 조건으로 나간다),
 * 국사편찬위원회 연표는 공공누리 제1유형(이용허락범위 제한 없음).
 */
export default function SourcesPage() {
  return (
    <main className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl px-6 py-10 text-[14px] leading-relaxed [text-wrap:pretty] [word-break:keep-all]">
        <p className="mb-6 text-[12px]">
          <Link href="/" className="text-neutral-500 underline">← 연표로</Link>
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight [text-wrap:balance]">출처와 라이선스</h1>
        <p className="mb-8 text-neutral-600">
          이 연표의 사건 본문은 우리가 쓴 문장이 아니다. 아래 원천의 연표 한 줄을 <b>그대로</b> 싣고, 사건마다 어디서 왔는지와 어떤 조건으로 쓸 수 있는지를 적는다. 상세 패널의 “출처” 줄이 그 사건의 것이다. 수록 범위는 기원전 500년부터 <b>2025년까지</b>다 — 올해는 비운다. 올해의 연표는 아직 움직이는 문서라서다.
        </p>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">위키백과 연표 — 네 열 모두</h2>
          <ul className="mb-3 list-disc pl-5 text-neutral-700">
            <li>한국: 한국어판 「한국사 연표」, 영어판 “Timeline of Korean history”</li>
            <li>중국: 영어판 “Timeline of Chinese history”</li>
            <li>일본: 영어판 “Timeline of Japanese history”</li>
            <li>미국: 영어판 “Timeline of pre–United States history” 및 시기별 “Timeline of United States history”</li>
          </ul>
          <p className="text-neutral-700">
            본문 텍스트는{" "}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ko" target="_blank" rel="noreferrer" className="underline">CC BY-SA 4.0</a>
            이다. 각 사건의 상세 패널에서 원문 문서와 수집 시점의 판(revid)으로 이어진다. 동일 조건 변경 허락 조항에 따라 <b>이 사이트의 사건 본문도 CC BY-SA 4.0으로 다시 쓸 수 있다.</b> 영어 원문은 아직 옮기지 않았다 — 옮김이 붙으면 그것도 같은 조건이다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">국사편찬위원회 연표 — 한국 열</h2>
          <p className="mb-3 text-neutral-700">
            한국 열에서 위키백과 항목과 연도·내용이 맞는 사건은 국사편찬위원회 한국사데이터베이스의 연표 항목을 함께 싣는다(◆ 표시). 그 항목이 공식 출처이자 정확한 날짜(음력 표기 포함)이며, 각 사건에서 “이 해의 공식 연표 더 보기”로 같은 해의 나머지 항목을 볼 수 있다.
          </p>
          <ul className="mb-3 list-disc pl-5 text-neutral-700">
            <li>데이터셋: 교육부 국사편찬위원회 「한국역사자료 메타데이터 정보_연표」, 공공데이터포털{" "}
              <a href="https://www.data.go.kr/data/15051036/fileData.do" target="_blank" rel="noreferrer" className="underline">15051036</a>
              (2022-10 갱신본, 215,536건)</li>
            <li>이용 조건: 공공누리 · <b>이용허락범위 제한 없음</b></li>
            <li>범위: 고대사(기원전 2333~937) · 근대사(1860~1945) · 대한민국사(1945~2008) · 주제별 연표. <b>고려·조선(938~1859)은 이 연표에 없어</b> 그 구간의 한국 열은 위키백과만이다.</li>
          </ul>
          <p className="text-neutral-700">
            중국·일본·미국은 공개 조건이 열린 공식 연표를 찾지 못했다(2026-09 조사). 권위 있는 자료라도 이용 조건이 닫혀 있으면 본문에 싣지 않고 대조와 링크로만 쓴다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">관점별 명칭 · 중요도</h2>
          <p className="mb-2 text-neutral-700">
            사건을 각 나라가 부르는 이름은 <a href="https://www.wikidata.org" target="_blank" rel="noreferrer" className="underline">Wikidata</a>(CC0)의 사이트링크 표제어를 그대로 쓴다. 상세 패널에 보이는 “중요도”는 그 항목이 실린 위키백과 언어판 수를 열 안에서 순위 매긴 것으로, 표시 밀도를 정하는 장치이지 역사적 평가가 아니다.
          </p>
        </section>

        <section className="text-[12px] text-neutral-500">
          <p>오류를 발견하면 알려 달라. 원문을 그대로 싣기 때문에 우리가 고치는 것은 <em>어느 줄을 어느 해에 어느 열로</em> 놓았는가와 국사편찬위 항목과의 대응이다.</p>
        </section>
      </article>
    </main>
  );
}
