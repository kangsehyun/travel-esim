import os
import re
import json
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")

TOPICS_DIR = Path("drafts")
ARTICLES_DIR = TOPICS_DIR / "articles"
ARTICLES_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

SITE_URL = "https://travel-esim.rkdalstjd8921-cfa.workers.dev"

MAX_ARTICLES_PER_RUN = 1


def read_latest_topics():
    """가장 최근에 생성된 주제 파일을 읽는다."""
    files = sorted(TOPICS_DIR.glob("topics-*.md"), reverse=True)

    if not files:
        raise FileNotFoundError(
            "drafts/topics-YYYY-MM-DD.md 파일을 찾을 수 없습니다."
        )

    content = files[0].read_text(encoding="utf-8")
    topics = []

    current_country = "공통"
    current_topic = None

    for line in content.splitlines():
        if line.startswith("## "):
            current_country = line[3:].strip()

        elif line.startswith("### "):
            if current_topic:
                topics.append(current_topic)

            current_topic = {
                "country": current_country,
                "title": line[4:].strip(),
                "source": "",
                "url": "",
                "description": "",
            }

        elif current_topic and line.startswith("- 출처:"):
            current_topic["source"] = line.split(":", 1)[1].strip()

        elif current_topic and line.startswith("- 원문:"):
            current_topic["url"] = line.split(":", 1)[1].strip()

        elif current_topic and line.startswith("- 설명:"):
            current_topic["description"] = line.split(":", 1)[1].strip()

    if current_topic:
        topics.append(current_topic)

    return topics, files[0]


def slugify(text):
    """파일 이름으로 사용할 짧은 문자열을 만든다."""
    text = re.sub(r"[^\w가-힣-]+", "-", text.lower())
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:60] or "travel-topic"


def topic_id(topic):
    """같은 주제가 다시 생성되지 않도록 식별자를 만든다."""
    raw = topic.get("url") or topic["country"] + ":" + topic["title"]
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def load_used_topics():
    """이미 작성한 주제 ID를 읽는다."""
    used_file = ARTICLES_DIR / "used_topics.json"

    if not used_file.exists():
        return set()

    try:
        data = json.loads(used_file.read_text(encoding="utf-8"))
        return set(data)
    except (json.JSONDecodeError, OSError):
        return set()


def save_used_topics(used):
    used_file = ARTICLES_DIR / "used_topics.json"
    used_file.write_text(
        json.dumps(sorted(used), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def create_prompt(topic):
    """사실 확인과 독창적인 설명을 강조한 작성 지침."""
    return f"""
당신은 한국어 여행 정보 사이트 '여행심플'의 콘텐츠 작성자입니다.

아래 주제를 바탕으로 검색 이용자에게 실제로 도움이 되는 독창적인
여행 정보 블로그 글 초안을 작성하세요.

주제 국가: {topic['country']}
주제: {topic['title']}
원문 제목 출처: {topic['source']}
참고 링크: {topic['url']}
수집된 설명: {topic['description']}

작성 규칙:
1. 한국어로 자연스럽고 읽기 쉽게 작성합니다.
2. 뉴스 제목이나 원문 문장을 그대로 복사하지 않습니다.
3. 원문에 없는 가격, 통신사, 상품 조건, 날짜, 통계는 지어내지 않습니다.
4. 최신 여부를 확인하지 못한 내용은 확정적으로 쓰지 않습니다.
5. 특정 eSIM 상품의 가격이나 무제한 데이터 조건을 추측하지 않습니다.
6. eSIM 호환성, 데이터 로밍, 설치 및 개통은 기기와 상품에 따라
   달라질 수 있음을 필요한 곳에 안내합니다.
7. 과장 광고, 반복 키워드, 구매를 강요하는 표현을 피합니다.
8. 기존 페이지와 관련된 내부 링크 후보를 자연스럽게 포함합니다.
9. 의료·법률·금융처럼 여행 정보 범위를 벗어난 조언은 하지 않습니다.
10. 게시 전에 사람이 사실과 링크를 검토할 수 있도록 초안으로 작성합니다.

사이트의 관련 페이지:
- 전체 국가: {SITE_URL}/countries.html
- 상품 비교: {SITE_URL}/esim.html
- 설치 안내: {SITE_URL}/install.html
- 일본: {SITE_URL}/japan-esim.html
- 대만: {SITE_URL}/taiwan-esim.html
- 베트남: {SITE_URL}/vietnam-esim.html
- 태국: {SITE_URL}/thailand-esim.html
- 미국: {SITE_URL}/usa-esim.html

아래 JSON 형식으로만 답변하세요. Markdown 코드 블록으로 감싸지 마세요.
{{
  "title": "검색 의도가 분명한 한국어 제목",
  "meta_description": "페이지를 요약하는 설명문",
  "slug": "영문 소문자와 하이픈으로 된 짧은 주소",
  "excerpt": "글의 핵심 요약",
  "content": "Markdown 형식의 본문. 소제목, 목록, FAQ를 포함",
  "tags": ["태그1", "태그2", "태그3"],
  "internal_links": [
    {{
      "url": "{SITE_URL}/install.html",
      "anchor": "eSIM 설치 방법"
    }}
  ],
  "fact_check_notes": [
    "게시 전에 확인할 사항"
  ]
}}

본문 작성 기준:
- 독자에게 필요한 정보를 충분히 설명합니다.
- 제목과 본문이 일치하도록 작성합니다.
- 적절한 H2/H3 소제목을 사용합니다.
- 실제로 확인할 수 없는 경험담을 만들어내지 않습니다.
- 마지막에는 핵심 요약과 자연스러운 다음 행동을 안내합니다.
"""


def call_openai(topic):
    """OpenAI Responses API를 호출해 글 초안을 만든다."""
    if not API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY가 없습니다. GitHub Actions Secrets를 확인하세요."
        )

    payload = {
        "model": MODEL,
        "input": create_prompt(topic),
        "max_output_tokens": 5000,
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"OpenAI API 요청 실패: HTTP {error.code}. "
            f"세부 정보: {details[:1000]}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(
            f"OpenAI API 연결 실패: {error.reason}"
        ) from error

    output_text = []

    for item in result.get("output", []):
        if item.get("type") != "message":
            continue

        for part in item.get("content", []):
            if part.get("type") == "output_text":
                output_text.append(part.get("text", ""))

    text = "\n".join(output_text).strip()

    if not text:
        raise RuntimeError("OpenAI API에서 글 본문을 받지 못했습니다.")

    # 모델이 JSON을 코드 블록으로 반환하는 경우 제거
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        article = json.loads(text)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "AI 응답이 올바른 JSON 형식이 아닙니다. "
            "Actions 로그를 확인하세요."
        ) from error

    required = ["title", "meta_description", "slug", "content"]

    for field in required:
        if not isinstance(article.get(field), str) or not article[field].strip():
            raise RuntimeError(f"AI 응답에서 필수 항목이 빠졌습니다: {field}")

    return article


