import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

g = load('generate_articles')
c = load('collect_topics')

class PipelineTests(unittest.TestCase):
    def test_country_classification(self):
        self.assertEqual(c.classify_country('Taiwan eSIM travel'), '대만')
        self.assertEqual(c.classify_country('eSIM travel guide'), '공통')

    def test_same_story_and_tracking_links(self):
        history = [{'url': 'https://example.com/story', 'title': g.normalized_title('1. 일본 여행 준비 안내 - A신문')}]
        self.assertTrue(g.is_duplicate({'url': 'https://example.com/story?utm_source=x', 'title': '다른 제목'}, history))
        self.assertTrue(g.is_duplicate({'url': 'https://other.example/story', 'title': '5. 일본 여행 준비 안내 - B신문'}, history))
        self.assertFalse(g.is_duplicate({'url': 'https://other.example/new', 'title': '태국 방콕 공항에서 시내까지 가는 교통 수단'}, history))

    def test_daily_and_monthly_reservations(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(g, 'LEDGER_FILE', Path(folder) / 'ledger.json'):
            self.assertIsNotNone(g.reserve_request())
            self.assertIsNone(g.reserve_request())
            g.write_json(g.LEDGER_FILE, [{'date': g.TODAY[:7] + '-01'}] * 31)
            self.assertIsNone(g.reserve_request())

    def test_corrupt_history_stops_generation(self):
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / 'record.json'
            f.write_text('{broken')
            with self.assertRaises(RuntimeError):
                g.read_json(f, [])
            with patch.object(g, 'ARTICLES_DIR', Path(folder)):
                (Path(folder) / 'used_topics.json').write_text('{broken')
                with self.assertRaises(RuntimeError):
                    g.load_used_topics()

    def test_stale_topics_rejected(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(g, 'TOPICS_DIR', Path(folder)):
            (Path(folder) / 'topics-2000-01-01.md').write_text('old')
            with self.assertRaises(RuntimeError):
                g.read_latest_topics()

    def test_saved_article_is_unverified_draft(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(g, 'ARTICLES_DIR', Path(folder)):
            topic = {'title': 'test', 'url': 'https://example.com', 'country': '공통'}
            article = {'title': 'test', 'slug': 'test', 'meta_description': 'test', 'content': 'test', 'internal_links': [{'url': 'https://evil.example/', 'anchor': 'bad'}]}
            text = g.save_article(topic, article).read_text()
            self.assertIn('publication_hold: true', text)
            self.assertIn('verification_status: "insufficient_evidence"', text)
            self.assertNotIn('evil.example', text)

    def test_private_sources_excluded(self):
        exclusions = (ROOT / '.assetsignore').read_text().splitlines()
        for directory in ['drafts/', 'scripts/', 'tests/', '.github/', 'src/']:
            self.assertIn(directory, exclusions)

if __name__ == '__main__':
    unittest.main()
