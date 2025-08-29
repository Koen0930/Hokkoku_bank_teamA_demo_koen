from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any, Union
import pandas as pd
import io
from datetime import datetime, date, time, timedelta
from ortools.sat.python import cp_model
import json
import hashlib
import openai
import logging
import httpx

app = FastAPI(title="Hokkoku Bank Shift Tool API", version="1.0.0")

from .config import CORS_ALLOW_ORIGINS, MOCK_OPENAI
origins = [o.strip() for o in (CORS_ALLOW_ORIGINS or "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
from .routers import llm as llm_router
from .routers import constraints as constraints_router
from .routers import chat as chat_router
from .routers import adjustments as adjustments_router
from .routers import adjustments_ws as adjustments_ws_router
from . import store

app.include_router(llm_router.router)
app.include_router(constraints_router.router)
app.include_router(chat_router.router)
app.include_router(adjustments_router.router)
app.include_router(adjustments_ws_router.router)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


logger = logging.getLogger("backend")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s backend - %(message)s")

def _slot_to_jp(slot: Optional[str]) -> str:
    if slot == "early":
        return "早番(08-16)"
    if slot == "late":
        return "遅番(16-24)"
    if slot == "night":
        return "夜勤(00-08)"
    return ""

def _intent_to_jp(i: Optional[str]) -> str:
    if i == "absence":
        return "欠勤"
    if i == "change_time":
        return "時間帯変更"
    if i == "swap":
        return "入れ替え"
    if i == "add_shift":
        return "追加"
    if i == "cancel_request":
        return "取消"
    return i or ""

def _build_approval_message(req: "ShiftChangeRequest") -> str:
    # format applicant name
    # applicant name
    name = req.employee_name
    if (not name) and req.employee_id is not None:
        for e in employees_db:
            if e.id == req.employee_id:
                name = e.name
                break
    name_disp = f"{name}さんの" if name else "申請の"
    # format date as M/D (no year)
    if isinstance(req.date, date):
        md = f"{req.date.month}/{req.date.day}"
    else:
        ds = str(req.date)
        try:
            y, m, d = ds.split("-")
            md = f"{int(m)}/{int(d)}"
        except Exception:
            md = ds
    return f"{name_disp}{md}の申請を承認しました"

def _build_rejection_message(req: "ShiftChangeRequest") -> str:
    # applicant name
    name = req.employee_name
    if (not name) and req.employee_id is not None:
        for e in employees_db:
            if e.id == req.employee_id:
                name = e.name
                break
    name_disp = f"{name}さんの" if name else "申請の"
    # format date as M/D (no year)
    if isinstance(req.date, date):
        md = f"{req.date.month}/{req.date.day}"
    else:
        ds = str(req.date)
        try:
            y, m, d = ds.split("-")
            md = f"{int(m)}/{int(d)}"
        except Exception:
            md = ds
    return f"{name_disp}{md}の申請は却下されました"

class Employee(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: str
    skill_level: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class EmployeeResponse(BaseModel):
    employees: List[Employee]
    total: int

class ImportResponse(BaseModel):
    message: str
    imported_count: int
    employees: List[Employee]

class Shift(BaseModel):
    id: Optional[int] = None
    employee_id: int
    date: date
    start_time: time
    end_time: time
    break_minutes: int = 60
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Constraint(BaseModel):
    id: Optional[int] = None
    employee_id: Optional[int] = None
    constraint_type: str
    constraint_value: Dict[str, Any]
    priority: int = 1
    created_at: Optional[datetime] = None

class ShiftGenerationRequest(BaseModel):
    start_date: date
    end_date: date
    employee_ids: List[int]
    constraints: Optional[List[Constraint]] = []
    shift_types: Optional[List[Dict[str, Any]]] = None

class ShiftGenerationResponse(BaseModel):
    message: str
    shifts: List[Shift]
    warnings: List[str]
    structured_warnings: Optional[List[dict]] = []
    optimization_status: str

class ShiftValidationWarning(BaseModel):
    type: str
    message: str
    employee_id: Optional[int] = None
    date: Optional[str] = None
    affected_employees: Optional[List[int]] = None
    affected_dates: Optional[List[str]] = None

class LLMAnalysisRequest(BaseModel):
    error_content: str
    optimization_status: str
    warnings: List[str]

class LLMAnalysisResponse(BaseModel):
    analysis: str
    success: bool
    error: Optional[str] = None

class ShiftChangeRequest(BaseModel):
    id: Optional[int] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    type: str  # 'absence' | 'change_time' | 'swap' | 'add_shift' | 'cancel_request'
    date: date
    from_slot: Optional[str] = None  # 'early' | 'late' | 'night'
    to_slot: Optional[str] = None
    target_employee_id: Optional[int] = None
    target_employee_name: Optional[str] = None
    reason: Optional[str] = None
    status: str = "pending"  # 'pending' | 'approved' | 'rejected'
    requested_via: Optional[str] = None  # 'line' | 'web'
    line_user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Preview snapshot at request creation (pre-approval state)
    snapshot_week_start: Optional[date] = None
    snapshot_week_end: Optional[date] = None
    snapshot_shifts: Optional[List[Shift]] = None

class ShiftChangeRequestResponse(BaseModel):
    requests: List[ShiftChangeRequest]
    total: int

class ShiftUpdatePair(BaseModel):
    before: Shift
    after: Shift

class ReplacementCandidate(BaseModel):
    employee_id: int
    name: Optional[str] = None
    score: float
    reasons: List[str] = []


class SuggestionItem(BaseModel):
    date: date
    start_time: time
    end_time: time
    original_employee_id: Optional[int] = None
    candidates: List[ReplacementCandidate] = []


class ShiftPreviewResponse(BaseModel):
    week_start: date
    week_end: date
    shifts: List[Shift]
    added: List[Shift]
    removed: List[Shift]
    updated: List[ShiftUpdatePair]
    suggestions: List[SuggestionItem] = []

default_employees_data = [
    {"id": 1, "name": "田中太郎", "role": "manager", "skill_level": 5, "email": "tanaka@example.com"},
    {"id": 2, "name": "佐藤花子", "role": "manager", "skill_level": 4, "email": "sato@example.com"},
    {"id": 3, "name": "鈴木一郎", "role": "manager", "skill_level": 5, "email": "suzuki@example.com"},
    {"id": 4, "name": "高橋美咲", "role": "manager", "skill_level": 4, "email": "takahashi@example.com"},
    {"id": 5, "name": "伊藤健太", "role": "manager", "skill_level": 5, "email": "ito@example.com"},
    {"id": 6, "name": "渡辺由美", "role": "manager", "skill_level": 4, "email": "watanabe@example.com"},
    {"id": 7, "name": "山本直樹", "role": "manager", "skill_level": 5, "email": "yamamoto@example.com"},
    {"id": 8, "name": "中村麻衣", "role": "senior_staff", "skill_level": 4, "email": "nakamura@example.com"},
    {"id": 9, "name": "小林正人", "role": "senior_staff", "skill_level": 3, "email": "kobayashi@example.com"},
    {"id": 10, "name": "加藤美香", "role": "senior_staff", "skill_level": 4, "email": "kato@example.com"},
    {"id": 11, "name": "松本健一", "role": "senior_staff", "skill_level": 3, "email": "matsumoto@example.com"},
    {"id": 12, "name": "井上美穂", "role": "senior_staff", "skill_level": 4, "email": "inoue@example.com"},
    {"id": 13, "name": "木村拓也", "role": "senior_staff", "skill_level": 3, "email": "kimura@example.com"},
    {"id": 14, "name": "斉藤恵子", "role": "senior_staff", "skill_level": 4, "email": "saito@example.com"},
    {"id": 15, "name": "森田直人", "role": "senior_staff", "skill_level": 3, "email": "morita@example.com"},
    {"id": 16, "name": "橋本雅子", "role": "senior_staff", "skill_level": 4, "email": "hashimoto@example.com"},
    {"id": 17, "name": "清水康夫", "role": "senior_staff", "skill_level": 3, "email": "shimizu@example.com"},
    {"id": 18, "name": "藤田真理", "role": "senior_staff", "skill_level": 4, "email": "fujita@example.com"},
    {"id": 19, "name": "吉田和彦", "role": "general_staff", "skill_level": 3, "email": "yoshida@example.com"},
    {"id": 20, "name": "石川美奈", "role": "general_staff", "skill_level": 2, "email": "ishikawa@example.com"},
    {"id": 21, "name": "村上健二", "role": "general_staff", "skill_level": 3, "email": "murakami@example.com"},
    {"id": 22, "name": "岡田真由美", "role": "general_staff", "skill_level": 2, "email": "okada@example.com"},
    {"id": 23, "name": "前田光一", "role": "general_staff", "skill_level": 3, "email": "maeda@example.com"},
    {"id": 24, "name": "長谷川愛", "role": "general_staff", "skill_level": 2, "email": "hasegawa@example.com"},
    {"id": 25, "name": "野村雄介", "role": "general_staff", "skill_level": 3, "email": "nomura@example.com"},
    {"id": 26, "name": "青木さくら", "role": "general_staff", "skill_level": 2, "email": "aoki@example.com"},
    {"id": 27, "name": "西田博之", "role": "general_staff", "skill_level": 3, "email": "nishida@example.com"},
    {"id": 28, "name": "東山美樹", "role": "general_staff", "skill_level": 2, "email": "higashiyama@example.com"},
    {"id": 29, "name": "南原拓海", "role": "general_staff", "skill_level": 3, "email": "minamihara@example.com"},
    {"id": 30, "name": "北川優子", "role": "general_staff", "skill_level": 2, "email": "kitagawa@example.com"}
]

employees_db: List[Employee] = [
    Employee(**emp_data, created_at=datetime.now(), updated_at=datetime.now()) 
    for emp_data in default_employees_data
]

# store.pyのキャッシュを初期化
store.set_employees_cache([{"id": e.id, "name": e.name} for e in employees_db])
shifts_db: List[Shift] = []

shift_cache = {}

def generate_cache_key(request: ShiftGenerationRequest, employees: List[Employee]) -> str:
    """シフト生成リクエストのキャッシュキーを生成"""
    employee_data = sorted([(e.id, e.name, e.role, e.skill_level) for e in employees])
    constraints_list: List[Dict[str, Any]] = []
    if request.constraints:
        for c in request.constraints:
            if isinstance(c, dict):
                constraints_list.append(c)
            else:
                try:
                    constraints_list.append(c.dict())
                except Exception:
                    constraints_list.append({"_raw": str(c)})
    cache_data = {
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "employee_ids": sorted(request.employee_ids),
        "employees": employee_data,
        "constraints": constraints_list,
    }
    cache_string = json.dumps(cache_data, sort_keys=True)
    return hashlib.md5(cache_string.encode()).hexdigest()

def is_cache_valid(cache_key: str, max_age_minutes: int = 60) -> bool:
    """キャッシュの有効性をチェック"""
    if cache_key not in shift_cache:
        return False
    
    cached_time = shift_cache[cache_key].get("timestamp")
    if not cached_time:
        return False
        
    age_minutes = (datetime.now() - cached_time).total_seconds() / 60
    return age_minutes < max_age_minutes
constraints_db: List[Constraint] = []
shift_change_requests_db: List[ShiftChangeRequest] = []

SLOT_TO_TIME = {
    "early": (time(8, 0), time(16, 0)),
    "late": (time(16, 0), time(0, 0)),
    "night": (time(0, 0), time(8, 0)),
}

def match_employee_by_name(name: str) -> Optional[int]:
    if not name:
        return None
    exact = [e.id for e in employees_db if e.name == name]
    if len(exact) == 1:
        return exact[0]
    partial = [e.id for e in employees_db if name in e.name]
    if len(partial) == 1:
        return partial[0]
    return None

def find_shift_by_employee_date_slot(employee_id: int, date_value: date, slot: str) -> Optional[Shift]:
    if slot not in SLOT_TO_TIME:
        return None
    start_t, end_t = SLOT_TO_TIME[slot]
    for s in shifts_db:
        if s.employee_id == employee_id and s.date == date_value and s.start_time == start_t and s.end_time == end_t:
            return s
    return None

def get_week_range_containing(d: date) -> tuple[date, date]:
    weekday = d.weekday()  # Monday=0
    start = d - timedelta(days=weekday)
    end = start + timedelta(days=6)
    return start, end

def apply_request_on_copy(shifts: List[Shift], req: ShiftChangeRequest) -> tuple[List[Shift], List[Shift], List[Shift], List[ShiftUpdatePair]]:
    """Return (new_shifts, added, removed, updated) when applying req to a copy list"""
    new_list = [Shift(**s.dict()) for s in shifts]
    added: List[Shift] = []
    removed: List[Shift] = []
    updated: List[ShiftUpdatePair] = []

    def find_in_list(emp_id: int, d: date, slot: str) -> Optional[Shift]:
        if slot not in SLOT_TO_TIME:
            return None
        st, et = SLOT_TO_TIME[slot]
        for s in new_list:
            if s.employee_id == emp_id and s.date == d and s.start_time == st and s.end_time == et:
                return s
        return None

    if req.type == "absence":
        for slot_id in ["early", "late", "night"]:
            s = find_in_list(req.employee_id, req.date, slot_id)
            if s:
                new_list.remove(s)
                removed.append(s)

    elif req.type == "change_time":
        if req.from_slot and req.to_slot:
            s = find_in_list(req.employee_id, req.date, req.from_slot)
            if s:
                before = Shift(**s.dict())
                ns, ne = SLOT_TO_TIME[req.to_slot]
                s.start_time, s.end_time = ns, ne
                s.updated_at = datetime.now()
                updated.append(ShiftUpdatePair(before=before, after=s))

    elif req.type == "add_shift":
        if req.to_slot:
            ns, ne = SLOT_TO_TIME[req.to_slot]
            new_shift = Shift(
                id=None,
                employee_id=req.employee_id,
                date=req.date,
                start_time=ns,
                end_time=ne,
                break_minutes=60,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            new_list.append(new_shift)
            added.append(new_shift)

    elif req.type == "swap":
        if req.from_slot and req.to_slot and req.target_employee_id:
            a = find_in_list(req.employee_id, req.date, req.from_slot)
            b = find_in_list(req.target_employee_id, req.date, req.to_slot)
            if a and b:
                before_a = Shift(**a.dict())
                before_b = Shift(**b.dict())
                a.start_time, a.end_time, b.start_time, b.end_time = b.start_time, b.end_time, a.start_time, a.end_time
                a.updated_at = datetime.now()
                b.updated_at = datetime.now()
                updated.append(ShiftUpdatePair(before=before_a, after=a))
                updated.append(ShiftUpdatePair(before=before_b, after=b))

    return new_list, added, removed, updated

def apply_shift_change_request(req: ShiftChangeRequest) -> None:
    logger.info(
        "Apply shift change request id=%s type=%s employee_id=%s employee_name=%s date=%s from=%s to=%s target_employee_id=%s target_employee_name=%s",
        req.id, req.type, req.employee_id, req.employee_name, req.date, req.from_slot, req.to_slot, req.target_employee_id, req.target_employee_name,
    )
    # Resolve employee_id by name if needed
    if req.employee_id is None and req.employee_name:
        resolved_id = match_employee_by_name(req.employee_name)
        if resolved_id is None:
            logger.error("Employee resolution failed for name=%s", req.employee_name)
            raise HTTPException(status_code=400, detail="employee_name から従業員を特定できませんでした")
        req.employee_id = resolved_id

    if req.employee_id is None:
        logger.error("employee_id is missing for request id=%s", req.id)
        raise HTTPException(status_code=400, detail="employee_id が未指定です")

    if req.type == "absence":
        # delete any shift on that date (single slot assumed)
        deleted = False
        for slot_id in ["early", "late", "night"]:
            shift = find_shift_by_employee_date_slot(req.employee_id, req.date, slot_id)
            if shift:
                shifts_db.remove(shift)
                deleted = True
        if not deleted:
            logger.error("absence target shift not found for employee_id=%s date=%s", req.employee_id, req.date)
            raise HTTPException(status_code=404, detail="対象シフトが見つかりません")

    elif req.type == "change_time":
        if not req.from_slot or not req.to_slot:
            logger.error("change_time missing from_slot/to_slot")
            raise HTTPException(status_code=400, detail="from_slot と to_slot が必要です")
        src = find_shift_by_employee_date_slot(req.employee_id, req.date, req.from_slot)
        if not src:
            logger.error("change_time source shift not found employee_id=%s date=%s slot=%s", req.employee_id, req.date, req.from_slot)
            raise HTTPException(status_code=404, detail="変更元のシフトが見つかりません")
        new_start, new_end = SLOT_TO_TIME[req.to_slot]
        src.start_time = new_start
        src.end_time = new_end
        src.updated_at = datetime.now()

    elif req.type == "add_shift":
        if not req.to_slot:
            logger.error("add_shift missing to_slot")
            raise HTTPException(status_code=400, detail="to_slot が必要です")
        start_t, end_t = SLOT_TO_TIME[req.to_slot]
        new_shift = Shift(
            id=len(shifts_db) + 1,
            employee_id=req.employee_id,
            date=req.date,
            start_time=start_t,
            end_time=end_t,
            break_minutes=60,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        shifts_db.append(new_shift)

    elif req.type == "swap":
        if not req.from_slot or not req.to_slot:
            logger.error("swap missing from_slot/to_slot")
            raise HTTPException(status_code=400, detail="swap には from_slot, to_slot が必要です")
        if not req.target_employee_id:
            if req.target_employee_name:
                resolved_target = match_employee_by_name(req.target_employee_name)
                if not resolved_target:
                    logger.error("swap target resolution failed name=%s", req.target_employee_name)
                    raise HTTPException(status_code=400, detail="target_employee_name から従業員を特定できませんでした")
                req.target_employee_id = resolved_target
            else:
                logger.error("swap missing target_employee_id and target_employee_name")
                raise HTTPException(status_code=400, detail="swap には target_employee_id もしくは target_employee_name が必要です")
        a = find_shift_by_employee_date_slot(req.employee_id, req.date, req.from_slot)
        b = find_shift_by_employee_date_slot(req.target_employee_id, req.date, req.to_slot)
        if not a or not b:
            logger.error("swap target shifts not found a_exists=%s b_exists=%s", bool(a), bool(b))
            raise HTTPException(status_code=404, detail="入れ替え対象のシフトが見つかりません")
        # swap start/end times between slots
        a_start, a_end = a.start_time, a.end_time
        b_start, b_end = b.start_time, b.end_time
        a.start_time, a.end_time = b_start, b_end
        b.start_time, b.end_time = a_start, a_end
        a.updated_at = datetime.now()
        b.updated_at = datetime.now()

    else:
        raise HTTPException(status_code=400, detail=f"未対応の type: {req.type}")


@app.get("/")
async def root_ui():
    return FileResponse("app/static/index.html")

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/config")
async def get_config():
    return {"mode": "mock" if MOCK_OPENAI else "real"}

@app.get("/api/employees", response_model=EmployeeResponse)
async def get_employees():
    """Get all employees"""
    return EmployeeResponse(
        employees=employees_db,
        total=len(employees_db)
    )

@app.post("/api/employees/import", response_model=ImportResponse)
async def import_employees_csv(file: UploadFile = File(...)):
    """Import employees from CSV file"""
    
    print(f"🔍 Received CSV upload request: {file.filename}, size: {file.size}")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="CSVファイルのみサポートされています")
    
    try:
        content = await file.read()
        
        csv_content = None
        for encoding in ['utf-8', 'shift_jis', 'cp932']:
            try:
                csv_content = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if csv_content is None:
            raise HTTPException(status_code=400, detail="CSVファイルの文字エンコーディングに問題があります。UTF-8形式で保存してください。")
        
        csv_data = pd.read_csv(io.StringIO(csv_content))
        
        if csv_data.empty:
            raise HTTPException(status_code=400, detail="CSVファイルが空か、正しい形式ではありません")
        
        required_columns = ['id', 'name', 'role', 'skill_level']
        missing_columns = [col for col in required_columns if col not in csv_data.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"必要な列が不足しています: {', '.join(missing_columns)}。必要な列: {', '.join(required_columns)}"
            )
        
        employees_db.clear()
        imported_employees = []
        current_time = datetime.now()
        
        for i, row in enumerate(csv_data.itertuples(index=False), start=2):
            row_num = i
            try:
                for col in required_columns:
                    val = getattr(row, col)
                    if pd.isna(val) or str(val).strip() == '':
                        raise HTTPException(
                            status_code=400,
                            detail=f"行 {row_num}: '{col}' 列が空です"
                        )
                
                try:
                    employee_id = int(getattr(row, 'id'))
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"行 {row_num}: IDは数値で入力してください"
                    )
                
                try:
                    skill_level = int(getattr(row, 'skill_level'))
                    if skill_level < 1 or skill_level > 10:
                        raise HTTPException(
                            status_code=400,
                            detail=f"行 {row_num}: スキルレベルは1-10の数値で入力してください"
                        )
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"行 {row_num}: スキルレベルは1-10の数値で入力してください"
                    )
                
                employee = Employee(
                    id=employee_id,
                    name=str(getattr(row, 'name')).strip(),
                    email=str(getattr(row, 'email')).strip() if hasattr(row, 'email') and pd.notna(getattr(row, 'email')) and str(getattr(row, 'email')).strip() else None,
                    role=str(getattr(row, 'role')).strip(),
                    skill_level=skill_level,
                    created_at=current_time,
                    updated_at=current_time
                )
                employees_db.append(employee)
                imported_employees.append(employee)
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"行 {row_num}でエラーが発生しました: {str(e)}"
                )
        
        if not imported_employees:
            raise HTTPException(status_code=400, detail="CSVファイルに有効なデータが含まれていません")
        
        shift_cache.clear()
        
        return ImportResponse(
            message=f"{len(imported_employees)}件の従業員データをインポートしました",
            imported_count=len(imported_employees),
            employees=imported_employees
        )
        
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSVファイルが空か、正しい形式ではありません")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"CSVファイルの形式に問題があります: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ファイル処理中にエラーが発生しました: {str(e)}")

@app.delete("/api/employees")
async def clear_employees():
    """Clear all employees (for testing purposes)"""
    employees_db.clear()
    shift_cache.clear()
    return {"message": "All employees cleared"}

def is_consecutive_timeslot(prev_time: str, current_time: str) -> bool:
    """連続する時間枠かどうかを判定"""
    if prev_time == "08:00" and current_time == "16:00":
        return True
    elif prev_time == "16:00" and current_time == "00:00":
        return True
    elif prev_time == "00:00" and current_time == "08:00":
        return True
    return False

def validate_shift_constraints(shifts: List[Shift], employees: List[Employee]) -> List[ShiftValidationWarning]:
    """Validate shift constraints and return warnings"""
    warnings = []
    employee_name_map = {emp.id: emp.name for emp in employees}
    
    employee_shifts = {}
    daily_shifts = {}
    
    for shift in shifts:
        if shift.employee_id not in employee_shifts:
            employee_shifts[shift.employee_id] = []
        employee_shifts[shift.employee_id].append(shift)
        
        if shift.date not in daily_shifts:
            daily_shifts[shift.date] = []
        daily_shifts[shift.date].append(shift)
    
    consecutive_timeslot_employees = []
    consecutive_timeslot_data = {}
    
    for employee_id, emp_shifts in employee_shifts.items():
        emp_shifts.sort(key=lambda x: (x.date, x.start_time))
        consecutive_slots = 1
        warning_added_for_period = False
        consecutive_periods = [(emp_shifts[0].date, emp_shifts[0].start_time.strftime("%H:%M"))] if emp_shifts else []
        
        for i in range(1, len(emp_shifts)):
            current_shift = emp_shifts[i]
            prev_shift = emp_shifts[i-1]
            
            prev_time_str = prev_shift.start_time.strftime("%H:%M")
            current_time_str = current_shift.start_time.strftime("%H:%M")
            
            if (current_shift.date == prev_shift.date and 
                is_consecutive_timeslot(prev_time_str, current_time_str)) or \
               (current_shift.date == prev_shift.date + timedelta(days=1) and 
                prev_time_str == "16:00" and current_time_str == "00:00") or \
               (current_shift.date == prev_shift.date + timedelta(days=1) and 
                prev_time_str == "00:00" and current_time_str == "08:00"):
                consecutive_slots += 1
                consecutive_periods.append((current_shift.date, current_time_str))
                if consecutive_slots > 2 and not warning_added_for_period:
                    employee_name = employee_name_map.get(employee_id, f"従業員ID{employee_id}")
                    consecutive_timeslot_employees.append(f"{employee_name}(ID：{employee_id}番)")
                    consecutive_timeslot_data[employee_id] = consecutive_periods.copy()
                    warning_added_for_period = True
            else:
                consecutive_slots = 1
                consecutive_periods = [(current_shift.date, current_time_str)]
                warning_added_for_period = False
    
    if consecutive_timeslot_employees:
        employee_list = "、".join(consecutive_timeslot_employees)
        all_affected_employees = list(consecutive_timeslot_data.keys())
        all_affected_dates = []
        for periods in consecutive_timeslot_data.values():
            all_affected_dates.extend([f"{d.strftime('%Y-%m-%d')}_{t}" for d, t in periods])
        
        warnings.append(ShiftValidationWarning(
            type="consecutive_timeslots",
            message=f"{employee_list}が連続する時間枠でシフトに入っています",
            affected_employees=all_affected_employees,
            affected_dates=list(set(all_affected_dates))
        ))
    
    insufficient_staff_dates = []
    skill_requirement_dates = []
    
    for shift_date, day_shifts in daily_shifts.items():
        shift_counts = {}
        for shift in day_shifts:
            shift_type = f"{shift.start_time}-{shift.end_time}"
            shift_counts[shift_type] = shift_counts.get(shift_type, 0) + 1
        
        for shift_type, count in shift_counts.items():
            if count < 2:
                date_str = shift_date.strftime("%Y-%m-%d")
                if date_str not in insufficient_staff_dates:
                    insufficient_staff_dates.append(date_str)
    
    employee_skill_map = {emp.id: emp.skill_level for emp in employees}
    
    for shift_date, day_shifts in daily_shifts.items():
        max_skill = max([employee_skill_map.get(shift.employee_id, 1) for shift in day_shifts], default=1)
        if max_skill < 3:
            date_str = shift_date.strftime("%Y-%m-%d")
            if date_str not in skill_requirement_dates:
                skill_requirement_dates.append(date_str)
    
    if insufficient_staff_dates:
        if len(insufficient_staff_dates) == 1:
            date_display = insufficient_staff_dates[0]
        else:
            date_display = "、".join(insufficient_staff_dates)
        
        warnings.append(ShiftValidationWarning(
            type="insufficient_staff",
            message=f"{date_display}において人員が不足しています",
            affected_dates=insufficient_staff_dates
        ))
    
    if skill_requirement_dates:
        if len(skill_requirement_dates) == 1:
            date_display = skill_requirement_dates[0]
        else:
            date_display = "、".join(skill_requirement_dates)
        
        warnings.append(ShiftValidationWarning(
            type="skill_requirement",
            message=f"{date_display}においてスキルレベル3以上の従業員が不足しています",
            affected_dates=skill_requirement_dates
        ))
    
    return warnings

def generate_shifts_with_ortools(request: ShiftGenerationRequest, employees: List[Employee]) -> ShiftGenerationResponse:
    """Generate optimal shifts using OR-Tools CP-SAT"""
    
    shift_types = request.shift_types or [
        {"id": "early", "start_time": "08:00", "end_time": "16:00", "break_minutes": 60},
        {"id": "late", "start_time": "16:00", "end_time": "00:00", "break_minutes": 60},
        {"id": "night", "start_time": "00:00", "end_time": "08:00", "break_minutes": 60},
        {"id": "off", "start_time": None, "end_time": None, "break_minutes": 0}
    ]
    
    model = cp_model.CpModel()
    
    current_date = request.start_date
    dates = []
    while current_date <= request.end_date:
        dates.append(current_date)
        current_date = current_date + timedelta(days=1)
    
    employee_shifts = {}
    for emp_id in request.employee_ids:
        employee_shifts[emp_id] = {}
        for d in dates:
            employee_shifts[emp_id][d] = {}
            for shift_type in shift_types:
                if shift_type["id"] != "off":
                    employee_shifts[emp_id][d][shift_type["id"]] = model.NewBoolVar(f'emp_{emp_id}_date_{d}_shift_{shift_type["id"]}')
    
    for d in dates:
        for shift_type in shift_types:
            if shift_type["id"] != "off":
                shifts_for_type = [employee_shifts[emp_id][d][shift_type["id"]] for emp_id in request.employee_ids]
                model.Add(sum(shifts_for_type) >= 1)  # 最低1人
                model.Add(sum(shifts_for_type) <= 3)  # 最大3人（時間枠単位で制限）
    
    shift_order = ["early", "late", "night"]
    for emp_id in request.employee_ids:
        for d in dates:
            for i, shift_type in enumerate(shift_order):
                if shift_type in employee_shifts[emp_id][d]:
                    next_shift_idx = (i + 1) % len(shift_order)
                    next_shift_type = shift_order[next_shift_idx]
                    if next_shift_type in employee_shifts[emp_id][d]:
                        model.Add(employee_shifts[emp_id][d][shift_type] + employee_shifts[emp_id][d][next_shift_type] <= 1)
                    
                    next_next_shift_idx = (i + 2) % len(shift_order)
                    next_next_shift_type = shift_order[next_next_shift_idx]
                    if next_next_shift_type in employee_shifts[emp_id][d]:
                        model.Add(employee_shifts[emp_id][d][shift_type] + employee_shifts[emp_id][d][next_next_shift_type] <= 1)
    
    manager_ids = [emp.id for emp in employees if emp.role == "manager"]
    for d in dates:
        for shift_type in shift_types:
            if shift_type["id"] != "off":
                manager_shifts = [employee_shifts[emp_id][d][shift_type["id"]] for emp_id in manager_ids if emp_id in employee_shifts]
                if len(manager_shifts) >= 1:
                    model.Add(sum(manager_shifts) >= 1)  # 管理職1人以上（時間枠単位）
                    model.Add(sum(manager_shifts) <= 2)  # 管理職最大2人（時間枠単位で制限）
    
    employee_skill_map = {emp.id: emp.skill_level for emp in employees}
    for d in dates:
        for shift_type in shift_types:
            if shift_type["id"] != "off":
                skill_total_for_slot = []
                for emp_id in request.employee_ids:
                    if emp_id in employee_shifts and emp_id in employee_skill_map:
                        skill_contribution = employee_shifts[emp_id][d][shift_type["id"]] * employee_skill_map[emp_id]
                        skill_total_for_slot.append(skill_contribution)
                
                if skill_total_for_slot:
                    model.Add(sum(skill_total_for_slot) >= 10)  # スキル合計15以上（時間枠単位、従業員複数シフト勤務で実現可能）
    
    for shift_type in shift_types:
        if shift_type["id"] != "off":
            shifts_per_employee_per_type = {}
            for emp_id in request.employee_ids:
                shifts_for_type = []
                for d in dates:
                    shifts_for_type.append(employee_shifts[emp_id][d][shift_type["id"]])
                shifts_per_employee_per_type[emp_id] = sum(shifts_for_type)
            
            for emp_id in request.employee_ids:
                model.Add(shifts_per_employee_per_type[emp_id] <= 3)  # Allow up to 3 shifts per type per week
    
    total_shifts_per_employee = {}
    for emp_id in request.employee_ids:
        total_shifts = []
        for d in dates:
            for shift_type in shift_types:
                if shift_type["id"] != "off":
                    total_shifts.append(employee_shifts[emp_id][d][shift_type["id"]])
        total_shifts_per_employee[emp_id] = sum(total_shifts)
        model.Add(total_shifts_per_employee[emp_id] <= 10)  # Up to 10 total shifts per week
    
    max_shifts_var = model.NewIntVar(0, 10, 'max_shifts')
    for emp_id in request.employee_ids:
        model.Add(total_shifts_per_employee[emp_id] <= max_shifts_var)
    model.Minimize(max_shifts_var)
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0  # 30 second timeout
    status = solver.Solve(model)
    
    generated_shifts = []
    warnings = []
    structured_warnings = []
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        for emp_id in request.employee_ids:
            for d in dates:
                for shift_type in shift_types:
                    if shift_type["id"] != "off" and solver.Value(employee_shifts[emp_id][d][shift_type["id"]]) == 1:
                        start_time_str = shift_type["start_time"]
                        end_time_str = shift_type["end_time"]
                        
                        if start_time_str and end_time_str:
                            start_time_obj = time.fromisoformat(start_time_str)
                            if end_time_str == "00:00":
                                end_time_obj = time(0, 0)
                            else:
                                end_time_obj = time.fromisoformat(end_time_str)
                            
                            shift = Shift(
                                employee_id=emp_id,
                                date=d,
                                start_time=start_time_obj,
                                end_time=end_time_obj,
                                break_minutes=shift_type["break_minutes"],
                                created_at=datetime.now(),
                                updated_at=datetime.now()
                            )
                            generated_shifts.append(shift)
        
        warnings_list = validate_shift_constraints(generated_shifts, employees)
        warnings = [w.message for w in warnings_list]
        structured_warnings = []
        for w in warnings_list:
            warning_dict = w.dict()
            if warning_dict.get('affected_dates'):
                warning_dict['affected_dates'] = [d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d) for d in warning_dict['affected_dates']]
            structured_warnings.append(warning_dict)
        
        status_message = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
        
    else:
        status_message = "INFEASIBLE"
        warnings.append("制約条件を満たすシフトを生成できませんでした。条件を緩和してください。")
    
    response_data = {
        "message": f"シフト生成が完了しました。{len(generated_shifts)}件のシフトを生成しました。",
        "shifts": generated_shifts,
        "warnings": warnings,
        "structured_warnings": structured_warnings,
        "optimization_status": status_message
    }
    return ShiftGenerationResponse(**response_data)

