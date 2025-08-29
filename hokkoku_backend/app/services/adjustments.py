from typing import Dict, Any, List, Tuple
from datetime import date, timedelta, datetime, time
from ..schemas import ChangeDelta, ChangeSet, Shift, ShiftUpdatePair, SchedulePreviewResponse
from .. import store

def _week_range_from(d: date) -> tuple[date, date]:
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return start, end

def _slot_to_time(slot: str) -> tuple[time, time] | None:
    if slot == "early":
        return time(8, 0), time(16, 0)
    if slot == "late":
        return time(16, 0), time(0, 0)
    if slot == "night":
        return time(0, 0), time(8, 0)
    return None

def _count_staff_on_day(target_day: str, shifts: List[Shift]) -> int:
    """特定日の人員数をカウント"""
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_index = day_names.index(target_day.lower()) if target_day.lower() in day_names else 0
    
    count = 0
    for shift in shifts:
        shift_date = shift.date
        if shift_date.weekday() == day_index:
            count += 1
    return count

def _find_available_employees(target_day: str, shifts: List[Shift], exclude_ids: List[int] | None = None) -> List[int]:
    """特定日に利用可能な従業員を検索"""
    if exclude_ids is None:
        exclude_ids = []
    
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_index = day_names.index(target_day.lower()) if target_day.lower() in day_names else 0
    
    # その日に既にシフトがある従業員を除外
    busy_employees = set()
    for shift in shifts:
        shift_date = shift.date
        if shift_date.weekday() == day_index:
            busy_employees.add(shift.employee_id)
    
    # 利用可能な従業員を返す
    available = []
    for employee in store.employees_master():
        emp_id = employee.get("id")
        if emp_id and emp_id not in busy_employees and emp_id not in exclude_ids:
            available.append(emp_id)
    
    return available

def _analyze_shift_distribution(shifts: List[Shift]) -> Dict[int, int]:
    """シフト分布を分析"""
    distribution = {}
    for shift in shifts:
        emp_id = shift.employee_id
        distribution[emp_id] = distribution.get(emp_id, 0) + 1
    return distribution

def _find_overworked_employees(distribution: Dict[int, int], threshold: int = 5) -> List[int]:
    """過重労働者を検出"""
    return [emp_id for emp_id, count in distribution.items() if count > threshold]

def _find_underworked_employees(distribution: Dict[int, int], threshold: int = 2) -> List[int]:
    """軽労働者を検出"""
    return [emp_id for emp_id, count in distribution.items() if count < threshold]

