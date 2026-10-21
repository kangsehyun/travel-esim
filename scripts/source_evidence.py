"""Bounded official-source collection; quotation checks are NOT fact verification."""
import hashlib
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit, urljoin

# Curated first-party starting pages. Hubs provide context, never proof of news.
OFFICIAL_SOURCES = {
    '일본': ('JNTO', 'https://www.japan.travel/en/plan/'),
    '대만': ('Taiwan Tourism Administration', 'https://eng.taiwan.net.tw/'),
    '베트남': ('Vietnam Tourism', 'https://vietnam.travel/'),
    '태국': ('Tourism Authority of Thailand', 'https://www.tourismthailand.org/'),
    '미국': ('Brand USA', 'https://www.visittheusa.com/'),
}
APPLE_SOURCE = ('Apple Support', 'https://support.apple.com/en-us/118669')
ALLOWED_HOSTS = frozenset(urlsplit(row[1]).hostname for row in [*OFFICIAL_SOURCES.values(), APPLE_SOURCE])
MAX_BYTES = 1_500_000
MAX_EXCERPT = 2400
MAX_SOURCES = 3


def allowed_url(url):
    try:
        parsed = urlsplit(url)
        return parsed.scheme == 'https' and parsed.hostname in ALLOWED_HOSTS and parsed.port in (None, 443) and not parsed.username and not parsed.password
    except ValueError:
        return False


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError('Unapproved redirect')
        return super().redirect_request(request, fp, code, message, headers, newurl)


class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.base_href = None
        self.parts = []
        self.links = []
        self.anchor = None
        self.in_title = False
        self.title = []

    def handle_starttag(self, tag, attrs):
        if tag == 'base' and self.base_href is None:
            self.base_href = dict(attrs).get('href')
        if tag in ('script', 'style', 'noscript', 'svg', 'template', 'nav', 'footer', 'header'):
            self.hidden += 1
        if tag == 'title':
            self.in_title = True
        if not self.hidden and tag == 'a':
            self.anchor = [dict(attrs).get('href', ''), []]

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'svg', 'template', 'nav', 'footer', 'header'):
            self.hidden = max(0, self.hidden - 1)
        if tag == 'title':
            self.in_title = False
        if tag == 'a' and self.anchor:
            self.links.append((self.anchor[0], ' '.join(self.anchor[1])))
            self.anchor = None

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if not self.hidden:
            self.parts.append(data)
            if self.anchor:
                self.anchor[1].append(data)


def fetch_page(url):
    if not allowed_url(url):
        raise ValueError('Unapproved source URL')
    opener = urllib.request.build_opener(SafeRedirect())
    request = urllib.request.Request(url, headers={'User-Agent': 'TravelSimpleSourceReview/1.0', 'Accept': 'text/html'})
    with opener.open(request, timeout=12) as response:
        if not allowed_url(response.geturl()):
            raise ValueError('Unapproved final URL')
        if response.headers.get_content_type() != 'text/html':
            raise ValueError('Expected HTML')
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError('Source page too large')
        parser = PageText()
        parser.feed(body.decode(response.headers.get_content_charset() or 'utf-8', errors='replace'))
        text = re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()
        if len(text) < 120 or any(marker in text.casefold() for marker in ('just a moment...', 'verify you are human', 'access denied', 'captcha')):
            raise ValueError('Source unreadable or challenge page')
        link_base = urljoin(response.geturl(), parser.base_href or '')
        if not allowed_url(link_base) or urlsplit(link_base).hostname != urlsplit(response.geturl()).hostname:
            link_base = response.geturl()
        return {'link_base': link_base, 'url': response.geturl(), 'title': ' '.join(parser.title).strip()[:240], 'text': text, 'links': parser.links}


def topic_terms(topic):
    # Country names and generic travel words alone cannot make a page relevant.
    stop = {'travel', 'japan', 'taiwan', 'vietnam', 'thailand', 'united', 'states', 'tourism', 'news', '일본', '대만', '베트남', '태국', '미국', '여행'}
    return sorted({word for word in re.findall(r'[a-zA-Z]{4,}|[가-힣]{2,}', topic['title'].casefold()) if word not in stop})[:24]


