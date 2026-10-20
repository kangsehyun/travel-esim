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