def generate_preview(rule: Dict[str, Any], week_start_iso: str | None) -> Tuple[ChangeSet, SchedulePreviewResponse]:
    today = date.today()
    if week_start_iso:
        try:
            parts = [int(x) for x in week_start_iso.split("-")]
            today = date(parts[0], parts[1], parts[2])
        except Exception:
            pass
    week_start, week_end = _week_range_from(today)
    base = store.current_schedule_copy()
    deltas: List[ChangeDelta] = []
    
    rule_type = rule.get("type")
    
    if rule_type == "pair_not_together":
        # 既存のpair_not_together機能をそのまま活用
        a_id = rule.get("a_employee_id")
        b_id = rule.get("b_employee_id")
        print(f"DEBUG: Processing pair_not_together rule for employees {a_id} and {b_id}")
        if a_id and b_id:
            conflicts = store.conflicting_shifts(a_id, b_id, week_start, week_end)
            print(f"DEBUG: Found {len(conflicts)} conflicting shifts")
            for s_a, s_b in conflicts:
                print(f"DEBUG: Conflict - Employee {s_a.employee_id} and {s_b.employee_id} on {s_a.date}")
                repl = store.find_replacement_for(s_b, exclude_ids=[a_id, b_id])
                print(f"DEBUG: Found replacement {repl} for employee {s_b.employee_id}")
                if repl is not None:
                    before = s_b
                    after = Shift(**s_b.dict())
                    after.employee_id = repl
                    deltas.append(ChangeDelta(kind="replace", before=before, after=after))
                    print(f"DEBUG: Added replacement delta: {s_b.employee_id} -> {repl}")
        print(f"DEBUG: Total deltas generated: {len(deltas)}")
    
    elif rule_type == "increase_staff_day":
        # 新規: 特定日の人員増加
        parameters = rule.get("parameters", {})
        target_day = parameters.get("day", "monday")
        target_count = parameters.get("target_count", 3)
        
        current_count = _count_staff_on_day(target_day, base)
        if current_count < target_count:
            needed = target_count - current_count
            available_employees = _find_available_employees(target_day, base)
            
            for _ in range(min(needed, len(available_employees))):
                if available_employees:
                    employee_id = available_employees.pop(0)
                    # 新しいシフトを作成
                    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                    day_index = day_names.index(target_day.lower()) if target_day.lower() in day_names else 0
                    shift_date = week_start + timedelta(days=day_index)
                    
                    new_shift = Shift(
                        id=store.new_id(),
                        employee_id=employee_id,
                        date=shift_date.isoformat(),
                        slot="early",  # デフォルトは早番
                        created_at=store.now_iso(),
                        updated_at=store.now_iso()
                    )
                    deltas.append(ChangeDelta(kind="add", before=None, after=new_shift))
    
    elif rule_type == "add_employee_shift":
        parameters = rule.get("parameters", {})
        employee_id = parameters.get("employee_id")
        target_date = parameters.get("date")  # ISO format date string
        slot = parameters.get("slot", "early")
        
        if employee_id and target_date:
            try:
                existing_shift = None
                for shift in base:
                    if shift.employee_id == employee_id and shift.date == target_date:
                        existing_shift = shift
                        break
                
                if not existing_shift:
                    # 新しいシフトを作成
                    new_shift = Shift(
                        id=store.new_id(),
                        employee_id=employee_id,
                        date=target_date,
                        slot=slot,
                        created_at=store.now_iso(),
                        updated_at=store.now_iso()
                    )
                    deltas.append(ChangeDelta(kind="add", before=None, after=new_shift))
                else:
                    if existing_shift.slot != slot:
                        before = existing_shift
                        after = Shift(**existing_shift.dict())
                        after.slot = slot
                        after.updated_at = store.now_iso()
                        deltas.append(ChangeDelta(kind="replace", before=before, after=after))
            except Exception as e:
                print(f"Error adding employee shift: {e}")
    
    elif rule_type == "redistribute_shifts":
        # 新規: シフト再配分
        distribution = _analyze_shift_distribution(base)
        overworked = _find_overworked_employees(distribution)
        underworked = _find_underworked_employees(distribution)
        
        # 過重労働者から軽労働者へシフトを再配分
        for over_emp in overworked:
            for under_emp in underworked:
                if len(deltas) >= 3:  # 最大3つの変更まで
                    break
                
                # 過重労働者のシフトを1つ軽労働者に移動
                over_shifts = [s for s in base if s.employee_id == over_emp]
                if over_shifts:
                    shift_to_move = over_shifts[0]
                    before = shift_to_move
                    after = Shift(**shift_to_move.dict())
                    after.employee_id = under_emp
                    deltas.append(ChangeDelta(kind="replace", before=before, after=after))
                    break
    
    cs = ChangeSet(
        id=store.new_id(),
        created_at=store.now_iso(),
        rule=rule,
        deltas=deltas,
        score=len(deltas),
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        schedule_version=store.schedule_version()
    )
    new_shifts, added, removed, updated = store.apply_deltas_on_copy(base, deltas)
    preview = SchedulePreviewResponse(
        week_start=week_start,
        week_end=week_end,
        shifts=new_shifts,
        added=added,
        removed=removed,
        updated=updated,
        change_set=cs
    )
    store.publish_proposals_ready(cs)
    return cs, preview

def apply_changes(cs: ChangeSet) -> Dict[str, Any]:
    ok = store.apply_change_set(cs)
    return {"ok": ok, "change_set_id": cs.id, "applied_at": store.now_iso(), "schedule_version": store.schedule_version()}

def rollback_changes(change_set_id: str) -> Dict[str, Any]:
    ok = store.rollback_change_set(change_set_id)
    return {"ok": ok, "rolled_back_id": change_set_id, "at": store.now_iso(), "schedule_version": store.schedule_version()}
