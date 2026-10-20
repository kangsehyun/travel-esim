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
        self.parts = []
        self.links = []
        self.anchor = None
        self.in_title = False
        self.title = []

    def handle_starttag(self, tag, attrs):
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
        return {'url': response.geturl(), 'title': ' '.join(parser.title).strip()[:240], 'text': text, 'links': parser.links}


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
                target = urljoin(page['url'], href).split('#')[0]
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
