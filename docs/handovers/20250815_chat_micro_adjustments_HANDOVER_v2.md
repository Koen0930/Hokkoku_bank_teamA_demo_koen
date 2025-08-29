# 2025-08-15 Handover — Chat-based Micro-Adjustments (pair_not_together, no re-optimization)

Scope
- Implemented MVP for “chat-based micro-adjustments” limited to pair_not_together rule without full re-optimization.
- Two-pane UI: left = chat input; right = preview. User can Apply or Rollback.
- Backed by lightweight rule parsing, preview generation, and apply/rollback with audit logging.
- WebSocket channel broadcasts preview-ready and schedule-updated events.

What’s in this MVP
- Parse natural language like: 「従業員4と従業員7は同時に入れない」
- Generate a preview diff without running the optimizer again (simple replacement strategy).
- Apply change set to current schedule; rollback last application.
- WS push used for live updates (with reconnection handling on FE).

Backend Overview (FastAPI)
- Endpoints:
  - POST /api/chat/parse
    - Input: { text: string }
    - Output: normalized intent { type: "pair_not_together", employees: [idA, idB] }
  - POST /api/adjustments/preview
    - Input: normalized intent
    - Output: { preview: ChangeSetPreview, summary }
  - POST /api/adjustments/apply  [admin only]
    - Header: X-Role: admin
    - Applies ChangeSet, persists schedule, emits schedule_updated.
  - POST /api/adjustments/rollback  [admin only]
    - Reverts the last apply.
  - WS /ws/adjustments
    - Messages:
      - { type: "proposals_ready", payload: ... }
      - { type: "schedule_updated", payload: ... }

- Key modules/files:
  - app/routers/chat.py
  - app/routers/adjustments.py
  - app/routers/adjustments_ws.py
  - app/store.py  (in-memory schedule, pub/sub queues)
  - app/services/adjustments.py  (preview/apply core)
  - app/main.py  (router wiring, schedule sync on CRUD)

- Audit/logging:
  - Minimal SQLite DB (data.db) used for audit records in MVP. Can be expanded with more fields.

Frontend Overview (React + Vite)
- Component: src/components/MicroAdjustments.tsx
  - Two-pane layout with chat input and preview grid.
  - Buttons: 送信 (send), 適用 (apply), 元に戻す (rollback).
  - Auto-reconnect and cleanup for WS to mitigate Strict Mode double-invocation.
- Integrated into ShiftSchedule.tsx beneath the “シフト作成” feature.
- Diff rendering: preview grid shows proposed changes prior to applying.
- Known warning fixed: non-unique keys in headerTimeSlots by combining date and slot.

Proxy, Auth, and CORS
- Frontend calls relative paths: /api/* (HTTP) and /ws/* (WebSocket).
- Vite proxy (vite.config.ts) forwards to backend target and injects Authorization when Basic Auth creds are present in VITE_API_URL.
  - Injects header for both HTTP and WS (proxyReq / proxyReqWs).
  - Example env:
    - VITE_API_URL="https://user:password@backend-host.example.com"
  - If basic creds exist, the proxy strips them from target URL but sets Authorization: Basic base64(user:password).
- For external verification, we used tunneled URLs protected by temporary Basic Auth.
  - Note: These credentials are demo-only/ephemeral and not intended for production.

Environment variables and build
- Frontend:
  - VITE_API_URL (optional):
    - If omitted, proxy defaults to http://localhost:8002 in dev (via vite.config.ts).
    - If includes user:pass@host, Authorization header will be added by proxy for /api and /ws.
- Backend:
  - CORS_ALLOW_ORIGINS can be set to the public frontend URL when serving via tunnel.

Verification steps (used in this session)
1) Generate shifts (シフト作成 page) if none exist.
2) In 「チャット微調整」:
   - Enter: 「従業員4と従業員7は同時に入れない」
   - Click 送信 → Preview appears on the right.
3) Click 適用
   - Expect: backend responds 200; schedule updates; UI reflects applied changes.
4) Click 元に戻す to revert the last application if needed.

Public tunnel URLs used for user testing (temporary)
- Frontend:
  - https://chat-micro-adjustments-app-tunnel-pwuqtwwj.devinapps.com
  - Basic Auth: user / 3e4709fc5f039ce762730c7394de4d08
- Backend:
  - https://chat-micro-adjustments-app-tunnel-vrzvt4n5.devinapps.com
  - Basic Auth: user / 7c359196faf244efe22e720a1babecb5
- Note: These are ephemeral demo credentials, not for production use.

Known issues and considerations
- WebSocket connect/close churn can occur under React Strict Mode due to double-invocation; client guards and reconnect logic are in place. Does not block the main UX flow.
- RBAC is simplified: admin-only actions gated by X-Role: admin header. For production, integrate real auth/roles.
- Replacement strategy is heuristic; does not re-run the optimizer. Future work:
  - Better candidate selection when conflicts are dense
  - Swap/slide strategies when simple replacement fails
  - Expand rule coverage beyond pair_not_together
  - Enrich audit logging (durations, normalized text, actor, etc.)
  - Improve diff highlighting and empty states/validation UX

File reference highlights
- Backend routers wired in app.main; schedule updates publish over WS via store.publish_schedule_updated.
- Frontend MicroAdjustments composes API calls and WS subscription, with relative paths to work behind the proxy.

How to run locally (dev)
- Backend: poetry run uvicorn app.main:app --host 0.0.0.0 --port 8002
- Frontend: npm run dev (Vite dev server)
- Access: http://localhost:5173
- Ensure employees data exists; use existing upload flow if needed.

CI/PR status
- Implementation PR #31: green.
- This document will be submitted as a docs-only PR.

Contacts
- Requester: 坂本陽平 (@sakamoto0308)

Links
- Devin run: https://app.devin.ai/sessions/a6266ff13a194212b0522fdf7ae97993
