from __future__ import annotations

from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta, date, time
from uuid import uuid4
import sqlite3
from pathlib import Path
import asyncio
from .schemas import Shift, ShiftUpdatePair, ChangeDelta, ChangeSet

sessions: Dict[str, Dict[str, Any]] = {}
messages: Dict[str, Dict[str, Any]] = {}
constraint_versions: Dict[str, Dict[str, Any]] = {}
audit_logs: List[Dict[str, Any]] = []
_current_schedule: List[Shift] = []
_schedule_version = 0

current_constraints: Dict[str, Any] = {
    "min_staff_weekend": 1,
    "weights": {"weekend_minimum": 1.0}
}

_DB_PATH = Path(__file__).resolve().parent / "data.db"

def _db():
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT, action TEXT, meta TEXT, created_at TEXT)")
    return conn

_ws_queues: List[asyncio.Queue] = []
def new_id() -> str:
    return uuid4().hex

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def create_session(title: str | None = None, seed_constraints_id: str | None = None) -> str:
    sid = new_id()
    sessions[sid] = {
        "id": sid,
        "title": title or f"Session {sid[:6]}",
        "seed_constraints_id": seed_constraints_id,
        "created_at": now_iso(),
        "retention_until": (datetime.utcnow() + timedelta(days=365)).isoformat() + "Z",
    }
    return sid

def save_message(data: Dict[str, Any]) -> str:
    mid = new_id()
    data["id"] = mid
    data["created_at"] = now_iso()
    messages[mid] = data
    return mid

def add_version(constraints_json: Dict[str, Any], apply_mode: str, applied_by: str | None) -> str:
    vid = new_id()
    constraint_versions[vid] = {
        "id": vid,
        "constraints_json": constraints_json,
        "apply_mode": apply_mode,
        "applied_by": applied_by,
        "created_at": now_iso(),
    }
    return vid

def add_audit(actor: str, action: str, meta: Dict[str, Any]):
    entry = {
        "id": new_id(),
        "actor": actor,
        "action": action,
        "meta": meta,
        "created_at": now_iso()
    }
    audit_logs.append(entry)
    conn = _db()
    try:
        conn.execute("INSERT INTO audit (id, actor, action, meta, created_at) VALUES (?, ?, ?, ?, ?)", (entry["id"], entry["actor"], entry["action"], str(entry["meta"]), entry["created_at"]))
        conn.commit()
    finally:
        conn.close()

# グローバル変数で従業員データを管理
_employees_cache: List[Dict[str, Any]] = []

def set_employees_cache(employees: List[Dict[str, Any]]):
    global _employees_cache
    _employees_cache = employees

def employees_master() -> List[Dict[str, Any]]:
    if _employees_cache:
        return _employees_cache
    # フォールバック: ダミーデータ
    return [{"id": i, "name": f"従業員{i}"} for i in range(1, 21)]

def match_employee_id_by_name(name: str) -> int | None:
    for e in employees_master():
        if e["name"] == name:
            return e["id"]
    return None

def similar_names(fragment: str) -> List[str]:
    out = []
    for e in employees_master():
        if fragment in e["name"]:
            out.append(e["name"])
    return out

def schedule_version() -> int:
    return _schedule_version

def current_schedule_copy() -> List[Shift]:
    return [Shift(**s.dict()) for s in _current_schedule]

def conflicting_shifts(a_id: int, b_id: int, start: date, end: date) -> List[Tuple[Shift, Shift]]:
    out: List[Tuple[Shift, Shift]] = []
    for sa in _current_schedule:
        if sa.employee_id != a_id:
            continue
        for sb in _current_schedule:
            if sb.employee_id != b_id:
                continue
            if sa.date == sb.date and start <= sa.date <= end:
                out.append((sa, sb))
    return out

from typing import Any

def set_current_schedule(shifts: List[Any]):
    global _current_schedule, _schedule_version
    _current_schedule = [Shift(**s.dict()) for s in shifts]
    _schedule_version += 1

def find_replacement_for(shift: Shift, exclude_ids: List[int]) -> int | None:
    print(f"DEBUG: Finding replacement for shift - employee_id: {shift.employee_id}, date: {shift.date}, start_time: {shift.start_time}, end_time: {shift.end_time}")
    print(f"DEBUG: Exclude IDs: {exclude_ids}")
    print(f"DEBUG: Available employees: {[e['id'] for e in employees_master()]}")
    
    for e in employees_master():
        if e["id"] in exclude_ids:
            print(f"DEBUG: Skipping employee {e['id']} - in exclude list")
            continue
        conflict = False
        for s in _current_schedule:
            if s.employee_id == e["id"] and s.date == shift.date and s.start_time == shift.start_time and s.end_time == shift.end_time:
                print(f"DEBUG: Employee {e['id']} has conflict on {s.date} at {s.start_time}-{s.end_time}")
                conflict = True
                break
        if not conflict:
            print(f"DEBUG: Found replacement: employee {e['id']}")
            return e["id"]
        else:
            print(f"DEBUG: Employee {e['id']} has conflicts, skipping")
    print(f"DEBUG: No replacement found for shift")
    return None

