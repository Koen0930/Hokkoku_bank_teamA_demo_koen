from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import date, time


Mode = Literal["auto", "apply", "qa"]
ApplyMode = Literal["draft", "immediate"]


class SessionCreateRequest(BaseModel):
    title: Optional[str] = None
    seed_constraints_id: Optional[str] = None


class SessionCreateResponse(BaseModel):
    session_id: str


class ValidationErrorItem(BaseModel):
    path: str
    message: str


class ValidationResult(BaseModel):
    ok: bool
    errors: List[ValidationErrorItem] = []


class JsonPatchOp(BaseModel):
    op: Literal["add", "remove", "replace"]
    path: str
    value: Optional[Any] = None


class DiffSummary(BaseModel):
    changed_paths: List[str] = []
    highlights: Dict[str, str] = {}
    estimated_impact: Optional[str] = None


class ChatMessageRequest(BaseModel):
    content: str
    mode: Optional[Mode] = "auto"
    apply_mode: Optional[ApplyMode] = "draft"


class ChatMessageResponseQA(BaseModel):
    message_id: str
    intent: Literal["qa"]
    confidence: float
    assistant_text: str


class ChatMessageResponseApply(BaseModel):
    message_id: str
    intent: Literal["apply"]
    confidence: float
    assistant_text: str
    json_patch: Optional[List[JsonPatchOp]] = None
    full_json: Optional[Dict[str, Any]] = None
    validation: ValidationResult
    diff_summary: Optional[DiffSummary] = None
    draft_constraints: Optional[Dict[str, Any]] = None


class ConstraintsValidateRequest(BaseModel):
    constraints_json: Dict[str, Any]


class ConstraintsValidateResponse(BaseModel):
    ok: bool
    errors: List[ValidationErrorItem] = []
    normalized_json: Optional[Dict[str, Any]] = None


class ConstraintsApplyRequest(BaseModel):
    session_id: Optional[str] = None
    constraints_json: Dict[str, Any]
    apply_mode: ApplyMode = "draft"
    comment: Optional[str] = None


class ConstraintsApplyResponse(BaseModel):
    version_id: str
    applied_at: str


class Shift(BaseModel):
    id: Optional[int] = None
    employee_id: int
    date: date
    start_time: time
    end_time: time
    break_minutes: int = 60


class ShiftUpdatePair(BaseModel):
    before: Shift
    after: Shift


class ChangeDelta(BaseModel):
    kind: Literal["replace", "swap", "slide"]
    before: Optional[Shift] = None
    after: Optional[Shift] = None


class ChangeSet(BaseModel):
    id: str
    created_at: str
    rule: Dict[str, Any]
    deltas: List[ChangeDelta] = []
    score: int = 0
    week_start: str
    week_end: str
    schedule_version: int


class SchedulePreviewResponse(BaseModel):
    week_start: date
    week_end: date
    shifts: List[Shift]
    added: List[Shift]
    removed: List[Shift]
    updated: List[ShiftUpdatePair]
    change_set: ChangeSet