def excerpt_for(text, terms):
    # Preserve contiguous source text; do not splice sentences into a quotation.
    positions = [text.casefold().find(term) for term in terms if term in text.casefold()]
    start = max(0, min(positions) - 300) if positions else 0
    return text[start:start + MAX_EXCERPT]


def collect_evidence(topic):
    terms = topic_terms(topic)
    sources, errors = [], []
    seeds = []
    if topic.get('country') in OFFICIAL_SOURCES:
        seeds.append((*OFFICIAL_SOURCES[topic['country']], 'country_context'))
    if re.search(r'esim|iphone|아이폰', topic['title'], re.I):
        seeds.append((*APPLE_SOURCE, 'device_guidance'))
    for organization, url, role in seeds:
        try:
            page = fetch_page(url)
        except Exception as error:
            errors.append({'url': url, 'error': type(error).__name__})
            continue
        pages = [(page, role)]
        if role == 'country_context':
            candidates = []
            for href, label in page['links']:
                target = urljoin(page.get('link_base', page['url']), href).split('#')[0]
                score = sum(term in (label + ' ' + target).casefold() for term in terms)
                if score and allowed_url(target) and urlsplit(target).hostname == urlsplit(url).hostname and target != page['url']:
                    candidates.append((score, target))
            if candidates:
                target = sorted(candidates, reverse=True)[0][1]
                try:
                    pages.insert(0, (fetch_page(target), 'topic_candidate'))
                except Exception as error:
                    errors.append({'url': target, 'error': type(error).__name__})
        for source_page, source_role in pages:
            if len(sources) >= MAX_SOURCES or any(s['url'] == source_page['url'] for s in sources):
                continue
            excerpt = excerpt_for(source_page['text'], terms)
            sources.append({'id': f'S{len(sources) + 1}', 'organization': organization,
                            'url': source_page['url'], 'title': source_page['title'],
                            'retrieved_at': datetime.now(timezone.utc).isoformat(),
                            'role': source_role, 'excerpt': excerpt,
                            'text_sha256': hashlib.sha256(source_page['text'].encode()).hexdigest(),
                            'status': 'retrieved_not_verified'})
    return {'sources': sources, 'errors': errors, 'original_news_fetched': False}


def check_claims(article, evidence):
    """Check citation provenance only. Semantic support still requires a person."""
    sources = {row['id']: row for row in evidence['sources']}
    claims = article.get('claims', [])
    issues, checked = [], []
    if not isinstance(claims, list) or not claims:
        claims = []
        issues.append('주장별 근거 목록이 없습니다.')
    if not sources:
        issues.append('읽을 수 있는 공식 출처를 확보하지 못했습니다.')
    for row in claims[:30]:
        if not isinstance(row, dict):
            issues.append('잘못된 주장 형식')
            continue
        claim, source_id, quote = (row.get(key, '') for key in ('claim', 'source_id', 'quote'))
        valid_types = all(isinstance(value, str) for value in (claim, source_id, quote))
        source = sources.get(source_id) if isinstance(source_id, str) else None
        matches = bool(valid_types and source and 20 <= len(quote) <= 300 and quote in source['excerpt'] and claim.strip() and claim in article.get('content', '') and source['role'] != 'country_context')
        if not matches:
            issues.append('본문 주장·출처 ID·원문 인용문 연결을 확인해야 합니다.')
        checked.append({'claim': claim if isinstance(claim, str) else '', 'source_id': source_id if isinstance(source_id, str) else '',
                        'quote': quote[:300] if isinstance(quote, str) else '',
                        'citation_check': 'matched_requires_human_review' if matches else 'missing_or_invalid',
                        'semantic_verdict': 'not_verified'})
    return {'verification_status': 'needs_human_review' if checked and not issues else 'insufficient_evidence',
            'publication_hold': True, 'issues': sorted(set(issues)), 'claims': checked,
            'limitations': ['인용문 일치는 사실의 정확성·최신성·주장 전체의 근거를 보장하지 않습니다.',
                           '모델이 중요한 주장을 누락했을 수 있어 제목·요약·본문 전체를 검토해야 합니다.',
                           '입국·비자·정책은 관할 정부 기관의 직접 발표를 별도로 확인해야 합니다.']}