@app.get("/api/shifts")
async def get_shifts():
    """Get all shifts"""
    return {"shifts": shifts_db, "total": len(shifts_db)}

@app.get("/api/shifts/by")
async def get_shift_by(
    employee_id: int = Query(...),
    date_str: str = Query(..., alias="date"),
    slot: str = Query(...),
):
    """Find a shift by employee, date (YYYY-MM-DD), and slot id (early|late|night)"""
    try:
        d = datetime.fromisoformat(date_str).date()
    except Exception:
        raise HTTPException(status_code=400, detail="date は YYYY-MM-DD で指定してください")
    shift = find_shift_by_employee_date_slot(employee_id, d, slot)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift

@app.post("/api/shifts/generate", response_model=ShiftGenerationResponse)
async def generate_shifts(request: ShiftGenerationRequest):
    """Generate optimal shifts using OR-Tools CP-SAT with caching"""
    logger.info(
        "Generate shifts requested: start=%s end=%s employees=%s",
        request.start_date, request.end_date, request.employee_ids,
    )
    available_employee_ids = {emp.id for emp in employees_db}
    invalid_ids = [emp_id for emp_id in request.employee_ids if emp_id not in available_employee_ids]
    
    if invalid_ids:
        logger.error("Invalid employee IDs in request: %s; available=%s", invalid_ids, list(available_employee_ids))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid employee IDs: {invalid_ids}. Available IDs: {list(available_employee_ids)}"
        )
    
    if not request.employee_ids:
        logger.error("No employee IDs provided")
        raise HTTPException(status_code=400, detail="At least one employee ID is required")
    
    request_employees = [emp for emp in employees_db if emp.id in request.employee_ids]
    
    cache_key = generate_cache_key(request, request_employees)
    if is_cache_valid(cache_key):
        cached_result = shift_cache[cache_key]["result"]
        logger.info("Returning cached result for key=%s", cache_key)
        return ShiftGenerationResponse(**cached_result)
    
    try:
        result = generate_shifts_with_ortools(request, request_employees)
        logger.info(
            "Generated shifts: count=%s status=%s warnings=%s",
            len(result.shifts), result.optimization_status, result.warnings,
        )
        
        shift_cache[cache_key] = {
            "result": result.dict(),
            "timestamp": datetime.now()
        }
        
        for shift in result.shifts:
            shift.id = len(shifts_db) + 1
            shifts_db.append(shift)
        from . import store
        store.set_current_schedule(shifts_db)
        return result
        
    except Exception as e:
        logger.exception("Shift generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Shift generation failed: {str(e)}")

