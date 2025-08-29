from typing import List, Dict, Any, Tuple
from ..schemas import JsonPatchOp, DiffSummary

def _split_path(path: str) -> List[str]:
    p = path.strip("/")
    return [] if not p else [seg.replace("~1", "/").replace("~0", "~") for seg in p.split("/")]

def _get_parent_and_key(doc: Dict[str, Any], path: str) -> Tuple[Dict[str, Any], str]:
    parts = _split_path(path)
    if not parts:
        return doc, ""
    cur = doc
    for seg in parts[:-1]:
        if seg not in cur or not isinstance(cur[seg], dict):
            cur[seg] = {}
        cur = cur[seg]
    return cur, parts[-1]

def apply_patch(base: Dict[str, Any], patch: List[JsonPatchOp]) -> Dict[str, Any]:
    out = dict(base)
    for op in patch:
        parent, key = _get_parent_and_key(out, op.path)
        if op.op == "add" or op.op == "replace":
            parent[key] = op.value
        elif op.op == "remove":
            if key in parent:
                del parent[key]
    return out

def materialize(spec: Dict[str, Any], base: Dict[str, Any]) -> Dict[str, Any]:
    t = spec.get("type")
    if t == "patch":
        patch = [JsonPatchOp(**p) if isinstance(p, dict) else p for p in spec.get("patch", [])]
        return apply_patch(base, patch)
    if t == "full":
        full = spec.get("full", {})
        return dict(full)
    return dict(base)

def _collect_paths(d: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    acc: Dict[str, Any] = {}
    for k, v in d.items():
        p = f"{prefix}/{k}"
        if isinstance(v, dict):
            acc.update(_collect_paths(v, p))
        else:
            acc[p] = v
    return acc

def summarize_diff(before: Dict[str, Any], after: Dict[str, Any]) -> DiffSummary:
    b = _collect_paths(before)
    a = _collect_paths(after)
    changed = []
    highlights: Dict[str, str] = {}
    for p, v in a.items():
        if p not in b or b[p] != v:
            changed.append(p)
            highlights[p] = f"{b.get(p)} -> {v}"
    for p, v in b.items():
        if p not in a:
            changed.append(p)
            highlights[p] = f"{v} -> None"
    changed_sorted = sorted(set(changed))
    return DiffSummary(changed_paths=changed_sorted, highlights=highlights, estimated_impact=f"{len(changed_sorted)} changes")
