# 원천 프로브 결과

| 측정일 | 2026-09-05 |
|---|---|
| 도구 | `tools/source-probe.mjs` |
| 대상 | `data-model §4-1` 연표 문서 |

**`후보 행`이 핵심 숫자다** — 첫 셀이 연도로 읽히는 표 행 + 연도로 시작하는 목록 항목.
즉 우리가 사건으로 뽑아낼 수 있는 줄 수다. `링크 보유`는 그중 본문 위키 링크가 있는 비율로,
**QID 부착 가능 비율의 상한**이다.

| 원천 | 열 | 상태 | revid | 표 | 표 행 | 연도 행 | 목록 항목 | **후보 행** | 링크 보유 |
|---|---|---|---|---|---|---|---|---|---|
| ko:한국사 연표 | kr | 존재 | 41862662 | 1 | 92 | 77 | 0 | **77** | 70% |
| en:Timeline of Korean history | kr | 존재 | 1362486759 | 0 | 0 | 0 | 166 | **166** | 99% |
| ko:세계사 연표 | world | 존재 | 42111274 | 8 | 76 | 18 | 0 | **18** | 100% |
| en:Timeline of Chinese history | cn | 존재 | 1371852221 | 43 | 1329 | 858 | 224 | **1082** | 98% |
| en:Timeline of Japanese history | jp | 존재 | 1369537138 | 26 | 545 | 319 | 1259 | **1578** | 35% |
| en:Timeline of pre–United States history | us | 존재 | 1371159053 | 0 | 0 | 0 | 40 | **40** | 100% |
| en:Timeline of the history of the United States (1790–1819) | us | 존재 | 1345327753 | 0 | 0 | 0 | 18 | **18** | 89% |
| en:Timeline of the history of the United States (1820–1859) | us | 존재 | 1372462020 | 0 | 0 | 0 | 18 | **18** | 94% |
| en:Timeline of the history of the United States (1860–1899) | us | 존재 | 1361201206 | 0 | 0 | 0 | 17 | **17** | 94% |
| en:Timeline of the history of the United States (1900–1929) | us | 존재 | 1326856497 | 0 | 0 | 0 | 25 | **25** | 96% |
| en:Timeline of the history of the United States (1930–1949) | us | 존재 | 1358839080 | 0 | 0 | 0 | 20 | **20** | 90% |
| en:Timeline of the history of the United States (1950–1969) | us | 존재 | 1355310191 | 0 | 0 | 0 | 23 | **23** | 96% |
| en:Timeline of the history of the United States (1970–1989) | us | 존재 | 1354777712 | 0 | 0 | 0 | 19 | **19** | 95% |
| en:Timeline of the history of the United States (1990–2009) | us | 존재 | 1370058554 | 0 | 0 | 0 | 19 | **19** | 95% |
| en:Timeline of the history of the United States (2010–present) | us | 존재 | 1372816186 | 0 | 0 | 0 | 80 | **80** | 100% |
| ko:일본사 시대 구분표 | jp | 존재 | 41977812 | 1 | 38 | 3 | 0 | **3** | 100% |

**열별 후보 행 합계** — kr 243 · cn 1082 · jp 1581 · us 279 · world 18

## 연도 셀 표본

- ko:한국사 연표 — `BC.70만`, `BC.1만`, `8000`
- en:Timeline of Korean history — `1412–1414: Namdaemun Market, now the old`, `1626–1627: Pyŏngjŏng Famine (병정대기근&#59; `, `2020`
- ko:세계사 연표 — `2500년경 2070년경 1800년경 1750년경`, `1600년경 1500년경`, `1200년경 1122년경 900년 770 719 600 594 525 509 492 479`
- en:Timeline of Chinese history — `7600 BC`, `7500 BC`, `7000 BC`
- en:Timeline of Japanese history — `300 BC`, `57`, `180`
- en:Timeline of pre–United States history — `c. 27,000–12,000 years ago – Humans cros`, `c. 15,500 year old arrowhead; oldest ver`, `c. 11,500 BCE – Start of Clovis Culture `
- en:Timeline of the history of the United States (1790–1819) — `1795 – 11th Amendment "ratified by 12 of`, `1804 – 12th Amendment ratified`, `1813-1814 - Creek War`
- en:Timeline of the history of the United States (1820–1859) — `1832 – 1832 United States presidential e`, `1840 – 1840 United States presidential e`, `1854-1855 Know-Nothing Party, mushroom g`
- en:Timeline of the history of the United States (1860–1899) — `1862–1863 – Lincoln issues Emancipation `, `1870 – 15th Amendment`, `1760–1789`
- en:Timeline of the history of the United States (1900–1929) — `1913 – 16th Amendment, establishing an i`, `1913 – 17th Amendment, establishing the `, `1916 – 1916 United States presidential e`
- en:Timeline of the history of the United States (1930–1949) — `1933 – 20th Amendment, establishing the `, `1933 – 21st Amendment, ending Prohibitio`, `1936 - 1936 Tupelo–Gainesville tornado o`
- en:Timeline of the history of the United States (1950–1969) — `1951 – 22nd Amendment, establishing term`, `1956 – 1956 United States presidential e`, `1960 – 1960 United States presidential e`
- en:Timeline of the history of the United States (1970–1989) — `1973–1974 — The United States is affecte`, `1981 – 1982 United States is part of the`, `1981–1982 — The killing of 6-year-old Ad`
- en:Timeline of the history of the United States (1990–2009) — `1994 — 1994 Northridge earthquake kills `, `1995-1996 — A budget crisis forces the f`, `1998-1999 — Clinton–Lewinsky scandal: Pr`
- en:Timeline of the history of the United States (2010–present) — `2016 – 36 people are killed in the Oakla`, `1760–1789`, `1790–1819`
- ko:일본사 시대 구분표 — `기원전 3세기`, `기원전 2세기`, `기원전 1세기`

## 한계

- 정규식 기반이라 중첩 표를 정확히 다루지 못한다. 실제 수집기는 HTML 파서를 쓴다.
- 위키백과 연표는 표와 불릿 목록을 섞어 쓴다. 표만 세면 목록형 문서가 '원천 없음'으로 보인다.
- `링크 보유`는 상한이다. 링크가 있어도 그 문서에 Wikidata QID가 없거나, 사건이 아닌
  인물·지명 링크일 수 있다. 실제 부착률은 이보다 낮다.
- 머리행이 행 수에 포함돼 있어 실제 사건 행은 표 개수만큼 적다.
