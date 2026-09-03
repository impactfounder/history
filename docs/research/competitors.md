# 경쟁 서비스 조사 — 다국가 동시대 비교 연표

조사일: 2026-09-03
목적: "선택한 나라들이 같은 연도에 어떤 일이 있었는지 시계열로 비교"하는 서비스가 이미 존재하는지 확인.

## 결론 요약

- 개념 자체는 오래됨. "synchronoptic(동시 조망) 연표"라는 이름으로 1753년(Barbeu-Dubourg)부터 존재. 종이 차트(Adams Synchronological Chart 1871, Peters Synchronoptische Weltgeschichte 1952)가 원형.
- 디지털 직접 경쟁자는 있으나 각각 한계가 뚜렷함. "나라를 골라 병렬 열로 놓고 같은 연도 행에서 비교"를 무료·웹·다국어로 잘 구현한 지배적 서비스는 확인되지 않음.
- 가장 가까운 경쟁자는 hiBar(2026 베타, 유료 구독). 가로축이 지리 평면 순서로 고정되어 사용자가 나라를 임의 선택·조합하는 방식은 아님.
- 이 카테고리 최상위 트래픽(GeaCron)이 3개월 약 48만 방문 수준. 광고 단독 수익모델은 규모 한계가 있음. 경쟁자 대부분 광고+구독 또는 교육기관 라이선스 혼합.

## 1군 — 직접 경쟁 (같은 개념: 시간 × 지역 병렬)

