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
