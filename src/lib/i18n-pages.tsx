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
    tagline: "나라별 비교 연표",
    description: SITE_DESCRIPTION,
    ogLocale: "ko_KR",
  },
  en: {
    tagline: "A side-by-side timeline of nations",
    description: "Put the histories of several countries on one shared year axis. What happened in that country, in that year.",
    ogLocale: "en_US",
  },
  ja: {
    tagline: "国別の比較年表",
    description: "いくつかの国の歴史を同じ年の軸に並べて比べる。その年、その国に何があったのか。",
    ogLocale: "ja_JP",
  },
  zh: {
    tagline: "各国对照年表",
    description: "把几个国家的历史放在同一条年份轴上并列比较。那一年，那个国家发生了什么。",
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
    metaTitle: (y) => `${y}에 무슨 일이 있었나 — 한국·중국·일본·미국 같은 해 비교`,
    h1: (y) => `${y}, 그 해 각 나라에 무슨 일이 있었나`,
    toGrid: (y) => `← 연표에서 ${y} 보기`,
    summaryFallback: (y) => `${y}에 한국·중국·일본·미국에서 있었던 일을 같은 해 축 위에 나란히 놓는다.`,
    note: (total, link, ctx) => (
      <>사건 {total}건. 본문은 원천 연표 원문 그대로이며 출처는 {link}에 있다. 아래위 회색 줄은 앞뒤 {ctx}년 문맥이다.</>
    ),
    coverageFrom: (y) => `${y}년~ 수록`,
    noEvents: "이 해 수록 사건 없음",
  },
  en: {
    metaTitle: (y) => `What happened in ${y} — Korea, China, Japan and the United States side by side`,
    h1: (y) => `${y}: what happened in each country that year`,
    toGrid: (y) => `← See ${y} on the timeline`,
    summaryFallback: (y) => `What happened in Korea, China, Japan and the United States in ${y}, on one shared year axis.`,
    note: (total, link, ctx) => (
      <>{total} events. The text is the source chronology verbatim; the terms are in {link}. The grey lines above and below are the surrounding {ctx} years.</>
    ),
    coverageFrom: (y) => `covered from ${y}`,
    noEvents: "No events recorded for this year",
  },
  ja: {
    metaTitle: (y) => `${y}に何があったか — 韓国・中国・日本・アメリカを同じ年で比べる`,
    h1: (y) => `${y}、その年に各国で何があったか`,
    toGrid: (y) => `← 年表で${y}を見る`,
    summaryFallback: (y) => `${y}に韓国・中国・日本・アメリカであった出来事を同じ年の軸に並べる。`,
    note: (total, link, ctx) => (
      <>出来事{total}件。本文は原典の年表の原文のままで、出典は{link}にある。上下の灰色の行は前後{ctx}年の文脈だ。</>
    ),
    coverageFrom: (y) => `${y}年〜収録`,
    noEvents: "この年の収録なし",
  },
  zh: {
    metaTitle: (y) => `${y}发生了什么 — 韩国·中国·日本·美国同年对照`,
    h1: (y) => `${y}，那一年各国发生了什么`,
    toGrid: (y) => `← 在年表中查看${y}`,
    summaryFallback: (y) => `把${y}韩国·中国·日本·美国发生的事放在同一条年份轴上并列。`,
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
  foot: ReactNode;
}

