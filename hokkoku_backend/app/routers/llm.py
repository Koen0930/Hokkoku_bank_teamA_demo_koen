from fastapi import APIRouter, HTTPException, Path, WebSocket, WebSocketDisconnect
from typing import Dict, Any
from ..schemas import SessionCreateRequest, SessionCreateResponse, ChatMessageRequest, ChatMessageResponseQA, ChatMessageResponseApply
from .. import store
from ..services import intent as intent_service
from ..services import openai_client
from ..services.validation import validate_constraints
from ..services.diff import materialize, summarize_diff

router = APIRouter(prefix="/api/llm", tags=["llm"])

@router.post("/sessions", response_model=SessionCreateResponse)
def create_session(req: SessionCreateRequest):
    sid = store.create_session(req.title, req.seed_constraints_id)
    return SessionCreateResponse(session_id=sid)

@router.post("/sessions/{session_id}/messages")
def post_message(session_id: str = Path(...), req: ChatMessageRequest = None):
    if session_id not in store.sessions:
        store.sessions[session_id] = {
            "id": session_id,
            "title": f"Session {session_id[:6]}",
            "seed_constraints_id": None,
            "created_at": store.now_iso(),
            "retention_until": store.now_iso(),
        }
    ctx: Dict[str, Any] = {
        "session": store.sessions[session_id],
        "constraints": store.current_constraints
    }
    resolved_intent, confidence = intent_service.route(req.mode or "auto", req.content, ctx)
    if resolved_intent == "qa":
        text = openai_client.generate_qa(req.content, ctx)
        mid = store.save_message({
            "session_id": session_id,
            "role": "assistant",
            "mode": req.mode,
            "intent": "qa",
            "confidence": confidence,
            "assistant_text": text
        })
        return ChatMessageResponseQA(message_id=mid, intent="qa", confidence=confidence, assistant_text=text)
    attempt = 0
    last_errors = []
    assistant_text = ""
    draft_constraints = None
    diff = None
    json_patch = None
    full_json = None
    while attempt <= 2:
        attempt += 1
        out = openai_client.generate_apply(req.content, ctx)
        assistant_text = out.get("assistant_text", "")
        spec = out.get("json", {})
        if spec.get("type") == "patch":
            json_patch = spec.get("patch", [])
        if spec.get("type") == "full":
            full_json = spec.get("full", {})
        candidate = materialize(spec, store.current_constraints)
        ok, errors, normalized = validate_constraints(candidate)
        if ok:
            draft_constraints = normalized
            diff = summarize_diff(store.current_constraints, draft_constraints)
            break
        else:
            last_errors = errors
    validation = {"ok": diff is not None, "errors": [e.dict() for e in last_errors]}
    mid = store.save_message({
        "session_id": session_id,
        "role": "assistant",
        "mode": req.mode,
        "intent": "apply",
        "confidence": confidence,
        "assistant_text": assistant_text,
        "json_patch": json_patch,
        "full_json": full_json,
        "validation_ok": validation["ok"],
        "validation_errors": validation["errors"]
    })
    resp = ChatMessageResponseApply(
        message_id=mid,
        intent="apply",
        confidence=confidence,
        assistant_text=assistant_text,
        json_patch=json_patch,
        full_json=full_json,
        validation=validation,  # type: ignore
        diff_summary=diff,
        draft_constraints=draft_constraints
    )
    return resp

@router.websocket("/ws/llm/{session_id}")
async def ws_llm(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        await websocket.send_json({"type": "info", "message": "LLM WS stub connected", "session_id": session_id})
        await websocket.close(code=1000)
    except WebSocketDisconnect:
        return
