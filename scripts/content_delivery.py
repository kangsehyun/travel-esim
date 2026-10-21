"""Scheduling guard and optional private Telegram status alerts (stdlib only)."""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import urllib.request

KST = timezone(timedelta(hours=9))
ARTICLES = Path('drafts/articles')


def today():
    return datetime.now(KST).strftime('%Y-%m-%d')


def read(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def should_generate(date, directory=ARTICLES):
    # No paid retries or overwriting a same-day outcome on backup schedules.
    if list(directory.glob(f'{date}-*.md')):
        return False
    ledger = read(directory / 'generation_ledger.json', [])
    if not isinstance(ledger, list):
        raise ValueError('Invalid ledger')
    if any(row.get('date') == date for row in ledger):
        return False
    report_path = directory / f'run-{date}.json'
    if report_path.exists():
        report = read(report_path, {})
        # One migration retry only: old source-only skips made no paid request.
        return (report.get('status') in {'skipped_insufficient_evidence', 'skipped_no_new_topics'}
                and report.get('fallback_revision', 0) == 0)
    return True



def record_failure(date, directory=ARTICLES):
    path = directory / f'run-{date}.json'
    if not path.exists():
        save(path, {'date': date, 'status': 'failed', 'error_type': 'WorkflowStepFailure',
                    'publication_hold': True, 'updated_at': datetime.now(timezone.utc).isoformat()})


def message(date, directory=ARTICLES, workflow_result='success'):
    report = read(directory / f'run-{date}.json', {})
    drafts = sorted(directory.glob(f'{date}-*.md'))
    status = report.get('status', 'not_recorded')
    labels = {
        'generated': '초안 생성 완료',
        'skipped_insufficient_evidence': '공식 자료 부족으로 생성 보류',
        'skipped_no_new_topics': '새로운 주제 없음',
        'skipped_input_limit': '입력 길이 한도로 생성 보류',
        'skipped_request_limit': 'API 호출 한도로 생성 보류',
        'failed': '자동 생성 실행 실패',
        'started': '실행 시작 기록만 있음 — 완료 확인 필요',
        'generating': '생성 시작 기록만 있음 — 완료 확인 필요',
        'not_recorded': '실행 상태 기록 없음 — 확인 필요',
    }
    # Actual drafts take precedence over a later attempt's skip/failure record.
    if drafts:
        status = 'generated'
    elif status == 'generated':
        status = 'not_recorded'
    lines = [f'여행심플 {date}', labels.get(status, '알 수 없는 상태 — 확인 필요')]
    if drafts:
        from urllib.parse import quote
        draft = drafts[0]
        lines += ['공개 보류 초안입니다. 사실 검토 후 수동 게시하세요.',
                  'https://github.com/kangsehyun/travel-esim/blob/main/drafts/articles/' + quote(draft.name)]
        if not draft.with_suffix('.review.json').exists():
            lines.append('근거 검토 기록이 없습니다.')
    if workflow_result != 'success':
        lines.append('워크플로 오류가 있습니다. 실행 기록을 확인하세요.')
    lines.append('https://github.com/kangsehyun/travel-esim/actions')
    text = '\n'.join(lines)
    return text, hashlib.sha256(text.encode()).hexdigest()


def telegram(method, token, payload):
    # Never log the URL, response, payload or exception: URLs contain the token.
    req = urllib.request.Request(f'https://api.telegram.org/bot{token}/{method}',
                                 data=json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.load(response)
    if result.get('ok') is not True:
        raise ValueError('Telegram request failed')
    return result.get('result', {})


def notify(date, directory=ARTICLES, workflow_result='success'):
    token, chat = os.getenv('TELEGRAM_BOT_TOKEN'), os.getenv('TELEGRAM_CHAT_ID')
    if not token or not chat:
        print('Telegram notification not configured; add both repository secrets.')
        return
    if not chat.isdecimal():
        raise ValueError('Use the numeric ID of your private bot chat')
    text, fingerprint = message(date, directory, workflow_result)
    state_path = directory / f'notification-{date}.json'
    state = read(state_path, {})
    if state.get('fingerprint') == fingerprint:
        print('Notification already attempted; no automatic duplicate send.')
        return
    recipient = telegram('getChat', token, {'chat_id': chat})
    if recipient.get('type') != 'private' or str(recipient.get('id')) != chat:
        raise ValueError('Recipient must be the configured private bot chat')
    # A timeout is ambiguous; persist attempted state and require manual review,
    # rather than risking duplicate delivery on every backup run.
    state = {'date': date, 'fingerprint': fingerprint, 'status': 'attempted'}
    save(state_path, state)
    try:
        telegram('sendMessage', token, {'chat_id': chat, 'text': text,
                                      'link_preview_options': {'is_disabled': True}})
    except Exception:
        state['status'] = 'delivery_unknown'
        save(state_path, state)
        raise
    state['status'] = 'sent'
    save(state_path, state)
    print('Telegram notification sent.')


def main():
    import sys
    date = today()
    action = sys.argv[1]
    if action == 'gate':
        value = 'true' if should_generate(date) else 'false'
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as out:
            out.write(f'generate={value}\n')
        print('Generation needed: ' + value)
    elif action == 'failure':
        record_failure(date)
    elif action == 'notify':
        notify(date, workflow_result=os.getenv('WORKFLOW_RESULT', 'success'))
    else:
        raise ValueError('Unknown action')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # urllib error strings can include a bot token. Only emit a fixed message.
        print('Content delivery step failed. Check configuration and run status; secrets were not logged.')
        raise SystemExit(1)
