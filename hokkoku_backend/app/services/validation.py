from typing import Dict, Any, Tuple, List
from ..schemas import ValidationErrorItem

def validate_constraints(candidate: Dict[str, Any]) -> Tuple[bool, List[ValidationErrorItem], Dict[str, Any] | None]:
    errors: List[ValidationErrorItem] = []
    if not isinstance(candidate, dict):
        return False, [ValidationErrorItem(path="", message="must be object")], None
    if "min_staff_weekend" in candidate:
        v = candidate["min_staff_weekend"]
        if not isinstance(v, int) or v < 0:
            errors.append(ValidationErrorItem(path="/min_staff_weekend", message="must be integer >= 0"))
    if "weights" in candidate:
        w = candidate["weights"]
        if not isinstance(w, dict):
            errors.append(ValidationErrorItem(path="/weights", message="must be object"))
        else:
            if "weekend_minimum" in w:
                val = w["weekend_minimum"]
                if not isinstance(val, (int, float)) or val < 0:
                    errors.append(ValidationErrorItem(path="/weights/weekend_minimum", message="must be number >= 0"))
    ok = len(errors) == 0
    normalized = dict(candidate) if ok else None
    return ok, errors, normalized
