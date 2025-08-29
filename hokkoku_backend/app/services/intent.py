from typing import Dict, Any, Tuple
from ..config import INTENT_THRESHOLD
from . import openai_client

def route(mode: str, content: str, context: Dict[str, Any]) -> Tuple[str, float]:
    if mode == "apply":
        return "apply", 1.0
    if mode == "qa":
        return "qa", 1.0
    if mode == "adjust":
        return "adjust", 1.0
    result = openai_client.detect_intent(content, context)
    intent = result.get("intent", "qa")
    confidence = float(result.get("confidence", 0.0))
    if confidence < INTENT_THRESHOLD:
        return "qa", confidence
    return intent, confidence