@app.put("/api/shifts/{shift_id}")
async def update_shift(shift_id: int, shift_data: Shift):
    """Update a specific shift"""
    shift_index = None
    for i, shift in enumerate(shifts_db):
        if shift.id == shift_id:
            shift_index = i
            break
    if shift_index is None:
        raise HTTPException(status_code=404, detail="Shift not found")
    shift_data.id = shift_id
    shift_data.updated_at = datetime.now()
    shifts_db[shift_index] = shift_data
    from . import store
    store.set_current_schedule(shifts_db)
    return {"message": "Shift updated successfully", "shift": shift_data}

@app.delete("/api/shifts/{shift_id}")
async def delete_shift(shift_id: int):
    """Delete a specific shift"""
    for i, shift in enumerate(shifts_db):
        if shift.id == shift_id:
            del shifts_db[i]
            from . import store
            store.set_current_schedule(shifts_db)
            return {"message": "Shift deleted"}
    raise HTTPException(status_code=404, detail="Shift not found")

@app.delete("/api/shifts")
async def clear_shifts():
    """Clear all shifts (for testing purposes)"""
    shifts_db.clear()
    from . import store
    store.set_current_schedule(shifts_db)
    return {"message": "All shifts cleared"}

@app.post("/api/shifts/analyze-difficulty", response_model=LLMAnalysisResponse)
async def analyze_shift_difficulty(request: LLMAnalysisRequest, api_key: str = Header(None, alias="X-API-Key")):
    """Analyze shift generation difficulties using ChatGPT API"""
    if not api_key:
        return LLMAnalysisResponse(
            analysis="APIキーが設定されていません。設定画面でChatGPT APIキーを設定してください。",
            success=False,
            error="Missing API key"
        )
    
    try:
        client = openai.OpenAI(api_key=api_key)
        
        system_prompt = "シフト作成してその結果難しかった点やエラー内容を入力するので、何が難しかった方を記載してください"
        
        if request.optimization_status == "INFEASIBLE":
            user_content = f"シフト生成が失敗しました。ステータス: {request.optimization_status}。エラー内容: {request.error_content}。警告: {', '.join(request.warnings)}"
        else:
            user_content = f"シフト生成が成功しました。ステータス: {request.optimization_status}。警告: {', '.join(request.warnings) if request.warnings else 'なし'}"
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            max_tokens=300,
            temperature=0.7
        )
        
        analysis = response.choices[0].message.content.strip()
        
        return LLMAnalysisResponse(
            analysis=analysis,
            success=True
        )
        
    except Exception as e:
        return LLMAnalysisResponse(
            analysis="LLM分析でエラーが発生しました。APIキーを確認してください。",
            success=False,
            error=str(e)
        )

