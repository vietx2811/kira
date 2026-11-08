#!/usr/bin/env python3
"""Báo cho Orchestrator khi một thread khác nhắn tới nó.

Vì sao cần: `mcp__ccd_session_mgmt__send_message` tới session Orchestrator đang
idle hay trả "not delivered ... gave no sign of starting on it within 20s", và
tin đó không đánh thức Orchestrator. Script này không cần thread gửi hợp tác:
nó đọc phần mới ghi thêm của các transcript (`~/.claude/projects/*vixio*/*.jsonl`)
và in một dòng mỗi khi có lời gọi send_message nhắm vào session_id cho trước.
Chạy nó trong công cụ Monitor của Orchestrator: mỗi dòng in ra là một thông báo
đánh thức session.

Dùng: python3 -I scripts/watch-orchestrator-mail.py <orchestrator_session_id> [own_transcript_uuid]
Chỉ đọc file, không ghi, không gửi gì ra ngoài.
"""
import glob
import json
import os
import sys
import time

target = sys.argv[1]
own = sys.argv[2] if len(sys.argv) > 2 else ''
offsets = {}


def scan(initial):
    for root in glob.glob(os.path.expanduser('~/.claude/projects/*vixio*')):
        for path in glob.glob(os.path.join(root, '*.jsonl')):
            if own and own in path:
                continue
            size = os.path.getsize(path)
            start = offsets.get(path, size if initial else 0)
            offsets[path] = size
            if initial or size <= start:
                continue
            with open(path, 'rb') as fh:
                fh.seek(start)
                chunk = fh.read(size - start).decode('utf-8', 'replace')
            for line in chunk.splitlines():
                if target not in line or 'send_message' not in line:
                    continue
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                for block in (entry.get('message') or {}).get('content') or []:
                    if not isinstance(block, dict) or block.get('type') != 'tool_use':
                        continue
                    if 'send_message' not in block.get('name', ''):
                        continue
                    payload = block.get('input') or {}
                    if payload.get('session_id') != target:
                        continue
                    text = ' '.join(str(payload.get('message', '')).split())
                    print(f"MAIL from transcript {os.path.basename(path)[:8]}: {text[:240]}", flush=True)


scan(True)
while True:
    time.sleep(3)
    try:
        scan(False)
    except OSError:
        pass
