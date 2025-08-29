import pytest
from app.services.validation import validate_constraints
from app.services.diff import materialize, summarize_diff

def test_validation_ok():
    ok, errors, normalized = validate_constraints({"min_staff_weekend": 2, "weights": {"weekend_minimum": 1.5}})
    assert ok
    assert errors == []
    assert normalized["min_staff_weekend"] == 2

def test_validation_ng():
    ok, errors, normalized = validate_constraints({"min_staff_weekend": -1})
    assert not ok
    assert any(e.path == "/min_staff_weekend" for e in errors)

def test_materialize_patch_and_diff():
    base = {"min_staff_weekend": 1, "weights": {"weekend_minimum": 1.0}}
    spec = {"type": "patch", "patch": [{"op": "replace", "path": "/min_staff_weekend", "value": 3}]}
    after = materialize(spec, base)
    assert after["min_staff_weekend"] == 3
    d = summarize_diff(base, after)
    assert "/min_staff_weekend" in d.changed_paths
