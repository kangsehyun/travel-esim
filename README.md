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

- GitHub Actions: 한국시간 06:17 생성 시도 및 3회 보완 예약 (실제 시작은 지연될 수 있음).
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

## 운영 정책·문의 관리 (2026-10-20)

- 공개 문의: rkdalstjd8921@gmail.com. `privacy.html`, `terms.html`, `contact.html`을 실제 운영과 함께 관리합니다. 이전 문서는 `legal/`에 보존합니다.
- 문의를 처리한 뒤 지체 없이, 늦어도 30일 이내 메일함·다운로드 사본에서 삭제합니다. 자동 삭제 기능을 구현한 것은 아니므로 운영자가 직접 이행해야 합니다. Gmail 휴지통·백업의 삭제 처리 시간도 확인합니다.
- 문의 수집·이용 및 Gmail 국외 처리 동의를 각각 확인합니다. 동의 표시가 없는 일반 문의에는 필요한 안내만 회신하고 본격적인 처리를 진행하지 않습니다. 개인정보 권리 요청은 불필요한 새 동의를 조건으로 제한하지 않습니다. 본인 확인은 최소한으로 하고 법정 처리 기한을 따릅니다.
- GA4 동의는 v2부터 수집·이용과 국외 처리를 별도로 선택해야 합니다. v1 허용은 승계하지 않습니다. 선택 버전·일시는 브라우저 로컬에 기록되며 서버에 개인정보 동의 장부를 구축한 것은 아닙니다. 별도 감사·입증 요구에 충분한지는 확인이 필요합니다.
- GA4 관리 화면에서 사용자·이벤트 보관을 각 2개월, 새 활동에 따른 사용자 데이터 보관 재설정을 끈 상태로 저장했습니다(2026-10-20). 변경 적용은 Google 안내상 24시간 후이며 집계 보고서는 별개입니다. 쿠키 유효기간 90일은 서버 데이터 보관 기간과 다릅니다.
- 이 변경은 법률 적합성 인증이나 전면 법률 검토가 아닙니다. 확인이 필요한 사항: (1) 여행심플의 개인/사업자 운영 형태와 통신판매·중개 등 실제 법적 지위 및 표시 의무, (2) Google/Gmail/Cloudflare의 실제 국외 처리 국가·재위탁 범위·보유 기간·적용 계약과 적법한 이전 근거, (3) 미성년자·동의 증빙·안전성 확보조치에 관한 운영 수준. 공개한 국가 목록 링크만으로 국가별 고지 요건을 충족한다고 단정하지 않습니다.
- 정책 문구만으로 계정 보안·파기·권리 요청 대응이 자동 수행되지 않습니다. 새 수집 기능이나 자체 결제를 추가하기 전에 정책·동의·법적 지위를 다시 점검하세요. API·제휴 계정 키는 공개 문서에 기록하지 마세요.

참고한 공식 자료:
- 개인정보 보호법 제28조의8: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334957
- 개인정보 포털 작성지침: https://www.privacy.go.kr/front/bbs/bbsList.do?bbsNo=BBSMSTR_000000000049
- GA4 보관: https://support.google.com/analytics/answer/7667196?hl=ko
- Google 처리 약관: https://business.safety.google/adsprocessorterms/
- Cloudflare 개인정보/처리 약관: https://www.cloudflare.com/privacypolicy/ 및 https://www.cloudflare.com/cloudflare-customer-dpa/

## 생성 전 공식 자료 확인과 실행 상태 (2026-10-20)

유료 글 작성 전 중복을 제외한 후보를 최대 3개까지 확인합니다. 허용된 공식 도메인에서 수집한 구체적인 주제 후보 또는 기기 안내 본문(120자 이상)이 있어야 생성 요청을 예약합니다. 관광청 첫 화면 같은 `country_context`만 있거나 자료가 없으면 AI 호출과 유료 예약을 모두 건너뜁니다. 입력 길이도 예약 전에 검사합니다. 자료가 있다는 것은 해당 뉴스·본문 주장이 입증되었다는 뜻이 아니며 모든 결과는 여전히 `publication_hold: true`인 초안입니다.

마지막 생성 시도의 요약은 `drafts/articles/run-YYYY-MM-DD.json`에 저장합니다. 같은 날짜 재실행 시 덮어쓰므로 이 파일은 하루 전체 이력이나 API 청구 장부가 아닙니다. 당일 `.md`, `.review.json`, `generation_ledger.json`도 함께 확인합니다. API 오류 본문이나 키를 상태 파일·생성 오류 메시지에 기록하지 않습니다.

