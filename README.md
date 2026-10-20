# 여행심플 — esimoa API 신청용 MVP

해외여행 eSIM 정보/비교 서비스의 초기 정적 사이트입니다.

## 현재 포함
- 메인 랜딩 페이지
- 국가별 eSIM 페이지
- eSIM 검색 UI
- 설치방법
- 개인정보처리방침
- 이용약관
- 문의 페이지
- robots.txt / sitemap.xml
- 추후 esimoa Public API를 연결할 위치

## 배포
Cloudflare Pages에서 GitHub 저장소를 연결합니다.
- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `/`

Cloudflare Pages 공식 문서:
https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## API 연결 전
1. esimoa 파트너 가입
2. 사이트 주소 등록
3. Developer Center에서 Public API key 생성
4. API key는 브라우저 코드에 넣지 말고 서버측 환경변수에 보관
5. `/functions/esim.js` 같은 서버측 함수에서 API 호출

## 주의
- `contact@example.com`은 실제 운영 이메일로 교체해야 합니다.
- `YOUR-SITE.pages.dev`는 실제 Pages 주소로 교체해야 합니다.
- 개인정보처리방침/약관은 실제 수집·판매 구조가 확정되면 그 내용에 맞게 수정해야 합니다.


## 여행 콘텐츠 자동화 운영 (2026-10-20)

현재 배포는 `wrangler.jsonc`를 사용하는 Cloudflare Workers입니다.
위의 Pages/API 연결 전 안내는 초기 MVP 기록이며 현재 구성과 다릅니다.

- GitHub Actions: 한국시간 매일 오전 9시 예약 (실제 시작은 지연될 수 있음).
- RSS: 발행일이 확인되는 최근 14일 자료만 수집합니다.
- 같은 URL, 추적 파라미터만 다른 URL, 유사 제목을 중복 후보로 제외합니다.
  다른 제목으로 보도된 같은 사건까지 완전히 판별하지는 못합니다.
- 국가 선택은 날짜별로 순환하며 항상 일본이 먼저 선택되는 것을 방지합니다.
- OpenAI 모델은 `gpt-4.1-mini`로 고정합니다.
- API 요청 전 예약 기록을 저장하며 실패도 하루 한도에 포함합니다.
- 하루 최대 1회, 달력 월 최대 31회 요청, 응답 최대 3,500토큰입니다.
  금액 기준의 하드 한도가 아니며 요금 변동·별도 앱 사용량은 통제하지 못합니다.
- `generation_ledger.json`에 요청 예약 및 응답 usage를 기록합니다.
  기록 커밋/푸시가 실패하면 다음 실행 전에 이력을 복구해야 합니다.
- 자동화끼리 동시에 실행되지 않게 설정하며 실패 시에도 기록 저장을 시도합니다.
- 오늘 수집한 주제가 없거나 중복 기록이 손상되면 생성을 중단합니다.
- 생성물은 `draft`, `unverified`, `publication_hold: true`로 저장됩니다.
  RSS는 주제 탐색용이며 원문·공식 출처 확인을 대신하지 않습니다.
- 게시 전 원문과 공식 기관 자료를 확인하고 주장별 근거 URL·확인일을 기록하세요.
  정책/입국/비자 관련 내용은 공식 출처 검토 전 공개하지 마세요.
- `.assetsignore`는 초안, 스크립트, 테스트, 서버 소스를 정적 배포에서 제외합니다.
  공개 GitHub 저장소에 커밋한 파일 자체는 이 설정으로 비공개가 되지 않습니다.
- 자동 게시 및 티스토리 연동은 사용하지 않습니다.

검증: `python -m unittest discover -s tests -v`
배포 후 `/drafts/articles/used_topics.json`, `/scripts/generate_articles.py`가
파일 내용을 제공하지 않는지 확인하세요. eSIM 조회도 함께 점검하세요.

### 공식 출처와 주장 검토 기록

초안 생성 전 JNTO, 대만 관광서, 베트남 공식 관광 사이트, 태국 관광청,
Brand USA의 국가별 시작 페이지를 수집합니다. eSIM/iPhone 주제에는
Apple의 iPhone eSIM 설치 문서도 후보로 추가합니다.

- 허용된 HTTPS 호스트만 접근하고 리다이렉트도 검사합니다.
- 국가별 안내에서 주제 키워드와 일치하는 동일 호스트 링크를 최대 1개 더 읽습니다.
  범용 홈페이지는 특정 뉴스나 정책의 증거로 인정하지 않습니다.
- 읽은 자료는 최대 3개, 페이지당 발췌 최대 2,400자이며 HTML 크기·연결 시간도 제한합니다.
- 언론 원문은 자동으로 읽지 않습니다. RSS 메타데이터와 실제 수집한 공식 자료를 구분합니다.
- 같은 AI 생성 요청에 자료를 전달하며 별도의 유료 검증 요청은 추가하지 않습니다.
- 글 옆의 `*.review.json`에 URL, 자료 제목, UTC 확인 시각, 발췌,
  정리된 본문 해시, 연결 실패, 주장·인용문 연결 결과를 저장합니다.
- 검사는 본문 문장 일치, 실제 출처 ID, 원문 발췌에 인용문이 존재하는지만 확인합니다.
  번역의 정확성, 논리적 함의, 반대 근거, 모든 주장 누락 여부는 자동 판정하지 않습니다.
- `needs_human_review`도 검증 완료가 아닙니다. 근거가 없거나 인용이 틀리면
  `insufficient_evidence`로 기록하며, 어느 경우든 `publication_hold: true`를 유지합니다.
- 관광기관의 일반 안내는 입국·비자·법적 정책 변경의 관할 기관 직접 발표를 대신하지 않습니다.
- 동적 렌더링, 접속 차단, 한영 키워드 불일치 등으로 근거를 확보하지 못할 수 있습니다.
  이때 자료를 지어내지 않고 검토 필요 상태로 저장합니다.
- 사람이 제목·요약·본문 전체와 최신 관할기관 발표를 확인한 후에만 별도로 게시하세요.

### 방문·구매 링크 클릭 통계

- GA4 측정 ID: `G-1RLBXT6L9D` (공개 사이트 식별값, 비밀 키 아님).
- 모든 HTML 페이지에서 `/assets/analytics.js`를 한 번 불러옵니다.
- 방문자가 ‘통계 허용’을 선택한 뒤에만 Google 태그를 불러옵니다.
  거부해도 상품 조회·추천 링크는 동작하며 오른쪽 아래 ‘통계 설정’에서 변경 가능합니다.
- 기본 페이지 통계 외에 `esim_purchase_click` 이벤트로 구매 페이지 링크 클릭을 기록합니다.
  이는 실제 결제나 매출이 아닙니다. 실제 주문·커미션은 eSIMOA 대시보드에서 확인하세요.
- 광고 저장·개인 최적화는 비활성화합니다. 페이지 URL의 임의 쿼리와 fragment는
  통계에서 제거하고, 유입 페이지 주소는 origin만 전달합니다.
- 글별 유입 링크는 `utm_source=tistory&utm_medium=blog&utm_campaign=post-YYYYMMDD`를 사용합니다.
  기존 country·days 파라미터는 유지하세요. 같은 날짜의 글은 같은 캠페인으로 묶입니다.
- 노출된 모든 방문자가 집계되는 것은 아닙니다(동의 거부, 광고 차단, 수집 지연 등).
- 검증: `node tests/test_analytics.cjs`, `python -m unittest discover -s tests -v`.
