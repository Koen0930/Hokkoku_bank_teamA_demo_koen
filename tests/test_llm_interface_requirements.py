from pathlib import Path
import re

DOC = Path(__file__).resolve().parents[1] / "requirements" / "08_llm_interface_requirements.md"

def test_document_exists():
    assert DOC.exists(), f"Missing document: {DOC}"

def read_text():
    return DOC.read_text(encoding="utf-8", errors="ignore")

def has(pattern: str, text: str):
    return re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE | re.DOTALL) is not None

def test_includes_dual_modes_and_routing():
    t = read_text()
    assert has(r"\bApply\b|\b適用モード\b", t)
    assert has(r"\bQ&amp;A\b|\bQ&A\b|\bQA\b|Ｑ＆Ａ|ＱＡ", t)
    assert has(r"\bintent\b", t)
    assert has(r"\bconfidence\b|信頼度", t)
    assert has(r"自動.*判定|自動.*ルーティング|automatic.*intent", t)
    assert has(r"(手動\s*切替|手動で\s*切替|手動.*切り替え|モード.*手動|トグル|切替\s*可能|manual\s*(?:override|switch|toggle))", t)

def test_includes_openai_and_pii_policies():
    t = read_text()
    assert has(r"\bOpenAI\b", t)
    assert has(r"PII|個人情報", t)
    assert has(r"匿名化|ID化|anonym", t)

def test_json_format_and_validation_pipeline():
    t = read_text()
    assert has(r"JSON\s*Patch|RFC\s*6902", t)
    assert has(r"\bfull\s*json\b|フルJSON", t)
    assert has(r"JSON\s*Schema|スキーマ", t)
    assert has(r"検証|validation", t)
    assert has(r"再プロンプト|re[- ]?prompt|リトライ", t)

def test_default_apply_mode_and_rbac():
    t = read_text()
    assert has(r"Draft|ドラフト", t)
    assert has(r"Immediate|即時", t)
    assert has(r"管理者|admin|RBAC", t)

def test_retention_and_audit():
    t = read_text()
    assert has(r"1\s*年|one\s*year", t)
    assert has(r"監査|audit", t)

def test_api_and_ws_endpoints_present():
    t = read_text()
    assert has(r"/api/llm/sessions", t)
    assert has(r"/api/llm/sessions/.*/messages", t)
    assert has(r"/api/constraints/validate", t)
    assert has(r"/api/constraints/apply", t)
    assert has(r"/ws/llm", t)
    assert has(r"/ws/optimization", t)

def test_acceptance_criteria_keywords():
    t = read_text()
    assert has(r"受入|受け入れ|acceptance", t)
    assert has(r"QA.*自然言語|自然言語.*QA|Q&A.*自然言語", t)
    assert has(r"差分|diff|プレビュー", t)
    assert has(r"承認|approve|適用", t)
    assert has(r"検証.*失敗|validation.*fail|エラー", t)

def test_performance_targets_present():
    t = read_text()
    assert has(r"p95|p50|パーセンタイル", t) or has(r"応答.*秒|秒.*応答", t)
