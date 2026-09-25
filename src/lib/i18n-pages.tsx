/**
 * 문서 페이지(`/y/{year}`·`/sources`)의 언어별 문구 — 그리드 UI 문구(src/lib/i18n.ts T)와 나눠 둔다.
 * 이유는 둘이다. ① 이 문구는 서버 렌더 페이지에서만 쓰므로 그리드 클라이언트 번들에 실릴 이유가 없다.
 * ② 여기 본문은 링크·강조가 섞인 문단이라 문자열이 아니라 ReactNode다.
 *
 * 색인 대상 페이지라 언어가 URL에 있어야 한다(PRD §5-8·§8 i18n). 한국어는 접두 없이 `/y/1592`,
 * 나머지는 `/en/y/1592`처럼 앞에 로케일 세그먼트가 붙는다 — localePath()가 그 규칙 하나다.
 *
 * 번역 원칙: 여기 문장은 우리가 쓴 문장이므로 옮긴다. **사건 본문·원천 표제어·데이터셋 이름은 옮기지 않는다**
 * (editorial-policy §1-6). 「한국사 연표」·"Timeline of Korean history" 같은 문서 제목은 원문 그대로 둔다.
 */

import type { ReactNode } from "react";
import { SITE_DESCRIPTION } from "@/lib/site";
// localePath는 그리드(클라이언트)도 쓰므로 i18n.ts에 있다 — 이 파일은 서버 전용 문구라 거기 실리면 안 된다
import { localePath, type Locale } from "@/lib/i18n";

/**
 * 그 경로의 언어별 대체 URL — `<link rel="alternate" hreflang>`로 나간다(metadata alternates.languages).
 * hreflang 코드는 Locale과 같은 두 글자를 쓰고, x-default는 기본 언어(한국어)로 보낸다.
 */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ko: localePath("ko", path),
    en: localePath("en", path),
    ja: localePath("ja", path),
    zh: localePath("zh", path),
    "x-default": localePath("ko", path),
  };
}

// ── 사이트 머리말 ────────────────────────────────────────────────────────────
export const SITE_COPY: Record<Locale, { tagline: string; description: string; ogLocale: string }> = {
  ko: {
    tagline: "AI의 역사를 인류사와 같은 축에",
    description: SITE_DESCRIPTION,
    ogLocale: "ko_KR",
  },
  en: {
    tagline: "AI history beside human history",
    description: "Put the history of AI beside the histories of Korea, China, Japan and the United States on one shared year axis. What happened in that column, in that year.",
    ogLocale: "en_US",
  },
  ja: {
    tagline: "AIの歴史を人類史と同じ軸に",
    description: "AIの歴史と韓国・中国・日本・アメリカの歴史を同じ年の軸に並べる。その年、その列に何があったのか。",
    ogLocale: "ja_JP",
  },
  zh: {
    tagline: "把人工智能史与人类史放在同一条轴上",
    description: "把人工智能史与韩国、中国、日本、美国的历史放在同一条年份轴上。那一年，那一列发生了什么。",
    ogLocale: "zh_CN",
  },
};

// ── 연도 페이지 ──────────────────────────────────────────────────────────────
export interface YearCopy {
  /** 검색어가 질문형("1882년에 무슨 일이 있었나")으로 들어온다 — 제목도 그 말로. */
  metaTitle: (year: string) => string;
  h1: (year: string) => string;
  toGrid: (year: string) => string;
  /** 그 해 사건이 하나도 없을 때의 요약 한 줄. */
  summaryFallback: (year: string) => string;
  /** "사건 N건. 본문은 원문 그대로이며 출처는 [링크]에 있다. 아래위 회색 줄은 앞뒤 N년 문맥이다." */
  note: (total: number, sourcesLink: ReactNode, context: number) => ReactNode;
  coverageFrom: (year: number) => string;
  noEvents: string;
}

