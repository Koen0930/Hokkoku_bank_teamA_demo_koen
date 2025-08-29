from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .. import store
from ..services import adjustments as svc
from ..schemas import ChangeDelta, ChangeSet, SchedulePreviewResponse

router = APIRouter(prefix="/api/adjustments", tags=["adjustments"])

class PreviewRequest(BaseModel):
    rule: Dict[str, Any]
    week_start: Optional[str] = None

class ApplyRequest(BaseModel):
    change_set: ChangeSet

class RollbackRequest(BaseModel):
    change_set_id: str

class ShiftAdjustRequest(BaseModel):
    session_id: Optional[str] = None
    adjustment_rule: Dict[str, Any]
    apply_mode: str = "draft"  # draft, immediate

class ShiftAdjustResponse(BaseModel):
    success: bool
    adjustment_id: Optional[str] = None
    applied_at: Optional[str] = None
    changes: List[Dict[str, Any]] = []
    error_message: Optional[str] = None

@router.post("/preview", response_model=SchedulePreviewResponse)
def preview(req: PreviewRequest):
    rule = req.rule
    cs, preview = svc.generate_preview(rule, req.week_start)
    return preview

@router.post("/apply", response_model=Dict[str, Any])
def apply(req: ApplyRequest, x_role: str | None = Header(default=None, alias="X-Role")):
    if x_role != "admin":
        raise HTTPException(status_code=403, detail="immediate apply requires admin")
    result = svc.apply_changes(req.change_set)
    return result

@router.post("/rollback", response_model=Dict[str, Any])
def rollback(req: RollbackRequest, x_role: str | None = Header(default=None, alias="X-Role")):
    if x_role != "admin":
        raise HTTPException(status_code=403, detail="rollback requires admin")
    result = svc.rollback_changes(req.change_set_id)
    return result

@router.post("/shift-adjust", response_model=ShiftAdjustResponse)
def shift_adjust(req: ShiftAdjustRequest):
    """シフト調整の適用"""
    try:
        # プレビュー生成
        change_set, preview_data = svc.generate_preview(req.adjustment_rule, None)
        
        if req.apply_mode == "immediate":
            # 即座に適用
            result = svc.apply_changes(change_set)
            return ShiftAdjustResponse(
                success=True,
                adjustment_id=change_set.id,
                applied_at=store.now_iso(),
                changes=[delta.dict() for delta in change_set.deltas]
            )
        else:
            # ドラフトモード（プレビューのみ）
            return ShiftAdjustResponse(
                success=True,
                adjustment_id=change_set.id,
                applied_at=None,
                changes=[delta.dict() for delta in change_set.deltas]
            )
    except Exception as e:
        return ShiftAdjustResponse(
            success=False,
            error_message=str(e)
        )
