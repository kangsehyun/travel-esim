import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import content_delivery as delivery


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.date = '2026-10-21'

    def test_backup_only_generates_when_no_daily_records(self):
        self.assertTrue(delivery.should_generate(self.date, self.root))
        delivery.save(self.root / f'run-{self.date}.json', {'status': 'failed'})
        self.assertFalse(delivery.should_generate(self.date, self.root))

    def test_paid_reservation_survives_missing_report(self):
        delivery.save(self.root / 'generation_ledger.json', [{'date': self.date}])
        self.assertFalse(delivery.should_generate(self.date, self.root))

    def test_corrupt_records_fail_closed(self):
        (self.root / 'generation_ledger.json').write_text('bad json')
        with self.assertRaises(ValueError):
            delivery.should_generate(self.date, self.root)

    def test_old_drafts_do_not_prevent_new_day(self):
        (self.root / '2026-10-20-old.md').write_text('old')
        self.assertTrue(delivery.should_generate(self.date, self.root))

    def test_early_failure_is_recorded_without_overwriting_generation(self):
        delivery.record_failure(self.date, self.root)
        self.assertEqual(delivery.read(self.root / f'run-{self.date}.json', {})['status'], 'failed')
        delivery.save(self.root / f'run-{self.date}.json', {'status': 'generated'})
        delivery.record_failure(self.date, self.root)
        self.assertEqual(delivery.read(self.root / f'run-{self.date}.json', {})['status'], 'generated')

    def test_actual_draft_wins_over_later_skip(self):
        delivery.save(self.root / f'run-{self.date}.json', {'status': 'skipped_no_new_topics'})
        (self.root / f'{self.date}-test.md').write_text('draft')
        text, _ = delivery.message(self.date, self.root)
        self.assertIn('초안 생성 완료', text)
        self.assertIn('공개 보류', text)
        self.assertIn('근거 검토 기록이 없습니다', text)

    def test_generated_report_without_draft_is_not_success(self):
        delivery.save(self.root / f'run-{self.date}.json', {'status': 'generated'})
        text, _ = delivery.message(self.date, self.root)
        self.assertNotIn('초안 생성 완료', text)

    @patch.dict('os.environ', {'TELEGRAM_BOT_TOKEN': 'test-token', 'TELEGRAM_CHAT_ID': '123'})
    def test_send_once_to_verified_private_chat(self):
        with patch.object(delivery, 'telegram', side_effect=[{'id': 123, 'type': 'private'}, {}]) as api:
            delivery.notify(self.date, self.root)
            delivery.notify(self.date, self.root)
        self.assertEqual(api.call_count, 2)
        self.assertEqual(api.call_args_list[1].args[0], 'sendMessage')

    @patch.dict('os.environ', {'TELEGRAM_BOT_TOKEN': 'test-token', 'TELEGRAM_CHAT_ID': '123'})
    def test_wrong_chat_is_never_sent(self):
        with patch.object(delivery, 'telegram', return_value={'id': 456, 'type': 'private'}) as api:
            with self.assertRaises(ValueError):
                delivery.notify(self.date, self.root)
        self.assertEqual(api.call_count, 1)

    @patch.dict('os.environ', {'TELEGRAM_BOT_TOKEN': 'test-token', 'TELEGRAM_CHAT_ID': '123'})
    def test_ambiguous_timeout_does_not_repeat_message(self):
        with patch.object(delivery, 'telegram', side_effect=[{'id': 123, 'type': 'private'}, TimeoutError]) as api:
            with self.assertRaises(TimeoutError):
                delivery.notify(self.date, self.root)
            delivery.notify(self.date, self.root)
        self.assertEqual(api.call_count, 2)
        self.assertEqual(delivery.read(self.root / f'notification-{self.date}.json', {})['status'], 'delivery_unknown')

    @patch.dict('os.environ', {'TELEGRAM_BOT_TOKEN': '', 'TELEGRAM_CHAT_ID': ''})
    def test_missing_secrets_do_not_send(self):
        with patch.object(delivery, 'telegram') as api:
            delivery.notify(self.date, self.root)
        api.assert_not_called()