/** 원천 문서 제목은 각 언어판의 표기 그대로 — 옮기지 않는다(§3 고유명사). */
const WIKI_TITLE = {
  kr: <>「한국사 연표」</>,
  krEn: <>&ldquo;Timeline of Korean history&rdquo;</>,
  cn: <>&ldquo;Timeline of Chinese history&rdquo;</>,
  jp: <>&ldquo;Timeline of Japanese history&rdquo;</>,
  usPre: <>&ldquo;Timeline of pre&ndash;United States history&rdquo;</>,
  us: <>&ldquo;Timeline of United States history&rdquo;</>,
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
      <>이 연표의 사건 본문은 우리가 쓴 문장이 아니다. 아래 원천의 연표 한 줄을 <b>그대로</b> 싣고, 사건마다 어디서 왔는지와 어떤 조건으로 쓸 수 있는지를 적는다. 상세 패널의 &ldquo;출처&rdquo; 줄이 그 사건의 것이다. 수록 범위는 기원전 500년부터 <b>2025년까지</b>다 &mdash; 올해는 비운다. 올해의 연표는 아직 움직이는 문서라서다.</>
    ),
    wiki: {
      h: "위키백과 연표 — 네 열 모두",
      items: [
        <>한국: 한국어판 {WIKI_TITLE.kr}, 영어판 {WIKI_TITLE.krEn}</>,
        <>중국: 영어판 {WIKI_TITLE.cn}</>,
        <>일본: 영어판 {WIKI_TITLE.jp}</>,
        <>미국: 영어판 {WIKI_TITLE.usPre} 및 시기별 {WIKI_TITLE.us}</>,
      ],
      body: (
        <>본문 텍스트는 <A href={CC_DEED.ko}>CC BY-SA 4.0</A>이다. 각 사건의 상세 패널에서 원문 문서와 수집 시점의 판(revid)으로 이어진다. 동일 조건 변경 허락 조항에 따라 <b>이 사이트의 사건 본문도 CC BY-SA 4.0으로 다시 쓸 수 있다.</b> 영어 원문은 아직 옮기지 않았다 &mdash; 옮김이 붙으면 그것도 같은 조건이다.</>
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
        <>사건을 각 나라가 부르는 이름은 <A href={WIKIDATA}>Wikidata</A>(CC0)의 사이트링크 표제어를 그대로 쓴다. 상세 패널에 보이는 &ldquo;중요도&rdquo;는 그 항목이 실린 위키백과 언어판 수를 열 안에서 순위 매긴 것으로, 표시 밀도를 정하는 장치이지 역사적 평가가 아니다.</>
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
      <>The event text on this timeline is not our writing. We carry one line from each source chronology <b>verbatim</b>, and record for every event where it came from and on what terms it may be reused. The &ldquo;Sources&rdquo; line in the detail panel is that event&rsquo;s own. Coverage runs from 500 BC <b>through 2025</b> &mdash; the current year is left out, because this year&rsquo;s chronology is still a moving document.</>
    ),
    wiki: {
      h: "Wikipedia chronologies — all four columns",
      items: [
        <>Korea: Korean Wikipedia {WIKI_TITLE.kr}, English {WIKI_TITLE.krEn}</>,
        <>China: English {WIKI_TITLE.cn}</>,
        <>Japan: English {WIKI_TITLE.jp}</>,
        <>United States: English {WIKI_TITLE.usPre} and the period articles {WIKI_TITLE.us}</>,
      ],
      body: (
        <>The body text is <A href={CC_DEED.en}>CC BY-SA 4.0</A>. Each event&rsquo;s detail panel links to the source article and to the revision (revid) as collected. Under the share-alike clause, <b>the event text on this site may in turn be reused under CC BY-SA 4.0.</b> The English originals are not translated yet &mdash; once a translation is attached, it carries the same terms.</>
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
        <>The name each country uses for an event comes verbatim from the sitelink titles of <A href={WIKIDATA}>Wikidata</A> (CC0). The &ldquo;importance&rdquo; shown in the detail panel ranks, within a column, how many Wikipedia language editions carry that entry; it is a device for deciding display density, not a historical judgement.</>
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
      <>この年表の出来事の本文は私たちが書いた文章ではない。下記の原典の年表の一行を<b>そのまま</b>載せ、出来事ごとにどこから来たのか、どの条件で使えるのかを記す。詳細パネルの「出典」の行がその出来事のものだ。収録範囲は紀元前500年から<b>2025年まで</b> &mdash; 今年は空けている。今年の年表はまだ動いている文書だからだ。</>
    ),
    wiki: {
      h: "Wikipedia年表 — 四つの列すべて",
      items: [
        <>韓国: 韓国語版 {WIKI_TITLE.kr}、英語版 {WIKI_TITLE.krEn}</>,
        <>中国: 英語版 {WIKI_TITLE.cn}</>,
        <>日本: 英語版 {WIKI_TITLE.jp}</>,
        <>アメリカ: 英語版 {WIKI_TITLE.usPre} および時期別の {WIKI_TITLE.us}</>,
      ],
      body: (
        <>本文テキストは <A href={CC_DEED.ja}>CC BY-SA 4.0</A> である。各出来事の詳細パネルから原文の記事と収集時点の版（revid）へつながる。継承条項により、<b>このサイトの出来事の本文も CC BY-SA 4.0 で再利用できる。</b>英語の原文はまだ訳していない &mdash; 訳が付けば、それも同じ条件だ。</>
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
        <>出来事を各国が何と呼ぶかは <A href={WIKIDATA}>Wikidata</A>（CC0）のサイトリンクの見出し語をそのまま使う。詳細パネルの「重要度」は、その項目を載せている Wikipedia の言語版の数を列の中で順位付けしたもので、表示密度を決める仕掛けであって歴史的評価ではない。</>
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
      <>本年表中事件的正文并非我们撰写的文字。我们把下列原始年表中的一行<b>照录</b>，并为每一条事件标明它来自哪里、可在什么条件下使用。详情面板中的“来源”一行即属于该事件。收录范围为公元前500年至<b>2025年</b> &mdash; 今年留空，因为今年的年表仍是不断变动的文档。</>
    ),
    wiki: {
      h: "维基百科年表 — 四列均适用",
      items: [
        <>韩国：韩语版 {WIKI_TITLE.kr}、英语版 {WIKI_TITLE.krEn}</>,
        <>中国：英语版 {WIKI_TITLE.cn}</>,
        <>日本：英语版 {WIKI_TITLE.jp}</>,
        <>美国：英语版 {WIKI_TITLE.usPre} 及分期的 {WIKI_TITLE.us}</>,
      ],
      body: (
        <>正文文本采用 <A href={CC_DEED.zh}>CC BY-SA 4.0</A>。可从每条事件的详情面板通往原文条目及采集时的版本（revid）。依据相同方式共享条款，<b>本站的事件正文同样可以按 CC BY-SA 4.0 再利用。</b>英文原文尚未翻译 &mdash; 译文附上后，同样适用该条款。</>
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
        <>各国对同一事件的称呼，直接取自 <A href={WIKIDATA}>Wikidata</A>（CC0）的站点链接标题。详情面板中显示的“重要度”，是按收录该条目的维基百科语言版本数在列内排名而得，它是决定显示密度的装置，并非历史评价。</>
      ),
    },
    foot: (
      <>如发现错误，请告知我们。由于正文照录原文，我们能改的是<em>把哪一行放在哪一年的哪一列</em>，以及与国史编纂委员会条目的对应关系。</>
    ),
  },
};