def suggest_replacements_for(shift: Shift, max_candidates: int = 3, exclude_ids: List[int] | None = None) -> List[Dict[str, Any]]:
    """Return ranked candidates respecting simple constraints:
    - Not already assigned in the exact same slot
    - Not assigned any other slot on the same day (avoid double booking)
    - Not assigned on immediately consecutive slots (prev/next) across day boundaries
    - Prefer employees with fewer shifts in the week
    """
    if exclude_ids is None:
        exclude_ids = []

    def week_range(d: date) -> tuple[date, date]:
        start = d - timedelta(days=d.weekday())
        end = start + timedelta(days=6)
        return start, end

    def weekly_count(emp_id: int, d: date) -> int:
        ws, we = week_range(d)
        return sum(1 for s in _current_schedule if s.employee_id == emp_id and ws <= s.date <= we)

    def start_str(t: time) -> str:
        return t.strftime("%H:%M")

    target_start = start_str(shift.start_time)

    # Employees busy on the exact slot
    busy_ids: set[int] = set(
        s.employee_id
        for s in _current_schedule
        if s.date == shift.date and s.start_time == shift.start_time and s.end_time == shift.end_time
    )

    # Build set of per-employee same-day assignments and neighbor-day assignments
    same_day_map: Dict[int, List[str]] = {}
    prev_day_map: Dict[int, List[str]] = {}
    next_day_map: Dict[int, List[str]] = {}
    for s in _current_schedule:
        if s.date == shift.date:
            same_day_map.setdefault(s.employee_id, []).append(start_str(s.start_time))
        if s.date == shift.date - timedelta(days=1):
            prev_day_map.setdefault(s.employee_id, []).append(start_str(s.start_time))
        if s.date == shift.date + timedelta(days=1):
            next_day_map.setdefault(s.employee_id, []).append(start_str(s.start_time))

    # Define consecutive neighbors relative to target_start
    # Sequences: 00:00 -> 08:00 -> 16:00 -> 00:00(next day)
    prev_same_day = {"08:00": "00:00", "16:00": "08:00", "00:00": None}.get(target_start)
    next_same_day = {"08:00": "16:00", "16:00": None, "00:00": "08:00"}.get(target_start)
    prev_prev_day = {"08:00": None, "16:00": None, "00:00": "16:00"}.get(target_start)
    next_next_day = {"08:00": None, "16:00": "00:00", "00:00": None}.get(target_start)

    def violates_consecutive(emp_id: int) -> bool:
        # same day any assignment disqualifies (avoid double booking)
        if emp_id in same_day_map and same_day_map[emp_id]:
            return True
        # consecutive previous on same day
        if prev_same_day and prev_same_day in same_day_map.get(emp_id, []):
            return True
        # consecutive next on same day
        if next_same_day and next_same_day in same_day_map.get(emp_id, []):
            return True
        # previous day late -> today 00:00
        if prev_prev_day and prev_prev_day in prev_day_map.get(emp_id, []):
            return True
        # today 16:00 -> next day 00:00
        if next_next_day and next_next_day in next_day_map.get(emp_id, []):
            return True
        return False

    candidates: List[Dict[str, Any]] = []
    for e in employees_master():
        emp_id = e.get("id")
        if emp_id is None:
            continue
        if emp_id in exclude_ids:
            continue
        if emp_id in busy_ids:
            continue
        if violates_consecutive(emp_id):
            continue
        w = weekly_count(emp_id, shift.date)
        candidates.append({
            "employee_id": emp_id,
            "name": e.get("name"),
            "score": float(w),
            "reasons": [f"week_shifts={w}"],
        })

    candidates.sort(key=lambda x: (x["score"], x["employee_id"]))
    return candidates[:max_candidates]

def apply_deltas_on_copy(base: List[Shift], deltas: List[ChangeDelta]) -> Tuple[List[Shift], List[Shift], List[Shift], List[ShiftUpdatePair]]:
    new_list = [Shift(**s.dict()) for s in base]
    added: List[Shift] = []
    removed: List[Shift] = []
    updated: List[ShiftUpdatePair] = []
    for d in deltas:
        if d.kind == "replace" and d.before and d.after:
            for i, s in enumerate(new_list):
                if s.employee_id == d.before.employee_id and s.date == d.before.date and s.start_time == d.before.start_time and s.end_time == d.before.end_time:
                    new_list[i] = d.after
                    updated.append(ShiftUpdatePair(before=d.before, after=d.after))
                    break
    return new_list, added, removed, updated

def apply_change_set(cs: ChangeSet) -> bool:
    global _current_schedule, _schedule_version
    base = current_schedule_copy()
    new_list, _, _, _ = apply_deltas_on_copy(base, cs.deltas)
    _current_schedule = new_list
    _schedule_version += 1
    add_audit("admin", "adjustments.apply", {"change_set_id": cs.id})
    publish_schedule_updated(cs)
    return True

def rollback_change_set(change_set_id: str) -> bool:
    global _schedule_version
    _schedule_version += 1
    add_audit("admin", "adjustments.rollback", {"change_set_id": change_set_id})
    return True
def subscribe_queue() -> "asyncio.Queue[Dict[str, Any]]":
    q: asyncio.Queue = asyncio.Queue()
    _ws_queues.append(q)
    return q

def unsubscribe_queue(q: "asyncio.Queue[Dict[str, Any]]"):
    try:
        _ws_queues.remove(q)
    except ValueError:
        pass




def publish_proposals_ready(cs: ChangeSet):
    msg = {"type": "proposals_ready", "change_set": cs.dict()}
    for q in list(_ws_queues):
        try:
            q.put_nowait(msg)
        except Exception:
            continue

def publish_schedule_updated(cs: ChangeSet):
    msg = {"type": "schedule.updated", "schedule_version": _schedule_version, "change_set_id": cs.id}
    for q in list(_ws_queues):
        try:
            q.put_nowait(msg)
        except Exception:
            continue