# Pinned first-party guides are independent topics, never evidence for RSS news.
FALLBACK_REVISION = 1
OFFICIAL_GUIDES = [
    ('118227', '해외여행 아이폰 eSIM 준비: 출발 전 확인할 사항', ['Before you begin', 'travel internationally']),
    ('118669', '아이폰 eSIM 설치 방법: QR 코드와 개통 전 확인 사항', ['What you need', 'QR code']),
    ('109317', '아이폰 듀얼 SIM 여행 설정: 통화 회선과 데이터 회선', ['cellular data network', 'Use two phone numbers']),
    ('102478', '아이폰 eSIM 설정이 안 될 때 확인할 항목', ['Before you begin', 'Check your plans']),
]


def official_guide_topics():
    return [{'country': '공통', 'title': title, 'source': 'Apple Support 공식 안내',
             'url': f'https://support.apple.com/en-us/{identifier}',
             'description': '공식 기기 안내에 근거한 여행 준비 글. 상품별 조건이나 뉴스로 확대 해석하지 않습니다.',
             'selection_mode': 'official_guide', 'focus_terms': terms}
            for identifier, title, terms in OFFICIAL_GUIDES]


def collect_guide_evidence(topic):
    # Exact catalog membership, not merely an approved host or model-provided URL.
    curated = next((row for row in official_guide_topics()
                    if row['url'] == topic.get('url') and row['title'] == topic.get('title')), None)
    if curated is None:
        raise ValueError('Unapproved guide topic')
    try:
        page = fetch_page(curated['url'])
        excerpt = excerpt_for(page['text'], curated['focus_terms'])
        return {'sources': [{'id': 'S1', 'organization': 'Apple Support',
                 'url': page['url'], 'title': page['title'],
                 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                 'role': 'device_guidance', 'excerpt': excerpt,
                 'text_sha256': hashlib.sha256(page['text'].encode()).hexdigest(),
                 'status': 'retrieved_not_verified'}], 'errors': [],
                 'original_news_fetched': False}
    except Exception as error:
        return {'sources': [], 'errors': [{'url': curated['url'], 'error': type(error).__name__}],
                'original_news_fetched': False}


def destination_guide_topics(country):
    """Discover bounded first-party detail links; a hub is never article evidence."""
    organization, url = OFFICIAL_SOURCES[country]
    try:
        page = fetch_page(url)
    except Exception:
        return []
    topics, seen = [], set()
    for href, label in page['links']:
        target = urljoin(page.get('link_base', page['url']), href).split('#')[0]
        text = re.sub(r'\s+', ' ', label).strip()
        if (not allowed_url(target) or urlsplit(target).hostname != urlsplit(url).hostname
                or target.rstrip('/') == page['url'].rstrip('/') or target in seen
                or urlsplit(target).query or not 8 <= len(text) <= 180):
            continue
        if not re.search(r'\b(transport|airport|train|rail|internet|wi-fi|wifi|weather|luggage|accessibility|currency|electricity|customs|etiquette|safety)\b', text, re.I):
            continue
        seen.add(target)
        topics.append({'country': country, 'title': f'{country} 여행 준비: {text}',
                       'source': organization, 'url': target, 'selection_mode': 'official_destination_guide',
                       'description': '공식 관광청의 상세 안내를 바탕으로 작성하는 실용 여행 준비 글입니다.'})
        if len(topics) >= 30:
            break
    return topics


def collect_destination_evidence(topic):
    organization, hub = OFFICIAL_SOURCES[topic['country']]
    if not allowed_url(topic['url']) or urlsplit(topic['url']).hostname != urlsplit(hub).hostname:
        raise ValueError('Unapproved destination source')
    try:
        page = fetch_page(topic['url'])
        excerpt = excerpt_for(page['text'], topic_terms(topic))
        return {'sources': [{'id': 'S1', 'organization': organization, 'url': page['url'],
                 'title': page['title'], 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                 'role': 'topic_candidate', 'excerpt': excerpt,
                 'text_sha256': hashlib.sha256(page['text'].encode()).hexdigest(),
                 'status': 'retrieved_not_verified'}], 'errors': [], 'original_news_fetched': False}
    except Exception as error:
        return {'sources': [], 'errors': [{'url': topic['url'], 'error': type(error).__name__}], 'original_news_fetched': False}