| 상태 | 의미 |
| --- | --- |
| started / generating | 생성 단계 시작 / 유료 요청 예약 후 작성 시작 |
| generated | 초안·검토 기록 저장 완료, 사실 검증·게시 승인 완료는 아님 |
| skipped_no_new_topics | 중복 제외 후 새 후보 없음 |
| skipped_insufficient_evidence | 최대 3개 후보에서 사용할 구체적 공식 자료를 확보하지 못해 유료 생성 보류 |
| skipped_input_limit | 입력 길이 초과로 유료 생성 보류 |
| skipped_request_limit | 기존 일일·월간 요청 한도 도달 |
| failed | 생성 단계 예외 발생. error_type만 기록하며 Actions 단계도 확인 필요 |

수집 단계나 테스트 단계에서 먼저 실패하면 위 상태 파일이 없을 수 있고, 저장소 push에 실패하면 최신 상태가 반영되지 않을 수 있습니다. 파일 부재만으로 성공·실패를 단정하지 않습니다. GitHub 예약 실행은 지연·누락 가능성이 있어 매일 같은 시각의 생성이나 매일 1편을 보장하지 않습니다. 채팅 전달 작업은 그날 파일과 실행 상태를 읽고 새 초안이 없으면 사유를 알리며, 이전 글을 새 글로 재전달하거나 임의 유료 재생성을 하지 않습니다.

호출 한도는 기존 기록 기반 일일 1회·월 31회, 고정 모델 및 토큰 한도를 유지합니다. 실제 금액의 결제 차단 장치가 아니며 다른 앱·키에서 발생하는 API 비용까지 제한하지 않습니다. 이번 검증은 네트워크/API를 모의 처리한 테스트만 실행했으며, 실제 유료 글 생성 워크플로를 실행하지 않았습니다.

## Custom domain (2026-10-20)

Public site: https://travelsimple-esim.com . Both custom domains are managed by Wrangler. GET/HEAD pages on the old workers.dev host and www redirect permanently to the apex, preserving paths and queries. Existing API URLs remain available. All requests run through the Worker to apply host redirects before static assets; this counts toward the Workers request allowance. Historical drafts retain their original links.

## 오전 10시 전달 준비 및 텔레그램 알림

- 한국시간 06:17 생성 시도, 07:37·08:47·09:37 보완 실행. 당일 초안·실행 보고서·API 예약이 있으면 추가 생성을 건너뜁니다. 보완 실행은 시작하지 못한 작업을 위한 것이며, 실패한 유료 호출을 재시도하지 않습니다.
- GitHub 예약 실행은 지연·누락될 수 있어 오전 10시 완료를 보장하지 않습니다. 완전한 정시 보장이 필요한 경우 별도의 외부 스케줄러와 장애 감시 구성이 필요합니다. 채팅 전달 예약은 기존대로 유지됩니다.
- 자료 부족·호출 한도·실행 실패는 글 대신 상태로 알립니다. 모든 글은 공개 보류 초안으로만 저장하며 티스토리에 자동 게시하지 않습니다.
- GitHub 저장소 Settings → Secrets and variables → Actions → New repository secret에 `TELEGRAM_BOT_TOKEN`과 `TELEGRAM_CHAT_ID`를 등록합니다. 토큰을 채팅·코드·로그에 붙이지 마세요.
- BotFather로 만든 본인 봇의 개인 대화에서 먼저 `/start`를 보내세요. `TELEGRAM_CHAT_ID`는 그 개인 대화의 숫자 ID입니다. 그룹·채널로는 발송하지 않습니다. 기존 봇을 재사용해도 되며 getUpdates 조회가 기존 수신 프로그램에 영향을 줄 수 있으므로 별도 봇 사용을 권장합니다.
- 두 secret을 등록하면 다음 실제 실행부터 생성 완료·보류·실패 상태와 GitHub 검토 링크만 보냅니다. 전체 글이나 비밀 정보는 전송하지 않습니다. 설정 전에는 알림을 건너뛰며 생성 기능은 계속 작동합니다.
- 날짜·상태가 동일한 알림은 반복 발송하지 않습니다. 통신 오류로 결과가 불명확하면 자동 재전송하지 않고 `notification-YYYY-MM-DD.json`에 `delivery_unknown`으로 기록합니다. GitHub 저장 실패·runner 미기동·강제 종료 시에는 알림도 누락될 수 있습니다. 알림 실패만으로 유료 생성을 다시 실행하지 마세요.