@app.post("/api/shift-change", response_model=ShiftChangeRequest)
async def create_shift_change_request(payload: ShiftChangeRequest):
    """Create a new shift change request (usually from LINE)"""
    req = payload
    req.id = len(shift_change_requests_db) + 1
    req.status = req.status or "pending"
    req.created_at = datetime.now()
    req.updated_at = datetime.now()

    # Resolve employee by name if id missing (best-effort)
    if req.employee_id is None and req.employee_name:
        resolved_id = match_employee_by_name(req.employee_name)
        if resolved_id is not None:
            req.employee_id = resolved_id

    # Capture snapshot (pre-approval) for the week containing the target date
    try:
        ws, we = get_week_range_containing(req.date)
        req.snapshot_week_start = ws
        req.snapshot_week_end = we
        week_shifts = [s for s in shifts_db if ws <= s.date <= we]
        # Deep copy to avoid later mutation side-effects
        req.snapshot_shifts = [Shift(**s.dict()) for s in week_shifts]
    except Exception:
        # best-effort; leave snapshot empty on failure
        req.snapshot_week_start = req.snapshot_week_start or None
        req.snapshot_week_end = req.snapshot_week_end or None
        req.snapshot_shifts = req.snapshot_shifts or None

    shift_change_requests_db.append(req)
    logger.info("Created shift-change request id=%s type=%s status=%s", req.id, req.type, req.status)
    return req