export const YEAR: Record<Locale, YearCopy> = {
  ko: {
    metaTitle: (y) => `${y}에 무슨 일이 있었나 — AI·한국·중국·일본·미국 같은 해 비교`,
    h1: (y) => `${y}, 그 해 각 나라에 무슨 일이 있었나`,
    toGrid: (y) => `← 연표에서 ${y} 보기`,
    summaryFallback: (y) => `${y}에 AI·한국·중국·일본·미국에서 있었던 일을 같은 해 축 위에 나란히 놓는다.`,
    note: (total, link, ctx) => (
      <>사건 {total}건. 본문은 원천 연표 원문 그대로이며 출처는 {link}에 있다. 아래위 회색 줄은 앞뒤 {ctx}년 문맥이다.</>
    ),
    coverageFrom: (y) => `${y}년~ 수록`,
    noEvents: "이 해 수록 사건 없음",
  },
  en: {
    metaTitle: (y) => `What happened in ${y} — AI, Korea, China, Japan and the United States side by side`,
    h1: (y) => `${y}: what happened in each country that year`,
    toGrid: (y) => `← See ${y} on the timeline`,
    summaryFallback: (y) => `What happened in AI, Korea, China, Japan and the United States in ${y}, on one shared year axis.`,
    note: (total, link, ctx) => (
      <>{total} events. The text is the source chronology verbatim; the terms are in {link}. The grey lines above and below are the surrounding {ctx} years.</>
    ),
    coverageFrom: (y) => `covered from ${y}`,
    noEvents: "No events recorded for this year",
  },
  ja: {
    metaTitle: (y) => `${y}に何があったか — AI・韓国・中国・日本・アメリカを同じ年で比べる`,
    h1: (y) => `${y}、その年に各国で何があったか`,
    toGrid: (y) => `← 年表で${y}を見る`,
    summaryFallback: (y) => `${y}にAI・韓国・中国・日本・アメリカであった出来事を同じ年の軸に並べる。`,
    note: (total, link, ctx) => (
      <>出来事{total}件。本文は原典の年表の原文のままで、出典は{link}にある。上下の灰色の行は前後{ctx}年の文脈だ。</>
    ),
    coverageFrom: (y) => `${y}年〜収録`,
    noEvents: "この年の収録なし",
  },
  zh: {
    metaTitle: (y) => `${y}发生了什么 — 人工智能·韩国·中国·日本·美国同年对照`,
    h1: (y) => `${y}，那一年各国发生了什么`,
    toGrid: (y) => `← 在年表中查看${y}`,
    summaryFallback: (y) => `把${y}人工智能·韩国·中国·日本·美国发生的事放在同一条年份轴上并列。`,
    note: (total, link, ctx) => (
      <>事件{total}条。正文照录原始年表原文，来源见{link}。上下灰色行是前后{ctx}年的脉络。</>
    ),
    coverageFrom: (y) => `${y}年起收录`,
    noEvents: "本年无收录事件",
  },
};

// ── 출처 페이지 ──────────────────────────────────────────────────────────────
export interface SourcesCopy {
  back: string;
  title: string;
  /** 검색 결과 스니펫 — 본문 첫 문단을 줄인 한 문장. */
  metaDescription: string;
  intro: ReactNode;
  wiki: { h: string; items: ReactNode[]; body: ReactNode };
  nikh: { h: string; lead: ReactNode; items: ReactNode[]; body: ReactNode };
  names: { h: string; body: ReactNode };
  /** 원문이 아닌 것 — 기계 번역과 지은 제목(tools/translate.mjs · tools/name.mjs). 한국어 화면에만 있다. */
  derived: { h: string; body: ReactNode };
  foot: ReactNode;
}

/** 원천 문서 제목은 각 언어판의 표기 그대로 — 옮기지 않는다(§3 고유명사). */
const WIKI_TITLE = {
  ai: <>&ldquo;Timeline of artificial intelligence&rdquo;</>,
  kr: <>「한국사 연표」</>,
  krEn: <>&ldquo;Timeline of Korean history&rdquo;</>,
  krKwangmu: <>&ldquo;Timeline of the Kwangmu Reform&rdquo;</>,
  cnZh: <>「中国历史年表」</>,
  cnPrc: <>「中华人民共和国历史年表」</>,
  cn: <>&ldquo;Timeline of Chinese history&rdquo;</>,
  cnDyn: <>&ldquo;Timeline of the &hellip; dynasty&rdquo; (Han · Tang · Song · Ming · Qing)</>,
  jpJa: <>「日本史の出来事一覧」</>,
  jp: <>&ldquo;Timeline of Japanese history&rdquo;</>,
  usPre: <>&ldquo;Timeline of pre&ndash;United States history&rdquo;</>,
  usRev: <>&ldquo;Timeline of the American Revolution&rdquo;</>,
  us: <>&ldquo;Timeline of the history of the United States&rdquo;</>,
};

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline">{children}</a>
);

