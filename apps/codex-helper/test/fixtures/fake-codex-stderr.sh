#!/usr/bin/env bash
# Emulates `codex login`: prints the OAuth URL to STDERR (as the real codex CLI does), stdout stays empty.
echo "Starting local login server on http://localhost:1455." >&2
echo "If your browser did not open, navigate to this URL to authenticate:" >&2
echo "https://auth.openai.com/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&state=x" >&2
exit 0
