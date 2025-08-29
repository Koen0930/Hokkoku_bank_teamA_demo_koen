# Deployment (Verification Environment)

## Real LLM via Public Tunnel (recommended for quick verification)
- Run FastAPI locally on Devin VM and expose it with a secure HTTPS tunnel.
- Single environment only: Real LLM mode (no Mock).
- UI is served at `/`, APIs under `/api/*`, and `/api/config` reports mode.

### Prerequisites
- OPENAI_API_KEY must be present in the VM environment.
- Python dependencies installed in `hokkoku_backend`.

### Start backend (Real mode)
```
cd hokkoku_backend
python -m pip install -U pip
python -m pip install -e .
export MOCK_OPENAI=false
export OPENAI_MODEL=gpt-4o-mini
export CORS_ALLOW_ORIGINS="*"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

### Expose with Cloudflare quick tunnel
```
sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared tunnel --url http://localhost:8002
```
- The command prints an HTTPS URL like `https://xxxxx.trycloudflare.com`. Use this URL in the browser.

### Verify end-to-end
- Open the root page and confirm it shows Real mode using `/api/config`.
- Create a session, send Q&A prompts (answers should vary), request an Apply suggestion, validate, and apply (admin).
- Curl examples:
```
curl -sSf https://<URL>/api/config
SID=$(curl -sSf -X POST https://<URL>/api/llm/sessions -H "Content-Type: application/json" -d '{"title":"demo"}' | jq -r .session_id)
curl -sSf -X POST https://<URL>/api/llm/sessions/$SID/messages -H "Content-Type: application/json" -d '{"content":"これは何をしますか？","mode":"qa"}'
curl -sSf -X POST https://<URL>/api/llm/sessions/$SID/messages -H "Content-Type: application/json" -d '{"content":"週末の最小人員を+1にして","mode":"apply"}'
curl -sSf -X POST https://<URL>/api/constraints/validate -H "Content-Type: application/json" -d '{"constraints_json":{"min_staff_weekend":2}}'
curl -sSf -X POST https://<URL>/api/constraints/apply -H "Content-Type: application/json" -H "X-Role: admin" -d '{"constraints_json":{"min_staff_weekend":2},"apply_mode":"immediate"}'
```

## Notes
- Do not expose API keys; keep OPENAI_API_KEY only in VM env.
- Managed hosting (Render/Railway) is optional for stable URLs and secret management, but not required for verification.
