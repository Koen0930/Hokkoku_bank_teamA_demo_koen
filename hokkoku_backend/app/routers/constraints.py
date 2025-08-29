from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from ..schemas import ConstraintsValidateRequest, ConstraintsValidateResponse, ConstraintsApplyRequest, ConstraintsApplyResponse
from ..services.validation import validate_constraints
from .. import store

router = APIRouter(prefix="/api/constraints", tags=["constraints"])

@router.post("/validate", response_model=ConstraintsValidateResponse)
def validate(req: ConstraintsValidateRequest):
    ok, errors, normalized = validate_constraints(req.constraints_json)
    return ConstraintsValidateResponse(ok=ok, errors=errors, normalized_json=normalized)

@router.post("/apply", response_model=ConstraintsApplyResponse)
def apply(req: ConstraintsApplyRequest, x_role: str | None = Header(default=None, alias="X-Role")):
    if req.apply_mode == "immediate" and x_role != "admin":
        raise HTTPException(status_code=403, detail="immediate apply requires admin")
    ok, errors, normalized = validate_constraints(req.constraints_json)
    if not ok or not normalized:
        raise HTTPException(status_code=400, detail={"errors": [e.dict() for e in errors]})
    store.current_constraints = normalized
    vid = store.add_version(normalized, req.apply_mode, applied_by=x_role or "user")
    store.add_audit(actor=x_role or "user", action="constraints.apply", meta={"version_id": vid, "mode": req.apply_mode})
    return ConstraintsApplyResponse(version_id=vid, applied_at=store.now_iso())

@router.websocket("/ws/optimization")
async def ws_optimization(websocket: WebSocket):
    await websocket.accept()
    try:
        await websocket.send_json({"type": "info", "message": "Optimization WS stub connected"})
        await websocket.close(code=1000)
    except WebSocketDisconnect:
        return