def save_article(topic, article):
    """글과 검토 정보를 Markdown 파일로 저장한다."""
    identifier = topic_id(topic)
    slug = slugify(article.get("slug", ""))
    output_file = ARTICLES_DIR / f"{TODAY}-{slug}-{identifier}.md"

    tags = article.get("tags", [])
    links = article.get("internal_links", [])
    notes = article.get("fact_check_notes", [])

    lines = [
        "---",
        f"title: {json.dumps(article['title'], ensure_ascii=False)}",
        f"description: {json.dumps(article['meta_description'], ensure_ascii=False)}",
        f"slug: {json.dumps(slug, ensure_ascii=False)}",
        f"date: {TODAY}",
        'status: "draft"',
        f"source_title: {json.dumps(topic['title'], ensure_ascii=False)}",
        f"source_url: {json.dumps(topic['url'], ensure_ascii=False)}",
        "tags:",
    ]

    for tag in tags:
        lines.append(f"  - {json.dumps(str(tag), ensure_ascii=False)}")

    lines.extend(["---", "", f"# {article['title']}", ""])

    if article.get("excerpt"):
        lines.extend([article["excerpt"], ""])

    lines.extend([
        article["content"],
        "",
        "## 관련 페이지",
        "",
    ])

    for link in links:
        if not isinstance(link, dict):
            continue

        url = str(link.get("url", "")).strip()
        anchor = str(link.get("anchor", "")).strip()

        # 내부 링크는 사이트 도메인 안의 HTTPS 주소만 허용
        if url.startswith(SITE_URL + "/") and anchor:
            lines.append(f"- [{anchor}]({url})")

    lines.extend([
        "",
        "## 게시 전 확인 사항",
        "",
        "- [ ] 가격, 사용 기간, 데이터 조건의 최신 여부 확인",
        "- [ ] 원문과 사실 관계 확인",
        "- [ ] 내부 링크가 정상적으로 열리는지 확인",
        "- [ ] 기존 콘텐츠와 중복되는 내용이 없는지 확인",
        "",
    ])

    for note in notes:
        lines.append(f"- {note}")

    output_file.write_text("\n".join(lines), encoding="utf-8")
    return output_file


def main():
    topics, source_file = read_latest_topics()
    used = load_used_topics()

    candidates = [
        topic for topic in topics
        if topic_id(topic) not in used
    ]

    if not candidates:
        print("새로 작성할 주제가 없습니다.")
        print(f"확인한 주제 파일: {source_file}")
        return

    # 한 번의 실행에서 API 비용이 과도하게 발생하지 않도록 1개만 작성
    topic = candidates[0]

    print(f"주제 파일: {source_file}")
    print(f"선택한 주제: {topic['title']}")
    print("AI 글 작성 시작")

    article = call_openai(topic)
    output_file = save_article(topic, article)

    used.add(topic_id(topic))
    save_used_topics(used)

    print("글 초안 작성 완료")
    print(f"저장 위치: {output_file}")
    print("상태: draft (사이트에 자동 게시하지 않음)")


if __name__ == "__main__":
    main()
