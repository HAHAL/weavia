#!/usr/bin/env python3
"""V1 HTTP smoke test: login -> conversation -> quote -> task -> credits.

No third-party dependencies. Run against the Compose stack or a test server:

  python3 scripts/v1-smoke.py --base-url http://127.0.0.1:8080
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid


def call(base, method, path, body=None, token=None, idem=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    if idem:
        req.add_header('Idempotency-Key', idem)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            payload = json.loads(raw)
        except ValueError:
            payload = raw
        return error.code, payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8080')
    parser.add_argument('--email', default='dev@weavia.local')
    parser.add_argument('--password', default='weavia-dev-2026')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')
    uid = uuid.uuid4().hex[:8]

    status, login = call(base, 'POST', '/api/auth/login', {
        'email': args.email, 'password': args.password,
        'deviceInfo': {'deviceName': 'v1-smoke', 'platform': 'server', 'appVersion': '0.1.0'},
    })
    if status != 200:
        print('login failed', status, login)
        return 1
    token = login['data']['accessToken']

    status, conv = call(base, 'POST', '/api/conversations', {'title': 'v1 smoke ' + uid, 'mode': 'image'}, token)
    if status != 200:
        print('conversation failed', status, conv)
        return 1
    conversation_id = conv['data']['id']

    status, _ = call(base, 'POST', f'/api/conversations/{conversation_id}/messages', {
        'content': '生成一张白底商品主图', 'clientMessageId': 'm-' + uid,
    }, token)
    if status != 200:
        return 1

    prompt = '生成一张白底商品主图'
    status, quote = call(base, 'POST', '/api/ai/quotes', {
        'conversationId': conversation_id, 'model': 'qwen-image-max', 'mode': 'text_to_image',
        'prompt': prompt, 'size': '1024x1024', 'numberOfImages': 1,
    }, token, 'quote-smoke-' + uid)
    if status != 200:
        print('quote failed', status, quote)
        return 1
    quote_id = quote['data']['id']
    print('quote credits', quote['data']['totalCredits'])

    status, task = call(base, 'POST', '/api/ai/tasks', {
        'conversationId': conversation_id, 'quoteId': quote_id, 'idempotencyKey': 'task-smoke-' + uid,
        'model': 'qwen-image-max', 'mode': 'text_to_image', 'prompt': prompt,
        'size': '1024x1024', 'numberOfImages': 1, 'outputFormat': 'png',
    }, token, 'task-smoke-' + uid)
    if status != 200:
        print('task failed', status, task)
        return 1
    task_id = task['data']['id']

    final = None
    for _ in range(30):
        time.sleep(1)
        _, got = call(base, 'GET', f'/api/ai/tasks/{task_id}', token=token)
        data = got.get('data', {})
        if data.get('status') in ('success', 'failed', 'cancelled'):
            final = data
            break
    if not final or final.get('status') != 'success':
        print('task did not succeed', final)
        return 1
    print('task success, outputs', len(final.get('outputs') or []))

    _, credits = call(base, 'GET', '/api/credits', token=token)
    print('credits available', credits['data']['available'], 'reserved', credits['data']['reserved'])
    _, ledger = call(base, 'GET', '/api/credits/transactions', token=token)
    print('ledger entries', len(ledger.get('data') or []))
    return 0


if __name__ == '__main__':
    sys.exit(main())
