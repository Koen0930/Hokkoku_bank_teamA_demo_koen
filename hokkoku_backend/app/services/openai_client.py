from typing import Dict, Any, Tuple, Optional
import json
import re
from ..config import OPENAI_API_KEY, MOCK_OPENAI, OPENAI_MODEL, OPENAI_TIMEOUT_QA_MS, OPENAI_TIMEOUT_APPLY_MS, MAX_REPROMPTS

_client = None
if not MOCK_OPENAI and OPENAI_API_KEY:
    try:
        from openai import OpenAI
        _client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        _client = None

def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    
    m = re.search(r"```json\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    
    try:
        type_match = re.search(r'"type"\s*:\s*"pair_not_together"', text)
        if type_match:
            a_id_match = re.search(r'"a_employee_id"\s*:\s*(\d+)', text)
            b_id_match = re.search(r'"b_employee_id"\s*:\s*(\d+)', text)
            if a_id_match and b_id_match:
                return {
                    "type": "pair_not_together",
                    "a_employee_id": int(a_id_match.group(1)),
                    "b_employee_id": int(b_id_match.group(1))
                }
    except Exception:
        pass
    
    return None

def detect_intent(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
    if MOCK_OPENAI or not _client:
        return {"intent": "qa", "confidence": 0.5}
    sys = "You are an intent router for a shift optimization assistant. Return JSON with keys intent and confidence. intent is 'qa', 'apply', or 'adjust'."
    user = f"Message: {content}"
    try:
        r = _client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys},{"role":"user","content":user}],
            temperature=0,
            max_tokens=60,
            timeout=OPENAI_TIMEOUT_QA_MS/1000.0
        )
        txt = r.choices[0].message.content or ""
        js = _extract_json(txt)
        if isinstance(js, dict) and js.get("intent") in ("qa","apply","adjust"):
            c = float(js.get("confidence", 0.5))
            return {"intent": js["intent"], "confidence": max(0.0, min(1.0, c))}
    except Exception:
        pass
    return {"intent": "qa", "confidence": 0.5}

def generate_apply(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
    if MOCK_OPENAI or not _client:
        return {
            "assistant_text": "変更案を提案します。週末の最小人員を+1します。",
            "json": {"type": "patch", "patch": [{"op": "replace", "path": "/min_staff_weekend", "value": 2}]}
        }
    sys = (
        "You are an assistant that proposes constraint changes for a shift optimizer. "
        "Output concise assistant_text and a strict JSON object named spec with either: "
        "{'type':'patch','patch':[{'op':'replace','path':'/min_staff_weekend','value':2}]} "
        "or {'type':'full','full':{...full constraints json...}}. Return only a short explanation first then JSON."
    )
    ctx_constraints = context.get("constraints", {})
    user = f"Current constraints JSON:\n{json.dumps(ctx_constraints, ensure_ascii=False)}\nUser request:\n{content}"
    last_text = ""
    for _ in range(MAX_REPROMPTS + 1):
        try:
            r = _client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role":"system","content":sys},{"role":"user","content":user}],
                temperature=0.2,
                max_tokens=500,
                timeout=OPENAI_TIMEOUT_APPLY_MS/1000.0
            )
            txt = r.choices[0].message.content or ""
            last_text = txt
            js = _extract_json(txt)
            if isinstance(js, dict):
                if js.get("type") in ("patch","full"):
                    return {"assistant_text": txt.strip(), "json": js}
                if "spec" in js and isinstance(js["spec"], dict):
                    spec = js["spec"]
                    if spec.get("type") in ("patch","full"):
                        return {"assistant_text": txt.strip(), "json": spec}
        except Exception:
            continue
    return {"assistant_text": last_text.strip() or "変更案の生成に失敗しました。", "json": {"type": "full", "full": ctx_constraints}}

def generate_adjustment_rule(content: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """シフト調整ルールを生成する"""
    if MOCK_OPENAI or not _client:
        return {
            "assistant_text": "シフト調整案を生成しました。",
            "rule": {
                "type": "pair_not_together",
                "parameters": {
                    "employee_ids": [1, 2],
                    "description": "2人の同時配置を避ける調整"
                }
            }
        }
    
    sys = (
        "You are a shift adjustment rule generator. Generate adjustment rules from natural language. "
        "Output concise assistant_text and a strict JSON rule object. "
        "For requests about preventing two employees from working together (like '田中さんと佐藤さんを同じシフトに入れない'), use type 'pair_not_together'. "
        "For pair_not_together rules, use EXACTLY this format: {\"type\": \"pair_not_together\", \"a_employee_id\": int, \"b_employee_id\": int}. "
        "Match Japanese names with honorifics (さん) to employee IDs from the provided list. "
        "IMPORTANT: Use 'type' not 'rule_type', and use 'a_employee_id' and 'b_employee_id' not 'employees'. "
        "Rule types: pair_not_together, increase_staff_day, redistribute_shifts, time_slot_adjustment, add_employee_shift. "
        "Return only a short explanation first then the JSON object."
    )
    
    # 従業員マスタを取得
    employees = context.get("employees", [])
    employee_info = []
    for e in employees:
        if e.get("name") and e.get("id"):
            employee_info.append(f"{e['name']} (ID: {e['id']})")
    
    from datetime import date
    today = date.today()
    current_month = today.month
    current_year = today.year
    
    user = f"Available employees: {', '.join(employee_info)}\nCurrent date: {today.isoformat()} (month: {current_month}, year: {current_year})\nUser request: {content}"
    last_text = ""
    
    for _ in range(MAX_REPROMPTS + 1):
        try:
            r = _client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role":"system","content":sys},{"role":"user","content":user}],
                temperature=0.2,
                max_tokens=500,
                timeout=OPENAI_TIMEOUT_APPLY_MS/1000.0
            )
            txt = r.choices[0].message.content or ""
            last_text = txt
            js = _extract_json(txt)
            print(f"DEBUG: Raw OpenAI response: {txt}")
            print(f"DEBUG: Generated rule JSON: {js}")
            if isinstance(js, dict) and js.get("type") in ("pair_not_together", "increase_staff_day", "redistribute_shifts", "time_slot_adjustment", "add_employee_shift"):
                return {"assistant_text": txt.strip(), "rule": js}
        except Exception:
            continue
    
    return {"assistant_text": last_text.strip() or "調整ルールの生成に失敗しました。", "rule": None}

def generate_qa(content: str, context: Dict[str, Any]) -> str:
    if MOCK_OPENAI or not _client:
        return "現在の条件では週末の最小人員は1です。必要なら適用案を生成できます。"
    sys = "You are a helpful assistant for a call center shift optimization tool. Answer briefly and clearly in Japanese."
    user = content
    try:
        r = _client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys},{"role":"user","content":user}],
            temperature=0.3,
            max_tokens=300,
            timeout=OPENAI_TIMEOUT_QA_MS/1000.0
        )
        return (r.choices[0].message.content or "").strip()
    except Exception:
        return "回答の生成に失敗しました。"
