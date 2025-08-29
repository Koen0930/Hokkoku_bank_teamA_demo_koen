import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.llm import router as llm_router
from app.routers.constraints import router as constraints_router
from app import store
from app.services import openai_client

@pytest.fixture(autouse=True)
def reset_store():
    store.sessions.clear()
    store.messages.clear()
    store.constraint_versions.clear()
    store.audit_logs.clear()
    store.current_constraints = {"min_staff_weekend": 1, "weights": {"weekend_minimum": 1.0}}
    yield

@pytest.fixture
def app_client():
    app = FastAPI()
    app.include_router(llm_router)
    app.include_router(constraints_router)
    return TestClient(app)

def test_create_session_and_qa_flow(monkeypatch, app_client: TestClient):
    def fake_detect(content, ctx):
        return {"intent": "qa", "confidence": 0.5}
    def fake_qa(content, ctx):
        return "QA回答です"
    monkeypatch.setattr(openai_client, "detect_intent", fake_detect)
    monkeypatch.setattr(openai_client, "generate_qa", fake_qa)

    r = app_client.post("/api/llm/sessions", json={})
    assert r.status_code == 200
    sid = r.json()["session_id"]

    r2 = app_client.post(f"/api/llm/sessions/{sid}/messages", json={"content": "説明して", "mode": "auto"})
    assert r2.status_code == 200
    j = r2.json()
    assert j["intent"] == "qa"
    assert j["assistant_text"] == "QA回答です"

def test_apply_flow_with_validation_and_diff(monkeypatch, app_client: TestClient):
    def fake_detect(content, ctx):
        return {"intent": "apply", "confidence": 0.9}
    def fake_apply(content, ctx):
        return {"assistant_text": "適用案", "json": {"type": "patch", "patch": [{"op": "replace", "path": "/min_staff_weekend", "value": 2}]}}
    monkeypatch.setattr(openai_client, "detect_intent", fake_detect)
    monkeypatch.setattr(openai_client, "generate_apply", fake_apply)

    sid = app_client.post("/api/llm/sessions", json={}).json()["session_id"]

    r = app_client.post(f"/api/llm/sessions/{sid}/messages", json={"content": "週末最小+1", "mode": "auto"})
    assert r.status_code == 200
    j = r.json()
    assert j["intent"] == "apply"
    assert j["validation"]["ok"] is True
    assert j["diff_summary"]["changed_paths"]

def test_constraints_validate_and_apply_rbac(app_client: TestClient):
    bad = app_client.post("/api/constraints/validate", json={"constraints_json": {"min_staff_weekend": -1}})
    assert bad.status_code == 200
    assert bad.json()["ok"] is False

    ok = app_client.post("/api/constraints/validate", json={"constraints_json": {"min_staff_weekend": 3}})
    assert ok.json()["ok"] is True

    draft = app_client.post("/api/constraints/apply", json={"constraints_json": {"min_staff_weekend": 3}, "apply_mode": "draft"})
    assert draft.status_code == 200

    immediate_no_admin = app_client.post("/api/constraints/apply", json={"constraints_json": {"min_staff_weekend": 2}, "apply_mode": "immediate"})
    assert immediate_no_admin.status_code == 403

    immediate_admin = app_client.post("/api/constraints/apply", headers={"X-Role": "admin"}, json={"constraints_json": {"min_staff_weekend": 2}, "apply_mode": "immediate"})
    assert immediate_admin.status_code == 200