@app.get("/api/shift-change", response_model=ShiftChangeRequestResponse)
async def list_shift_change_requests(status: Optional[str] = Query(None)):
    items = shift_change_requests_db
    if status:
        items = [r for r in items if r.status == status]
    logger.info("List shift-change requests status=%s count=%s", status, len(items))
    return {"requests": items, "total": len(items)}

@app.get("/api/shift-change/{request_id}/preview", response_model=ShiftPreviewResponse)
async def preview_shift_after_request(request_id: int):
    req = next((r for r in shift_change_requests_db if r.id == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="申請が見つかりません")

    # Use snapshot if available (pre-approval state). Fallback to current.
    if req.snapshot_shifts and req.snapshot_week_start and req.snapshot_week_end:
        base_week_shifts = [Shift(**s.dict()) for s in req.snapshot_shifts]
        ws = req.snapshot_week_start
        we = req.snapshot_week_end
    else:
        ws, we = get_week_range_containing(req.date)
        base_week_shifts = [s for s in shifts_db if ws <= s.date <= we]

    new_list, added, removed, updated = apply_request_on_copy(base_week_shifts, req)

    # Build suggestions using store.suggest_replacements_for
    suggestions: List[SuggestionItem] = []
    targets: List[Shift] = []
    targets.extend(removed)
    for u in updated:
        targets.append(u.before)
    seen = set()
    for s in targets:
        key = (s.date, s.start_time, s.end_time)
        if key in seen:
            continue
        seen.add(key)
        cands = store.suggest_replacements_for(s, max_candidates=3, exclude_ids=[s.employee_id])
        suggestions.append(SuggestionItem(
            date=s.date,
            start_time=s.start_time,
            end_time=s.end_time,
            original_employee_id=s.employee_id,
            candidates=[ReplacementCandidate(**c) for c in cands]
        ))

    return ShiftPreviewResponse(
        week_start=ws,
        week_end=we,
        shifts=new_list,
        added=added,
        removed=removed,
        updated=updated,
        suggestions=suggestions,
    )

@app.post("/api/shift-change/{request_id}/approve", response_model=ShiftChangeRequest)
async def approve_shift_change_request(request_id: int):
    for req in shift_change_requests_db:
        if req.id == request_id:
            if req.status != "pending":
                logger.error("Approve failed: already processed id=%s status=%s", req.id, req.status)
                raise HTTPException(status_code=400, detail="この申請は処理済みです")
            apply_shift_change_request(req)
            req.status = "approved"
            req.updated_at = datetime.now()
            logger.info("Approved shift-change request id=%s", req.id)
            # Notify LINE bot (best-effort)
            try:
                note = _build_approval_message(req)
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post("http://linebot:8082/notify/approval", json={
                        "line_user_id": req.line_user_id,
                        "message": note,
                    })
            except Exception as e:
                logger.error("Failed to notify linebot for approval id=%s: %s", req.id, e)
            return req
    raise HTTPException(status_code=404, detail="申請が見つかりません")

@app.post("/api/shift-change/{request_id}/reject", response_model=ShiftChangeRequest)
async def reject_shift_change_request(request_id: int, reason: Optional[str] = None):
    for req in shift_change_requests_db:
        if req.id == request_id:
            if req.status != "pending":
                logger.error("Reject failed: already processed id=%s status=%s", req.id, req.status)
                raise HTTPException(status_code=400, detail="この申請は処理済みです")
            req.status = "rejected"
            req.reason = reason or req.reason
            req.updated_at = datetime.now()
            logger.info("Rejected shift-change request id=%s", req.id)
            # Notify LINE bot (best-effort)
            try:
                note = _build_rejection_message(req)
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post("http://linebot:8082/notify/approval", json={
                        "line_user_id": req.line_user_id,
                        "message": note,
                    })
            except Exception as e:
                logger.error("Failed to notify linebot for rejection id=%s: %s", req.id, e)
            return req
    raise HTTPException(status_code=404, detail="申請が見つかりません")
