/**
 * 그 언어의 표제어가 **사건**을 가리키는가 — 칩 라벨(i18n.ts)과 중요도 순위(tools/derive.mjs)가 같이 쓴다.
 * QID는 인물·왕조·지명·나라일 때가 많아(이시진, 청나라, 유엔) 그 이름만 칩에 쓰면 무슨 일인지 사라지고,
 * 그 언어판 수로 순위를 매기면 나라·인물이 세기 대표가 된다. 사건 이름 꼴(…전쟁·조약·사건·혁명·즉위…)만 사건.
 * 의존성 0. TS(i18n.ts)와 도구(.mjs)가 모두 읽도록 .mjs.
 */

export const EVENT_NAME = {
  ko: /(전쟁|전투|대첩|사건|조약|협정|협약|조규|장정|혁명|운동|반란|봉기|난|군란|민란|내란|동란|병란|사변|양요|왜란|호란|옥사|사화|환국|반정|정난|의거|항쟁|정변|쿠데타|개혁|유신|선언|조인|건국|멸망|즉위|퇴위|설립|창설|창건|창립|개통|준공|천도|회담|회의|칙령|헌법|독립|해방|점령|침공|침략|정벌|원정|학살|폭동|시위|파업|선거|취임|암살|탄생|개교|창간|출간|발명|발견|탐험|상륙|항해|동맹|연합|분할|통일|합병|병합|폐지|제정|반포|공포|시행|편찬|간행|완성|건립|축조|화재|지진|홍수|기근|역병|참사|사고|폭발|붕괴|공습|폭격|포격|해전|공방전|포위|함락|항복|휴전|종전|개전|법령|법|령|정책|계획|박람회|올림픽|대회|재판|판결|처형|유배|망명|귀국|파견|사절|통신사|수신사|개항|개국|쇄국|금지령|해금|폐번|치현|과거|칙서)$/,
  en: /\b(War|Wars|Battle|Battles|Treaty|Revolution|Rebellion|Incident|Uprising|Act|Massacre|Siege|Conference|Convention|Expedition|Crisis|Coup|Strike|Riot|Riots|Famine|Earthquake|Fire|Flood|Epidemic|Plague|Election|Purge|Reform|Reforms|Restoration|Campaign|Invasion|Invasions|Conquest|Raid|Mutiny|Revolt|Insurrection|Declaration|Agreement|Accord|Pact|Armistice|Ceasefire|Independence|Unification|Partition|Annexation|Occupation|Exhibition|Exposition|Olympics|Games|Trial|Scandal|Affair|Disaster|Accident|Explosion|Bombing|Attack|Assassination|Founding|Establishment|Opening|Completion|Protocol|Compromise|Purchase|Proclamation|Amendment|Constitution|Charter|Edict|Ordinance|Reformation|Renaissance|Crusade|Plot|Conspiracy|Movement|Protest|Protests|March|Boycott|Embargo|Blockade|Landing|Voyage|Flight|Launch|Expedition)\b/i,
  ja: /(戦争|の戦い|合戦|の役|条約|事件|の乱|の変|革命|一揆|改革|維新|条例|会議|宣言|独立|統一|併合|占領|侵攻|遠征|大火|地震|飢饉|流行|選挙|反乱|蜂起|暴動|クーデター|開戦|終戦|休戦|講和|博覧会|オリンピック|裁判|事変|征伐|遷都|開港|鎖国|開国|建国|即位|退位|崩御|創立|設立|開通|完成|制定|発布|施行|廃止|廃藩置県|大政奉還|新政|令|法|憲法|海戦|攻防戦|包囲|陥落|降伏|上陸|来航|渡来|伝来|開山|落成|竣工|創業|開業|開校|創刊|発見|発明)$/,
  zh: /(战争|戰爭|战役|戰役|之战|之戰|条约|條約|事件|之乱|之亂|起义|起義|革命|变法|變法|改革|维新|維新|新政|运动|運動|会议|會議|宣言|独立|獨立|统一|統一|占领|佔領|入侵|远征|遠征|大火|地震|饥荒|饑荒|瘟疫|选举|選舉|叛乱|叛亂|兵变|兵變|政变|政變|之役|之盟|会盟|會盟|会战|會戰|建国|建國|即位|退位|迁都|遷都|开港|開港|通商|博览会|博覽會|奥运会|奧運會|之变|之變|之难|之難|之祸|之禍|之狱|之獄|之盛|之治|之乱|海战|海戰|围城|圍城|陷落|投降|登陆|登陸|开国|開國|定都|称帝|稱帝|禅让|禪讓|颁布|頒布|废除|廢除|成立|建立|创立|創立|开通|開通|落成|竣工|通车|通車|发现|發現|发明|發明)$/,
};

export const isEventName = (name, locale) => (EVENT_NAME[locale] ?? EVENT_NAME.en).test(String(name).replace(/\s*\([^)]*\)$/, ""));

/** 어느 언어판 표제어든 사건 꼴이면 참 — 순위용. */
export const isEventNameAny = (names) => Object.entries(names ?? {}).some(([lang, n]) => n && isEventName(n, lang));