const CC_DEED: Record<Locale, string> = {
  ko: "https://creativecommons.org/licenses/by-sa/4.0/deed.ko",
  en: "https://creativecommons.org/licenses/by-sa/4.0/",
  ja: "https://creativecommons.org/licenses/by-sa/4.0/deed.ja",
  zh: "https://creativecommons.org/licenses/by-sa/4.0/deed.zh",
};
const DATA_GO_KR = "https://www.data.go.kr/data/15051036/fileData.do";
const WIKIDATA = "https://www.wikidata.org";
/** 데이터셋 이름은 공공데이터포털 등록 표기 그대로 — 어느 언어에서도 옮기지 않는다. */
const NIKH_DATASET = "「한국역사자료 메타데이터 정보_연표」";

export const SOURCES: Record<Locale, SourcesCopy> = {
  ko: {
    back: "← 연표로",
    title: "출처와 라이선스",
    metaDescription: "이 연표의 본문은 원천의 원문을 그대로 싣고 사건마다 출처와 라이선스를 표기한다.",
    intro: (
      <>이 연표의 사건 본문은 우리가 쓴 문장이 아니다. 아래 원천의 연표 한 줄을 <b>그대로</b> 싣고, 사건마다 어디서 왔는지와 어떤 조건으로 쓸 수 있는지를 적는다. 상세 패널의 &ldquo;출처&rdquo; 줄이 그 사건의 것이다. 수록 범위는 기원전 500년부터 <b>2025년까지</b>다 &mdash; 올해는 비운다. 올해의 연표는 아직 움직이는 문서라서다. 다만 <b>AI 열만 2026년까지</b> 싣는다. 그 열은 지금 일어나는 중이라 전년도에서 끊으면 가장 중요한 구간이 빠지기 때문이다 &mdash; 대신 그 해의 AI 항목은 <b>아직 불완전하고 나중에 바뀐다.</b></>
    ),
    wiki: {
      h: "위키백과 연표 — 다섯 열 모두",
      items: [
        <>AI: 영어판 {WIKI_TITLE.ai}. 이 열만 자국어판이 없어 <b>전부 영어 원문</b>이다.</>,
        <>한국: 한국어판 {WIKI_TITLE.kr}, 영어판 {WIKI_TITLE.krEn} · {WIKI_TITLE.krKwangmu}</>,
        <>중국: 중국어판 {WIKI_TITLE.cnZh} · {WIKI_TITLE.cnPrc}, 영어판 {WIKI_TITLE.cn} 및 왕조별 {WIKI_TITLE.cnDyn}</>,
        <>일본: 일본어판 {WIKI_TITLE.jpJa}, 영어판 {WIKI_TITLE.jp}</>,
        <>미국: 영어판 {WIKI_TITLE.usPre} · {WIKI_TITLE.usRev} 및 시기별 {WIKI_TITLE.us}</>,
      ],
      body: (
        <>본문 텍스트는 <A href={CC_DEED.ko}>CC BY-SA 4.0</A>이다. 각 사건의 상세 패널에서 원문 문서와 수집 시점의 판(revid)으로 이어진다. 동일 조건 변경 허락 조항에 따라 <b>이 사이트의 사건 본문도 CC BY-SA 4.0으로 다시 쓸 수 있다.</b> 한국어 옮김과 칩 제목도 같은 조건이다 &mdash; 아래 &ldquo;기계가 만든 것&rdquo;&#8288;에&nbsp;적는다.</>
      ),
    },
    nikh: {
      h: "국사편찬위원회 연표 — 한국 열",
      lead: (
        <>한국 열에서 위키백과 항목과 연도·내용이 맞는 사건은 국사편찬위원회 한국사데이터베이스의 연표 항목을 함께 싣는다(◆ 표시). 그 항목이 공식 출처이자 정확한 날짜(음력 표기 포함)이며, 각 사건에서 &ldquo;이 해의 공식 연표 더 보기&rdquo;로 같은 해의 나머지 항목을 볼 수 있다.</>
      ),
      items: [
        <>데이터셋: 교육부 국사편찬위원회 {NIKH_DATASET}, 공공데이터포털 <A href={DATA_GO_KR}>15051036</A>(2022-10 갱신본, 215,536건)</>,
        <>이용 조건: 공공누리 · <b>이용허락범위 제한 없음</b></>,
        <>범위: 고대사(기원전 2333~937) · 근대사(1860~1945) · 대한민국사(1945~2008) · 주제별 연표. <b>고려·조선(938~1859)은 이 연표에 없어</b> 그 구간의 한국 열은 위키백과만이다.</>,
      ],
      body: (
        <>중국·일본·미국은 공개 조건이 열린 공식 연표를 찾지 못했다(2026-09 조사). 권위 있는 자료라도 이용 조건이 닫혀 있으면 본문에 싣지 않고 대조와 링크로만 쓴다.</>
      ),
    },
    names: {
      h: "관점별 명칭 · 중요도",
      body: (
        <>사건을 각 나라가 부르는 이름은 <A href={WIKIDATA}>Wikidata</A>(CC0)의 사이트링크 표제어를 그대로 쓴다. 상세 패널에 보이는 &ldquo;중요도&rdquo;는 그 항목이 실린 위키백과 언어판 수를 열 안에서 순위 매긴 것으로, 표시 밀도를 정하는 장치이지 역사적 평가가 아니다. 연표 문서가 비는 구간은 위키데이터의 사건 항목(전투·조약·반란 등)으로 채운다. 상세 패널의 &ldquo;관련 문서&rdquo; 설명은 한국어 위키백과 문서의 첫 문단 그대로다(CC BY-SA 4.0).</>
      ),
    },
    derived: {
      h: "기계가 만든 것 — 한국어 옮김 · 칩 제목",
      body: (
        <>이 둘만은 원문이 아니다. 한국어 화면에서 외국어 원문 줄은 <b>기계 번역</b>으로 보이고, 원문이 긴 문장인 줄은 칩에 기계가 지은 <b>짧은 제목</b>을 붙인다. 상세 패널이 각각 &ldquo;한국어 · 기계 번역&rdquo;, &ldquo;지은 제목&rdquo;으로 표시하고, 원문은 그 아래에 그대로 남는다. 둘 다 원문에서 만든 파생물이라 원문과 같은 조건(CC BY-SA 4.0)이다. 영어·일본어·중국어 화면에는 이 둘이 없다 &mdash; 그 언어의 표제어가 없는 줄은 원문 그대로 보인다.</>
      ),
    },
    foot: (
      <>오류를 발견하면 알려 달라. 원문을 그대로 싣기 때문에 우리가 고치는 것은 <em>어느 줄을 어느 해에 어느 열로</em> 놓았는가와 국사편찬위 항목과의 대응이다.</>
    ),
  },

  en: {
    back: "← Back to the timeline",
    title: "Sources & licenses",
    metaDescription: "This timeline carries the source text verbatim and records the source and license of every event.",
    intro: (
      <>The event text on this timeline is not our writing. We carry one line from each source chronology <b>verbatim</b>, and record for every event where it came from and on what terms it may be reused. The &ldquo;Sources&rdquo; line in the detail panel is that event&rsquo;s own. Coverage runs from 500 BC <b>through 2025</b> &mdash; the current year is left out, because this year&rsquo;s chronology is still a moving document. The <b>AI column alone runs through 2026</b>: that history is happening now, and cutting it at last year would drop its most important stretch. Those entries are <b>incomplete and will change.</b></>
    ),
    wiki: {
      h: "Wikipedia chronologies — all five columns",
      items: [
        <>AI: English {WIKI_TITLE.ai}. This column alone has no native-language edition, so every line is the English original.</>,
        <>Korea: Korean Wikipedia {WIKI_TITLE.kr}; English {WIKI_TITLE.krEn} · {WIKI_TITLE.krKwangmu}</>,
        <>China: Chinese {WIKI_TITLE.cnZh} · {WIKI_TITLE.cnPrc}; English {WIKI_TITLE.cn} and the dynasty timelines {WIKI_TITLE.cnDyn}</>,
        <>Japan: Japanese {WIKI_TITLE.jpJa}; English {WIKI_TITLE.jp}</>,
        <>United States: English {WIKI_TITLE.usPre} · {WIKI_TITLE.usRev} and the period articles {WIKI_TITLE.us}</>,
      ],
      body: (
        <>The body text is <A href={CC_DEED.en}>CC BY-SA 4.0</A>. Each event&rsquo;s detail panel links to the source article and to the revision (revid) as collected. Under the share-alike clause, <b>the event text on this site may in turn be reused under CC BY-SA 4.0.</b> The Korean translations and chip titles carry the same terms &mdash; see &ldquo;What a machine made&rdquo; below.</>
      ),
    },
    nikh: {
      h: "National Institute of Korean History chronology — the Korea column",
      lead: (
        <>Where an entry in the Korea column matches the Korean History Database of the National Institute of Korean History (NIKH) by year and content, we carry that official entry alongside it (marked ◆). That entry is the official source and the precise date (including the lunar-calendar notation); each event offers &ldquo;More official chronology for this year&rdquo; for the remaining entries of the same year.</>
      ),
      items: [
        <>Dataset: NIKH (Ministry of Education), {NIKH_DATASET}, Korea Open Data Portal <A href={DATA_GO_KR}>15051036</A> (2022-10 revision, 215,536 entries)</>,
        <>Terms: KOGL (Korea Open Government License) · <b>no restriction on the scope of use</b></>,
        <>Range: ancient (2333 BC&ndash;937) · modern (1860&ndash;1945) · Republic of Korea (1945&ndash;2008) · thematic chronologies. <b>Goryeo and Joseon (938&ndash;1859) are absent from this dataset</b>, so the Korea column rests on Wikipedia alone for that stretch.</>,
      ],
      body: (
        <>For China, Japan and the United States we found no official chronology with open terms (surveyed 2026-09). However authoritative a source may be, if its terms are closed we do not carry its text &mdash; we use it only for cross-checking and linking.</>
      ),
    },
    names: {
      h: "Names by perspective · importance",
      body: (
        <>The name each country uses for an event comes verbatim from the sitelink titles of <A href={WIKIDATA}>Wikidata</A> (CC0). The &ldquo;importance&rdquo; shown in the detail panel ranks, within a column, how many Wikipedia language editions carry that entry; it is a device for deciding display density, not a historical judgement. Stretches no chronology covers are filled from Wikidata event items (battles, treaties, revolts and the like). The &ldquo;Related article&rdquo; text in the detail panel is the first paragraph of the Korean Wikipedia article, verbatim (CC BY-SA 4.0).</>
      ),
    },
    derived: {
      h: "What a machine made — Korean translations · chip titles",
      body: (
        <>These two alone are not source text. On the Korean interface, lines whose original is in another language appear as a <b>machine translation</b>, and lines whose original is a long sentence get a short <b>machine-written title</b> on the chip. The detail panel marks them &ldquo;Korean · machine translation&rdquo; and &ldquo;generated title&rdquo;, and the original stays beneath, verbatim. Both are derived from the original and carry its terms (CC BY-SA 4.0). The English, Japanese and Chinese interfaces have neither &mdash; where a line has no title in that language, the original is shown as is.</>
      ),
    },
    foot: (
      <>If you find an error, tell us. Because we carry the text verbatim, what we can correct is <em>which line we placed in which year and in which column</em>, and how it is matched to the NIKH entry.</>
    ),
  },

  ja: {
    back: "← 年表へ",
    title: "出典とライセンス",
    metaDescription: "この年表は原典の原文をそのまま載せ、出来事ごとに出典とライセンスを記す。",
    intro: (
      <>この年表の出来事の本文は私たちが書いた文章ではない。下記の原典の年表の一行を<b>そのまま</b>載せ、出来事ごとにどこから来たのか、どの条件で使えるのかを記す。詳細パネルの「出典」の行がその出来事のものだ。収録範囲は紀元前500年から<b>2025年まで</b> &mdash; 今年は空けている。今年の年表はまだ動いている文書だからだ。ただし<b>AIの列だけは2026年まで</b>載せる。この列は今まさに進行中で、前年で切ると最も重要な区間が抜けるからだ &mdash; その代わり、その年の項目は<b>まだ不完全で後から変わる。</b></>
    ),
    wiki: {
      h: "Wikipedia年表 — 五つの列すべて",
      items: [
        <>AI: 英語版 {WIKI_TITLE.ai}。この列だけ自国語版がなく、すべて英語原文である。</>,
        <>韓国: 韓国語版 {WIKI_TITLE.kr}、英語版 {WIKI_TITLE.krEn} · {WIKI_TITLE.krKwangmu}</>,
        <>中国: 中国語版 {WIKI_TITLE.cnZh} · {WIKI_TITLE.cnPrc}、英語版 {WIKI_TITLE.cn} および王朝別の {WIKI_TITLE.cnDyn}</>,
        <>日本: 日本語版 {WIKI_TITLE.jpJa}、英語版 {WIKI_TITLE.jp}</>,
        <>アメリカ: 英語版 {WIKI_TITLE.usPre} · {WIKI_TITLE.usRev} および時期別の {WIKI_TITLE.us}</>,
      ],
      body: (
        <>本文テキストは <A href={CC_DEED.ja}>CC BY-SA 4.0</A> である。各出来事の詳細パネルから原文の記事と収集時点の版（revid）へつながる。継承条項により、<b>このサイトの出来事の本文も CC BY-SA 4.0 で再利用できる。</b>韓国語訳とチップの見出しも同じ条件だ &mdash; 下の「機械が作ったもの」に記す。</>
      ),
    },
    nikh: {
      h: "国史編纂委員会の年表 — 韓国の列",
      lead: (
        <>韓国の列で Wikipedia の項目と年・内容が一致する出来事には、韓国 国史編纂委員会「韓国史データベース」の年表項目を併せて載せる（◆ 印）。その項目が公式の出典であり、正確な日付（旧暦表記を含む）でもある。各出来事の「この年の公式年表をもっと見る」から同じ年の残りの項目を見られる。</>
      ),
      items: [
        <>データセット: 教育部 国史編纂委員会 {NIKH_DATASET}、公共データポータル <A href={DATA_GO_KR}>15051036</A>（2022-10 更新版、215,536件）</>,
        <>利用条件: 公共누리（KOGL）· <b>利用許諾範囲の制限なし</b></>,
        <>範囲: 古代史（紀元前2333〜937）· 近代史（1860〜1945）· 大韓民国史（1945〜2008）· テーマ別年表。<b>高麗・朝鮮（938〜1859）はこの年表になく</b>、その区間の韓国の列は Wikipedia のみである。</>,
      ],
      body: (
        <>中国・日本・アメリカについては、公開条件の開かれた公式年表を見つけられなかった（2026-09 調査）。権威ある資料でも利用条件が閉じていれば本文には載せず、照合とリンクにのみ使う。</>
      ),
    },
    names: {
      h: "視点ごとの名称 · 重要度",
      body: (
        <>出来事を各国が何と呼ぶかは <A href={WIKIDATA}>Wikidata</A>（CC0）のサイトリンクの見出し語をそのまま使う。詳細パネルの「重要度」は、その項目を載せている Wikipedia の言語版の数を列の中で順位付けしたもので、表示密度を決める仕掛けであって歴史的評価ではない。年表記事がない区間は Wikidata の出来事項目（戦闘・条約・反乱など）で補う。詳細パネルの「関連記事」の説明は韓国語版 Wikipedia 記事の冒頭段落そのままである（CC BY-SA 4.0）。</>
      ),
    },
    derived: {
      h: "機械が作ったもの — 韓国語訳 · チップの見出し",
      body: (
        <>この二つだけは原文ではない。韓国語の画面では、外国語が原文の行は<b>機械翻訳</b>で表示され、原文が長い文の行にはチップに機械が付けた<b>短い見出し</b>を使う。詳細パネルがそれぞれ「韓国語 · 機械翻訳」「生成された見出し」と表示し、原文はその下にそのまま残る。どちらも原文から作った派生物で、原文と同じ条件（CC BY-SA 4.0）である。英語・日本語・中国語の画面にはこの二つはない &mdash; その言語の見出し語がない行は原文のまま表示される。</>
      ),
    },
    foot: (
      <>誤りを見つけたら知らせてほしい。原文をそのまま載せているので、私たちが直せるのは<em>どの行をどの年のどの列に</em>置いたか、そして国史編纂委員会の項目との対応である。</>
    ),
  },

  zh: {
    back: "← 返回年表",
    title: "来源与许可",
    metaDescription: "本年表照录原始文本，并为每一条事件标明来源与许可。",
    intro: (
      <>本年表中事件的正文并非我们撰写的文字。我们把下列原始年表中的一行<b>照录</b>，并为每一条事件标明它来自哪里、可在什么条件下使用。详情面板中的“来源”一行即属于该事件。收录范围为公元前500年至<b>2025年</b> &mdash; 今年留空，因为今年的年表仍是不断变动的文档。但<b>人工智能一列收录至2026年</b>：这段历史正在发生，若止于去年则会漏掉最重要的区间 &mdash; 代价是该年的条目<b>尚不完整，日后会变。</b></>
    ),
    wiki: {
      h: "维基百科年表 — 五列均适用",
      items: [
        <>AI：英语版 {WIKI_TITLE.ai}。只有这一列没有本国语言版本，全部为英文原文。</>,
        <>韩国：韩语版 {WIKI_TITLE.kr}、英语版 {WIKI_TITLE.krEn} · {WIKI_TITLE.krKwangmu}</>,
        <>中国：中文版 {WIKI_TITLE.cnZh} · {WIKI_TITLE.cnPrc}，英语版 {WIKI_TITLE.cn} 及各朝代的 {WIKI_TITLE.cnDyn}</>,
        <>日本：日语版 {WIKI_TITLE.jpJa}、英语版 {WIKI_TITLE.jp}</>,
        <>美国：英语版 {WIKI_TITLE.usPre} · {WIKI_TITLE.usRev} 及分期的 {WIKI_TITLE.us}</>,
      ],
      body: (
        <>正文文本采用 <A href={CC_DEED.zh}>CC BY-SA 4.0</A>。可从每条事件的详情面板通往原文条目及采集时的版本（revid）。依据相同方式共享条款，<b>本站的事件正文同样可以按 CC BY-SA 4.0 再利用。</b>韩语译文与标签标题同样适用该条款 &mdash; 见下文“机器生成的内容”。</>
      ),
    },
    nikh: {
      h: "国史编纂委员会年表 — 韩国列",
      lead: (
        <>韩国列中，凡与维基百科条目在年份与内容上相符的事件，一并载入韩国国史编纂委员会“韩国史数据库”的年表条目（标记 ◆）。该条目既是官方来源，也提供准确日期（含农历标注）；在每条事件中可通过“查看本年更多官方年表”查看同年的其余条目。</>
      ),
      items: [
        <>数据集：教育部 国史编纂委员会 {NIKH_DATASET}，公共数据门户 <A href={DATA_GO_KR}>15051036</A>（2022-10 更新版，215,536条）</>,
        <>使用条件：公共누리（KOGL）· <b>使用许可范围无限制</b></>,
        <>范围：古代史（公元前2333〜937）· 近代史（1860〜1945）· 大韩民国史（1945〜2008）· 专题年表。<b>高丽·朝鲜（938〜1859）不在此年表中</b>，该区间的韩国列仅有维基百科。</>,
      ],
      body: (
        <>中国·日本·美国方面，未找到公开条件开放的官方年表（2026-09 调查）。资料再权威，若使用条件封闭，我们也不将其正文载入，只用于比对与链接。</>
      ),
    },
    names: {
      h: "各视角名称 · 重要度",
      body: (
        <>各国对同一事件的称呼，直接取自 <A href={WIKIDATA}>Wikidata</A>（CC0）的站点链接标题。详情面板中显示的“重要度”，是按收录该条目的维基百科语言版本数在列内排名而得，它是决定显示密度的装置，并非历史评价。没有年表条目覆盖的区间，以 Wikidata 的事件条目（战役、条约、叛乱等）补足。详情面板中“相关条目”的说明为韩语维基百科条目首段原文（CC BY-SA 4.0）。</>
      ),
    },
    derived: {
      h: "机器生成的内容 — 韩语译文 · 标签标题",
      body: (
        <>只有这两项不是原文。在韩语界面中，原文为外语的条目显示为<b>机器翻译</b>，原文为长句的条目则在标签上使用由机器拟定的<b>简短标题</b>。详情面板分别标注“韩语 · 机器翻译”“生成的标题”，原文原样保留在其下方。两者都是由原文派生的内容，与原文适用相同条款（CC BY-SA 4.0）。英语、日语、中文界面没有这两项 &mdash; 没有该语言标题的条目按原文显示。</>
      ),
    },
    foot: (
      <>如发现错误，请告知我们。由于正文照录原文，我们能改的是<em>把哪一行放在哪一年的哪一列</em>，以及与国史编纂委员会条目的对应关系。</>
    ),
  },
};
