import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import source_evidence as evidence, content_delivery as delivery
from tests import test_generation_gate as gate
from scripts import generate_articles as g


class OfficialGuideTests(unittest.TestCase):
    setUp = gate.GenerationGateTests.setUp
    evidence = gate.GenerationGateTests.evidence
    report = gate.GenerationGateTests.report

    def test_missing_news_sources_selects_real_guide(self):
        guide = evidence.official_guide_topics()[0]
        with patch.object(g, 'official_guide_topics', return_value=[guide]), patch('scripts.generate_articles.collect_evidence', return_value={'sources': [], 'errors': []}), patch('scripts.generate_articles.collect_guide_evidence', return_value=self.evidence('device_guidance')):
            g.main()
        self.ai.assert_called_once()
        self.assertEqual(self.report()['selection_mode'], 'official_guide')
        self.assertTrue(self.report()['publication_hold'])

    def test_no_news_still_uses_guide(self):
        from scripts import generate_articles as g
        guide = evidence.official_guide_topics()[1]
        with patch.object(g, 'read_latest_topics', return_value=([], 'today')), patch.object(g, 'official_guide_topics', return_value=[guide]), patch.object(g, 'collect_guide_evidence', return_value=self.evidence('device_guidance')):
            g.main()
        self.ai.assert_called_once()

    def test_exhausted_device_guides_use_new_destination_detail(self):
        guide = {'country': '일본', 'title': '일본 여행 준비: Airport Access', 'source': 'JNTO',
                 'url': 'https://www.japan.travel/en/plan/airport-access/',
                 'selection_mode': 'official_destination_guide', 'description': 'official guide'}
        with patch.object(g, 'read_latest_topics', return_value=([], 'today')), patch.object(g, 'destination_guide_topics', return_value=[guide]), patch.object(g, 'collect_destination_evidence', return_value=self.evidence()) as lookup:
            g.main()
        self.ai.assert_called_once(); lookup.assert_called_once()
        self.assertEqual(self.report()['selection_mode'], 'official_destination_guide')

    def test_used_guide_is_not_rewritten(self):
        from scripts import generate_articles as g
        guide = evidence.official_guide_topics()[0]
        history = [{'url': g.normalized_url(guide['url']), 'title': g.normalized_title(guide['title'])}]
        g.HISTORY_FILE.write_text(__import__('json').dumps(history))
        with patch.object(g, 'read_latest_topics', return_value=([], 'today')), patch.object(g, 'official_guide_topics', return_value=[guide]), patch.object(g, 'collect_guide_evidence') as lookup:
            g.main()
        lookup.assert_not_called(); self.ai.assert_not_called()


class GuideSourceTests(unittest.TestCase):
    def test_unlisted_url_never_fetched(self):
        guide = {**evidence.official_guide_topics()[0], 'url': 'https://support.apple.com/en-us/arbitrary'}
        with patch.object(evidence, 'fetch_page') as fetch:
            with self.assertRaises(ValueError): evidence.collect_guide_evidence(guide)
        fetch.assert_not_called()

    def test_discovery_uses_only_relevant_same_host_detail_links(self):
        page = {'url': 'https://www.japan.travel/en/plan/', 'link_base': 'https://www.japan.travel/en/', 'links': [
            ('https://evil.example/airport', 'Airport Access'),
            ('plan/airport-access/', 'Airport Access'),
            ('/en/plan/airport-access/#map', 'Airport Access'),
            ('/en/terms/', 'Terms of use'),
            ('/en/plan/airport-access/?tracking=x', 'Airport Access')]}
        with patch.object(evidence, 'fetch_page', return_value=page):
            rows = evidence.destination_guide_topics('일본')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['url'], 'https://www.japan.travel/en/plan/airport-access/')

    def test_read_failure_stays_insufficient(self):
        with patch.object(evidence, 'fetch_page', side_effect=TimeoutError):
            self.assertEqual(evidence.collect_guide_evidence(evidence.official_guide_topics()[0])['sources'], [])

    def test_migration_retry_never_bypasses_paid_limit_or_repeats(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); date = '2026-10-21'
            path = root / f'run-{date}.json'
            delivery.save(path, {'status': 'skipped_insufficient_evidence'})
            self.assertTrue(delivery.should_generate(date, root))
            delivery.save(root / 'generation_ledger.json', [{'date': date}])
            self.assertFalse(delivery.should_generate(date, root))
            delivery.save(root / 'generation_ledger.json', [])
            delivery.save(path, {'status': 'skipped_insufficient_evidence', 'fallback_revision': 1})
            self.assertFalse(delivery.should_generate(date, root))