| 서비스 | 형태 | 축 구조 | 데이터 | 언어 | 수익모델 | 상태 | 비고 |
|---|---|---|---|---|---|---|---|
| [hiBar](https://hibarhistory.com/) | 웹 | 세로=시간, 가로=지리(평면지도 순서로 지역 배치) | 사용자 등록 + 출처 인용 필수, 커뮤니티 투표 | Azure 자동번역 | 14일 무료 → €99/년, 단체 €490/년~, 광고 없음 | 2026 베타, 등록 일시중단 | 가장 근접. 나라 임의 선택이 아니라 고정 배치. 운영사·설립자 미표기 |
| [HyperHistory Online](https://www.hyperhistory.com/) | 웹 | synchronoptic 차트, 3000년 범위 | 자체 제작 | 영어 | 무료 | 1990년대 구조, 이미지 파일 1000여 개 연결 | 개념은 같으나 UI가 구식. 인터랙션 거의 없음 |
| [パラレル年表](https://apps.apple.com/jp/app/id1462606267) | iOS 앱 | 여러 "스토리"를 병렬 배치 | 위키피디아 링크 | 일본어·영어 | 무료, 인앱결제 없음 | 2024-02 마지막 업데이트, 평점 3.6(39건) | 개발사 Neusara LLC. 리뷰에 조작성 불편 지적 |
| 世界史対照年表 (일본 위키·PDF·개인 블로그 다수) | 정적 표 | 세로=시대, 가로=지역 | 수작업 | 일본어 | 없음 | 개인 제작물 산재 | 일본에서는 "対照年表"가 일반명사. 수요 증거 |
| 도서: 『한국사 세계사 비교 연표』(2021), 『日本史・世界史 同時代比較年表』(朝日新聞出版) | 종이책 | 좌우 병렬 | 편집자 | 한/일 | 도서 판매 | 판매 중 | 한·일 양국에 유료 수요 존재 |

## 2군 — 인접 경쟁 (지도 중심, 연도 스크럽)

| 서비스 | 특징 | 언어 | 수익모델 | 트래픽·규모 |
|---|---|---|---|---|
| [GeaCron](https://geacron.com/) | 3000 BC~ 연도별 세계지도. "Comparative History" 타임라인은 프리미엄 | 8개 언어(EN·ZH·FR·IT·ES·PT·DE·RU) | 무료 + 배너광고, 프리미엄 $45 영구 라이선스, 교육 플랜 | Similarweb 2026-07: 3개월 478.8K 방문, 평균 세션 1:27, 글로벌 #115,208. 유입 미국 22.7%·러시아 10.6%·영국 5.4%, 직접 접속 45% |
| [TimeMaps](https://timemaps.com/) | 지도 1,000장+ | 영어 | 무료+광고, 프리미엄 $24.99/년(개인)·$39.99(교사)·$299.99(기관) | Similarweb: 월 약 86.6K 방문 |
| [Chronas](https://www.chronas.org/) | 지도 + 위키 연동, 사용자 편집 | 영어 | 기부 | 5천만 데이터포인트 주장 |
| [Running Reality](https://www.runningreality.org/), [Omniatlas](https://omniatlas.com/), [worldhist.org](https://worldhist.org/) | 국경 변화 지도 | 영어(worldhist는 EN·RU) | 다양 | 소규모 |
| [全历史 AllHistory](https://www.allhistory.com/) | AI 지식그래프 + 시공지도 + 관계도 + 국가별 타임라인 | 중국어만 확인 | 미확인 | 중국 내 인지도 높음. 다국가 병렬 비교는 미확인 |

## 3군 — 단일 축 타임라인 (지역 필터는 있으나 병렬 비교 아님)

| 서비스 | 특징 | 비고 |
|---|---|---|
| [Histography](http://histography.io/) | 위키피디아 연동 14억 년 단일 축 | 학생 프로젝트. 나라 비교 불가 |
| [World History Encyclopedia Timeline](https://www.worldhistory.org/timeline/) | 16,441 이벤트, 연도·키워드 필터 | 광고 + 멤버십(광고 제거). 영국 World History Publishing Ltd |
| [History Timeline (Android)](https://play.google.com/store/apps/details?id=com.timleg.historytimeline) | 지역·주제 필터 | 다운로드 약 33만. 리뷰에 "그 시기에 세계 다른 곳에서 무슨 일이 있었는지 보려고 쓴다" — 우리 가설과 동일한 사용 동기 |
| [Histropedia](https://histropedia.com/) | Wikidata SPARQL → 타임라인 생성 | 30만 타임라인. 운영 중. 데이터 파이프라인 참고 대상 |
| [옐로우의 세계 세계사 연표](https://yellow.kr/yhistory.jsp) | 한국사+세계사 단일 리스트 | 한국 개인 사이트 |
| 위키피디아 연도 페이지 (예: [1592](https://en.wikipedia.org/wiki/1592)) | 월별 정렬, 지역별 구분 없음 | 무료 대체재이지만 비교 UX 없음 |

## 사망·중단

- ChronoZoom (Microsoft Research + UC Berkeley, 2012~): retired, 접속만 가능.

## 시사점 (PRD 반영 후보)

1. 빈 자리: "나라 선택 → 병렬 열 → 같은 연도 행" 무료 웹 서비스. hiBar는 유료·고정 배치, HyperHistory는 구식, 앱들은 단일 축.
2. 데이터: 위키피디아 국가별 타임라인 문서(Timeline of Korean/Chinese/Japanese history 등)와 Wikidata 다국어 라벨이 초기 데이터 기반이 될 수 있음. 단 CC BY-SA 라이선스 고지·동일조건 공유 의무 검토 필요.
3. 수익: 이 카테고리 최상위가 월 15만 안팎 방문. 광고 단독으로는 규모 한계. 경쟁자들은 광고+구독, 교육기관 라이선스를 병행함.
4. "언어 장벽 없음" 리스크: 역사 서술은 사관이 갈림(동해/일본해, 임진왜란/文禄·慶長の役, 한국전쟁 명칭 등). 다국어는 번역 문제가 아니라 관점 충돌 문제. 표기 원칙이 PRD에 필요.
5. 시장 신호: 한·일 양국에 "비교 연표" 종이책이 팔리고, Android 앱 리뷰에 정확히 같은 사용 동기가 나타남. 수요는 검증됨.
