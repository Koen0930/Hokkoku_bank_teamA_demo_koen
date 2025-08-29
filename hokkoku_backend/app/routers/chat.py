from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from .. import store
from ..services import intent
from ..services import openai_client
from ..schemas import Shift

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatParseRequest(BaseModel):
    text: str

class ChatShiftAdjustRequest(BaseModel):
    session_id: Optional[str] = None
    content: str
    mode: str = "auto"  # auto, qa, adjust
    current_shifts: Optional[List[Shift]] = None

class ChatShiftAdjustResponse(BaseModel):
    message_id: str
    intent: str
    confidence: float
    assistant_text: str
    adjustment_rule: Optional[Dict[str, Any]] = None
    preview: Optional[Dict[str, Any]] = None

class NormalizedRule(BaseModel):
    type: str
    a_employee_name: Optional[str] = None
    b_employee_name: Optional[str] = None
    a_employee_id: Optional[int] = None
    b_employee_id: Optional[int] = None

class ChatParseResponse(BaseModel):
    ok: bool
    rule: Optional[NormalizedRule] = None
    needs_disambiguation: bool = False
    choices: Dict[str, List[str]] = {}

def _extract_names(text: str) -> List[str]:
    names: List[str] = []
    for e in store.employees_master():
        n = e["name"]
        if n:
            print(f"DEBUG: Processing employee '{n}'")
            # 完全一致
            if n in text:
                print(f"DEBUG: Found '{n}' via exact match")
                names.append(n)
            # 敬語付きでの一致（田中太郎 → 田中さん）
            else:
                # 日本語の姓名を正しく分割（最初の2文字を姓とする）
                if len(n) >= 2:
                    surname = n[:2]  # 最初の2文字を姓とする
                    honorific = surname + "さん"
                    print(f"DEBUG: Checking '{honorific}' in text: '{honorific}' in '{text}' = {honorific in text}")
                    if honorific in text:
                        print(f"DEBUG: Found '{n}' via '{honorific}'")
                        names.append(n)
                    # 姓のみでの一致（田中太郎 → 田中）
                    elif surname in text and len(surname) > 1:
                        print(f"DEBUG: Found '{n}' via '{surname}'")
                        names.append(n)
    return list(dict.fromkeys(names))

@router.post("/parse", response_model=ChatParseResponse)
def parse(req: ChatParseRequest):
    text = req.text.strip()
    print(f"DEBUG: Parsing text: {repr(text)}")
    print(f"DEBUG: Text length: {len(text)}")
    print(f"DEBUG: Text bytes: {text.encode('utf-8')}")
    
    # 従業員マスタを確認
    employees = store.employees_master()
    print(f"DEBUG: Available employees: {employees}")
    
    # 名前抽出の詳細デバッグ
    names = _extract_names(text)
    print(f"DEBUG: Extracted names: {names}")
    
    # 各従業員名でのマッチングテスト
    for e in employees:
        n = e["name"]
        if n:
            print(f"DEBUG: Testing '{n}' in text: '{n}' in '{text}' = {n in text}")
            if n.split()[0] + "さん" in text:
                print(f"DEBUG: Found '{n}' via '{n.split()[0]}さん'")
    
    a = names[0] if len(names) > 0 else None
    b = names[1] if len(names) > 1 else None
    rule = None
    needs = False
    choices: Dict[str, List[str]] = {}
    if a and b:
        a_id = store.match_employee_id_by_name(a)
        b_id = store.match_employee_id_by_name(b)
        print(f"DEBUG: Matched IDs - a: {a_id}, b: {b_id}")
        if a_id is None or b_id is None:
            needs = True
            if a_id is None:
                choices["a"] = store.similar_names(a)
            if b_id is None:
                choices["b"] = store.similar_names(b)
        rule = NormalizedRule(type="pair_not_together", a_employee_name=a, b_employee_name=b, a_employee_id=a_id, b_employee_id=b_id)
    return ChatParseResponse(ok=rule is not None, rule=rule, needs_disambiguation=needs, choices=choices)

@router.post("/shift-adjust", response_model=ChatShiftAdjustResponse)
def shift_adjust(req: ChatShiftAdjustRequest):
    """シフト調整チャット処理"""
    content = req.content.strip()
    mode = req.mode
    
    # コンテキストを準備 - shifts_dbから直接取得して同期問題を回避
    from .. import main
    current_shifts = main.shifts_db if hasattr(main, 'shifts_db') else []
    print(f"DEBUG: Loading shifts for context - found {len(current_shifts)} shifts")
    
    if hasattr(req, 'current_shifts') and req.current_shifts:
        current_shifts = req.current_shifts
        print(f"DEBUG: Using shifts from frontend - found {len(current_shifts)} shifts")
    
    if current_shifts:
        store.set_current_schedule(current_shifts)
        print(f"DEBUG: Synchronized store with {len(current_shifts)} shifts")
    
    context = {
        "employees": store.employees_master(),
        "current_schedule": current_shifts
    }
    
    # 意図判定
    if mode == "auto":
        intent_result, confidence = intent.route(mode, content, context)
    else:
        intent_result = mode
        confidence = 1.0
    
    message_id = store.new_id()
    
    if intent_result == "qa":
        # 質問回答
        assistant_text = openai_client.generate_qa(content, context)
        return ChatShiftAdjustResponse(
            message_id=message_id,
            intent="qa",
            confidence=confidence,
            assistant_text=assistant_text,
            adjustment_rule=None,
            preview=None
        )
    elif intent_result == "adjust":
        # 調整処理
        print(f"DEBUG: Processing adjust request: {content}")
        result = openai_client.generate_adjustment_rule(content, context)
        print(f"DEBUG: OpenAI rule generation result: {result}")
        assistant_text = result.get("assistant_text", "調整案を生成しました。")
        adjustment_rule = result.get("rule")
        print(f"DEBUG: Extracted adjustment rule: {adjustment_rule}")
        
        # プレビュー生成（調整ルールがある場合）
        preview = None
        if adjustment_rule:
            try:
                from ..services import adjustments as adj_svc
                change_set, preview_data = adj_svc.generate_preview(adjustment_rule, None)
                preview = {
                    "week_start": preview_data.week_start.isoformat(),
                    "week_end": preview_data.week_end.isoformat(),
                    "shifts": [s.dict() for s in preview_data.shifts],
                    "added": [s.dict() for s in preview_data.added],
                    "removed": [s.dict() for s in preview_data.removed],
                    "updated": [s.dict() for s in preview_data.updated],
                    "change_set_id": change_set.id
                }
            except Exception as e:
                print(f"Preview generation error: {e}")
                assistant_text = f"{assistant_text} (プレビュー生成に失敗しました: {str(e)})"
        
        return ChatShiftAdjustResponse(
            message_id=message_id,
            intent="adjust",
            confidence=confidence,
            assistant_text=assistant_text,
            adjustment_rule=adjustment_rule,
            preview=preview
        )
    else:
        # デフォルトは質問回答
        assistant_text = openai_client.generate_qa(content, context)
        return ChatShiftAdjustResponse(
            message_id=message_id,
            intent="qa",
            confidence=confidence,
            assistant_text=assistant_text,
            adjustment_rule=None,
            preview=None
        )
