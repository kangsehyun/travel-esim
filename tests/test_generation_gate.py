import json
import io
import urllib.error
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
from scripts import generate_articles as g


class GenerationGateTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.articles = root / 'articles'
        self.articles.mkdir()
        for key, value in [('TOPICS_DIR', root), ('ARTICLES_DIR', self.articles),
                           ('LEDGER_FILE', self.articles / 'ledger.json'),
                           ('HISTORY_FILE', self.articles / 'history.json'),
                           ('API_KEY', 'test-placeholder')]:
            self.stack.enter_context(patch.object(g, key, value))
        text = '## 일본\n' + '\n'.join(
            f'### {title}\n- 출처: RSS\n- 원문: https://example.com/{n}\n- 설명: metadata\n'
            for n, title in enumerate(['airport transport', 'museum ticket', 'mountain walking', 'train route']))
        (root / f'topics-{g.TODAY}.md').write_text(text)
        self.stack.enter_context(patch.object(g, "official_guide_topics", return_value=[]))
        self.real_call_openai = g.call_openai
        self.ai = self.stack.enter_context(patch.object(g, 'call_openai'))
        self.ai.return_value = {'title': '검토 초안', 'meta_description': '검토용', 'slug': 'review',
                                'content': '검토용 본문', 'claims': [], 'tags': [],
                                'internal_links': [], 'fact_check_notes': []}

    def evidence(self, role='topic_candidate'):
        return {'sources': [{'id': 'S1', 'role': role, 'excerpt': 'Official source material. ' * 10,
                             'organization': 'Official tourism', 'url': 'https://www.japan.travel/en/guide/',
                             'retrieved_at': '2026-10-20T00:00:00Z'}], 'errors': [], 'original_news_fetched': False}

    def report(self):
        return json.loads((self.articles / f'run-{g.TODAY}.json').read_text())

    def test_no_sources_never_reserves_or_calls_ai(self):
        with patch.object(g, 'collect_evidence', return_value={'sources': [], 'errors': []}), patch.object(g, 'reserve_request') as reserve:
            g.main()
        self.ai.assert_not_called(); reserve.assert_not_called()
        self.assertEqual(self.report()['status'], 'skipped_insufficient_evidence')
        self.assertFalse(g.LEDGER_FILE.exists())

    def test_country_context_alone_is_not_enough(self):
        with patch.object(g, 'collect_evidence', return_value=self.evidence('country_context')):
            g.main()
        self.ai.assert_not_called()
        self.assertEqual(self.report()['status'], 'skipped_insufficient_evidence')

    def test_short_or_malformed_source_cannot_open_gate(self):
        self.assertEqual(g.usable_sources({'sources': [None, {}, {'role': 'topic_candidate', 'excerpt': 'too short'}]}), [])
        self.assertEqual(g.usable_sources({'sources': None}), [])
        source = self.evidence()['sources'][0]
        source['url'] = 'https://unapproved.example/guide'
        self.assertEqual(g.usable_sources({'sources': [source]}), [])

    def test_source_lookups_are_bounded(self):
        with patch.object(g, 'collect_evidence', return_value=self.evidence('country_context')) as lookup:
            g.main()
        self.assertEqual(lookup.call_count, g.MAX_EVIDENCE_CANDIDATES)
        self.assertEqual(len(self.report()['source_attempts']), 3)
        self.ai.assert_not_called()

    def test_second_candidate_can_produce_one_held_draft(self):
        with patch.object(g, 'collect_evidence', side_effect=[self.evidence('country_context'), self.evidence()]):
            g.main()
        self.ai.assert_called_once()
        report = self.report()
        self.assertEqual(report['status'], 'generated')
        self.assertTrue(report['publication_hold'])
        self.assertEqual(report['verification_status'], 'insufficient_evidence')
        self.assertEqual(len(report['source_attempts']), 2)
        self.assertEqual(len(json.loads(g.LEDGER_FILE.read_text())), 1)
        self.assertIn('publication_hold: true', (self.articles / report['draft_file']).read_text())

    def test_request_limit_does_not_call_ai(self):
        with patch.object(g, 'collect_evidence', return_value=self.evidence()), patch.object(g, 'reserve_request', return_value=None):
            g.main()
        self.ai.assert_not_called()
        self.assertEqual(self.report()['status'], 'skipped_request_limit')

    def test_oversized_prompt_does_not_reserve(self):
        with patch.object(g, 'collect_evidence', return_value=self.evidence()), patch.object(g, 'create_prompt', return_value='x' * (g.MAX_INPUT_CHARS + 1)), patch.object(g, 'reserve_request') as reserve:
            g.main()
        reserve.assert_not_called(); self.ai.assert_not_called()
        self.assertEqual(self.report()['status'], 'skipped_input_limit')

    def test_exception_report_excludes_sensitive_error_body(self):
        with patch.object(g, 'read_latest_topics', side_effect=RuntimeError('private-provider-details')):
            with self.assertRaises(RuntimeError): g.main()
        report = self.report()
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['error_type'], 'RuntimeError')
        self.assertNotIn('private-provider-details', json.dumps(report))
        self.ai.assert_not_called()

    def test_provider_error_body_is_not_logged(self):
        topic = {'country': '일본', 'title': 'test', 'source': 'RSS',
                 'url': 'https://example.com/', 'description': 'metadata'}
        error = urllib.error.HTTPError('https://api.openai.com/v1/responses', 401,
                                      'Unauthorized', {}, io.BytesIO(b'private-provider-details'))
        with patch.object(g.urllib.request, 'urlopen', side_effect=error):
            with self.assertRaises(RuntimeError) as caught:
                self.real_call_openai(topic)
        self.assertIn('HTTP 401', str(caught.exception))
        self.assertNotIn('private-provider-details', str(caught.exception))

    def test_no_new_topic_has_a_distinct_report(self):
        with patch.object(g, 'read_latest_topics', return_value=([], 'test')):
            g.main()
        self.ai.assert_not_called()
        self.assertEqual(self.report()['status'], 'skipped_no_new_topics')


if __name__ == '__main__':
    unittest.main()
