import re
import os
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
from email.utils import parsedate_to_datetime

# 한국 시간 기준 날짜
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")

# 결과 저장 폴더
OUTPUT_DIR = Path("drafts")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 공개 RSS 피드
RSS_FEEDS = [
    {
        "name": "Google News Japan",
        "url": "https://news.google.com/rss/search?q=Japan+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
        "name": "Google News Taiwan",
        "url": "https://news.google.com/rss/search?q=Taiwan+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
        "name": "Google News Vietnam",
        "url": "https://news.google.com/rss/search?q=Vietnam+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
        "name": "Google News Thailand",
        "url": "https://news.google.com/rss/search?q=Thailand+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
        "name": "Google News USA",
        "url": "https://news.google.com/rss/search?q=USA+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
        "name": "Google News eSIM",
        "url": "https://news.google.com/rss/search?q=eSIM+travel&hl=ko&gl=KR&ceid=KR:ko",
    },
]

# 국가 및 주제 분류 키워드
KEYWORDS = {
    "일본": [
        "일본", "Japan", "도쿄", "오사카", "후쿠오카",
        "삿포로", "오키나와", "eSIM"
    ],
    "대만": [
        "대만", "Taiwan", "타이베이", "가오슝", "eSIM"
    ],
    "베트남": [
        "베트남", "Vietnam", "다낭", "하노이", "호치민", "eSIM"
    ],
    "태국": [
        "태국", "Thailand", "방콕", "푸켓", "치앙마이", "eSIM"
    ],
    "미국": [
        "미국", "USA", "United States", "뉴욕", "로스앤젤레스", "eSIM"
    ],
}

TOPIC_TERMS = [
    "여행", "eSIM", "유심", "로밍", "데이터", "설치",
    "개통", "인터넷", "통신", "공항", "관광", "항공",
    "여행자", "Travel", "SIM", "roaming", "mobile data"
]


def fetch_rss(url):
    """공개 RSS를 읽고 XML 항목 목록을 반환한다."""
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TravelSimpleTopicCollector/1.0"}
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    items = []

    for item in root.findall(".//item"):
        title = item.findtext("title", default="").strip()
        link = item.findtext("link", default="").strip()
        description = item.findtext("description", default="").strip()
        pub_date = item.findtext("pubDate", default="").strip()

        # RSS HTML 태그 및 공백 정리
        description = re.sub(r"<[^>]+>", " ", description)
        description = re.sub(r"\s+", " ", description)

        if title and link:
            items.append({
                "title": title,
                "link": link,
                "description": description,
                "pub_date": pub_date,
            })

    return items


def classify_country(text):
    """제목과 설명을 기준으로 관련 국가를 추정한다."""
    for country, keywords in KEYWORDS.items():
        if any(keyword.lower() in text.lower() for keyword in keywords):
            return country

    if "esim" in text.lower() or "유심" in text or "로밍" in text:
        return "공통"

    return None


def is_relevant(text):
    """여행 및 모바일 데이터 관련 항목만 남긴다."""
    lower_text = text.lower()
    return any(term.lower() in lower_text for term in TOPIC_TERMS)


def clean_title(title):
    """파일에 사용하기 어려운 공백을 정리한다."""
    return re.sub(r"\s+", " ", title).strip()


def collect_topics():
    results = []
    seen_links = set()
    feed_errors = []

    for feed in RSS_FEEDS:
        print(f"RSS 수집 중: {feed['name']}")

        try:
            items = fetch_rss(feed["url"])
        except Exception as error:
            message = f"{feed['name']}: {type(error).__name__}"
            feed_errors.append(message)
            print(f"수집 실패: {message}")
            continue

        for item in items:
            title = clean_title(item["title"])
            text = f"{title} {item['description']}"
            link = item["link"]

            if link in seen_links:
                continue

            if not is_relevant(text):
                continue

            country = classify_country(text)
            if not country:
                continue

            seen_links.add(link)

            results.append({
                "country": country,
                "title": title,
                "link": link,
                "description": item["description"],
                "source": feed["name"],
                "pub_date": item["pub_date"],
            })

    # 국가별로 최대 10개씩 저장
    country_order = ["일본", "대만", "베트남", "태국", "미국", "공통"]
    selected = []

    for country in country_order:
        country_items = [item for item in results if item["country"] == country]
        selected.extend(country_items[:10])

    # 실행 결과를 Markdown으로 저장
    output_file = OUTPUT_DIR / f"topics-{TODAY}.md"

    lines = [
        f"# 여행심플 자동 수집 주제 - {TODAY}",
        "",
        "> 공개 RSS에서 수집한 콘텐츠 아이디어입니다.",
        "> 뉴스 제목을 그대로 복제하지 말고, 원문을 확인한 뒤 독자에게 유용한 독창적인 글로 작성하세요.",
        "",
        f"- 수집 항목: {len(selected)}개",
        f"- RSS 수집 실패: {len(feed_errors)}개",
        "",
    ]

    if not selected:
        lines.extend([
            "## 수집 결과",
            "",
            "오늘은 관련 주제를 수집하지 못했습니다.",
            "RSS 연결 상태 또는 검색 키워드를 확인하세요.",
            "",
        ])

    for country in country_order:
        country_items = [item for item in selected if item["country"] == country]

        if not country_items:
            continue

        lines.extend([f"## {country}", ""])

        for index, item in enumerate(country_items, start=1):
            lines.extend([
                f"### {index}. {item['title']}",
                "",
                f"- 출처: {item['source']}",
                f"- 원문: {item['link']}",
                f"- 발행일: {item['pub_date'] or '정보 없음'}",
                f"- 설명: {item['description'] or '설명 없음'}",
                f"- 콘텐츠 아이디어: {country} 여행자의 eSIM 선택, 데이터 사용, 설치 및 개통 관점에서 추가 조사",
                "",
            ])

    if feed_errors:
        lines.extend(["## RSS 연결 오류", ""])
        lines.extend([f"- {error}" for error in feed_errors])
        lines.append("")

    output_file.write_text("\n".join(lines), encoding="utf-8")

    print(f"수집 완료: {len(selected)}개")
    print(f"저장 파일: {output_file}")


if __name__ == "__main__":
    collect_topics()
