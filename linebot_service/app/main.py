from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any, Dict, Optional
import json as _json
import os
import httpx
import google.generativeai as genai
import logging

from linebot.v3 import WebhookHandler
from linebot.v3.messaging import MessagingApi, Configuration, ApiClient
from linebot.v3.messaging.models import ReplyMessageRequest, TextMessage, PushMessageRequest
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.webhooks import MessageEvent, TextMessageContent

from .config import settings


app = FastAPI(title="LINE Bot Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_secret = settings.line_channel_secret or "DUMMY"
_access_token = settings.line_channel_access_token or "DUMMY"
handler = WebhookHandler(_secret)
configuration = Configuration(access_token=_access_token)
api_client = ApiClient(configuration)
messaging_api = MessagingApi(api_client)

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://backend:8000")

if settings.gemini_api_key and genai:
    genai.configure(api_key=settings.gemini_api_key)

logger = logging.getLogger("linebot_service")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

PROMPT = (
    """
あなたは日本語のLINEメッセージからシフト変更リクエストを抽出するアシスタントです。
出力は必ず次のJSONスキーマに従ってください（日本語は使わず英数字キーのみ）。
{
  "intent": "absence|change_time|swap|add_shift|cancel_request",
  "date": "YYYY-MM-DD",
  "from_slot": "early|late|night|null",
  "to_slot": "early|late|night|null",
  "employee_name": "string|null",
  "target_employee_name": "string|null",
  "reason": "string|null"
}

intent の意味（厳密にこの定義に従って分類してください）:
- absence: その日の自分のシフトを欠勤・取り消したい（例:「出られない」「休みにしたい」「休ませてください」）。
- change_time: 同一日の自分のシフト時間帯を別の時間帯へ変更したい（例:「早番→遅番に変更」「夜勤を早番に」）。
- swap: 同一日のシフトを特定の相手と入れ替えたい（例:「佐藤さんと交代したい」「◯◯さんとシフトを交換」）。
- add_shift: その日に新しく勤務を追加したい（例:「金曜16-24で入れます」「夜勤を追加してください」）。
- cancel_request: シフト変更に該当しない、意図不明、または作成済み申請の取り消しなど。

JSONフィールドの意味（厳密にこの定義に従って値を埋めてください）:
- intent: 上記5種類のいずれか。ユーザーの要望に最も合致する1つを選ぶ。
- date: 対象日を ISO8601 日付(YYYY-MM-DD)。「今日/明日/今週金曜/来週月曜」等は今日基準で正規化。
- from_slot: 変更・入替の元となる時間帯。値は early|late|night のいずれか。該当なければ null。
- to_slot: 変更・追加・入替の先となる時間帯。値は early|late|night のいずれか。該当なければ null。
- employee_name: 申請者本人の氏名がテキストに含まれている場合だけ埋める。なければ null。
- target_employee_name: swap（入替）で相手の氏名が明記されている場合だけ埋める。なければ null。
- reason: 欠勤理由や変更理由などが書かれている場合だけ簡潔に抜き出す。なければ null。

スロット定義: early=08:00-16:00, late=16:00-00:00, night=00:00-08:00。
相対日付（明日/今週金曜/来週月曜など）は今日基準でYYYY-MM-DDに正規化してください。
入力が曖昧な場合でも最善の推定を行い、確信が低い値は null を返してください。
重要: 余計な説明文やコードフェンス( ``` )は一切出力せず、純粋なJSONのみを返してください。
    """
)

def normalize_to_iso_date(text: str) -> Optional[str]:
    # MVP: LLMに日付解決を委譲
    return None

def call_backend_create_request(payload: Dict[str, Any]) -> None:
    url = f"{BACKEND_BASE_URL}/api/shift-change"
    # ログ出力（バックエンドへ送るメッセージ）
    try:
        logger.info("POST %s payload=%s", url, payload)
    except Exception:
        # ログ変換で例外が出ても送信は継続
        pass
    with httpx.Client(timeout=10) as client:
        resp = client.post(url, json=payload)
        if 200 <= resp.status_code < 300:
            logger.info("Backend response status=%s", resp.status_code)
        else:
            body = None
            try:
                body = resp.text
            except Exception:
                body = "<unreadable>"
            logger.error("Backend error status=%s body=%s", resp.status_code, body)

def parse_with_gemini(message_text: str, today_iso: str) -> Dict[str, Any]:
    if not settings.gemini_api_key or not genai:
        logger.error("Gemini API key is not set")
        return {
            "intent": "cancel_request",
            "date": today_iso,
            "from_slot": None,
            "to_slot": None,
            "employee_name": None,
            "target_employee_name": None,
            "reason": None,
        }
    # Structured output per official docs: force JSON only
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    )
    prompt = f"今日は {today_iso} です。次のメッセージを解析: {message_text}\n{PROMPT}"
    resp = model.generate_content(prompt)
    text = resp.text or "{}"
    try:
        logger.info("Gemini response: %s", text)
        return _json.loads(text)
    except Exception:
        # Fallback: extract first JSON object if fenced or noisy
        import re
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return _json.loads(m.group(0))
            except Exception:
                logger.exception("Failed to parse fenced JSON from Gemini")
        else:
            logger.exception("Failed to parse with Gemini")
        return {
            "intent": "cancel_request",
            "date": today_iso,
            "from_slot": None,
            "to_slot": None,
            "employee_name": None,
            "target_employee_name": None,
            "reason": None,
        }

def generate_confirmation_message(parsed: Dict[str, Any], today_iso: str, original_message: str) -> str:
    intent = parsed.get("intent") or "cancel_request"
    date_value = parsed.get("date") or today_iso
    from_slot = parsed.get("from_slot")
    to_slot = parsed.get("to_slot")
    employee_name = parsed.get("employee_name")
    reason = parsed.get("reason")

    # Fallback plain summary if Gemini unusable
    if not settings.gemini_api_key or not genai:
        base = f"申請内容の確認: {intent} / {date_value}"
        if from_slot:
            base += f" from {from_slot}"
        if to_slot:
            base += f" to {to_slot}"
        if reason:
            base += f"（理由: {reason}）"
        return base

    jp_intent_hint = {
        "absence": "欠勤申請",
        "change_time": "時間帯変更",
        "swap": "入れ替え",
        "add_shift": "シフト追加",
        "cancel_request": "取消/不明",
    }.get(intent, "取消/不明")

    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config={
            "response_mime_type": "text/plain",
            "temperature": 0.2,
        },
    )

    prompt = (
        "あなたのタスクは、シフト作成の管理者として従業員からのLINEメッセージに返答をすることです。\n"
        "次のユーザー入力と解析結果を踏まえ、日本語で丁寧かつ簡潔に返答を1〜2文で作成してください。\n"
        "- 出力はテキストのみ（コードフェンス禁止）\n"
        "- 申請について確認する旨を伝える。そのほか、必要であればユーザーの入力に合わせて適切な返答をしてください。\n"
        f"ユーザー入力: {original_message}\n"
        f"意図: {jp_intent_hint}\n"
        f"日付: {date_value}\n"
        f"元時間帯(from): {from_slot or 'なし'}\n"
        f"先時間帯(to): {to_slot or 'なし'}\n"
        f"申請者名: {employee_name or '不明'}\n"
        f"理由: {reason or 'なし'}\n"
    )

    try:
        resp = model.generate_content(prompt)
        text = (resp.text or "").strip()
        # basic guard if model returns empty
        if not text:
            raise ValueError("empty confirmation")
        logger.info("Generated confirmation message: %s", text)
        return text
    except Exception as e:
        logger.error("Failed to generate confirmation with Gemini: %s", e)
        # Fallback summary
        base = f"申請内容の確認: {jp_intent_hint} / {date_value}"
        if from_slot:
            base += f"（{from_slot}）"
        if to_slot:
            base += f" → （{to_slot}）"
        if reason:
            base += f"（理由: {reason}）"
        return base

@app.get("/healthz")
async def healthz() -> Dict[str, Any]:
    return {"status": "ok"}


@app.post("/callback")
async def callback(request: Request) -> JSONResponse:
    signature = request.headers.get("X-Line-Signature")
    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Line-Signature header",
        )

    body = await request.body()
    body_text = body.decode("utf-8")
    try:
        handler.handle(body_text, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    return JSONResponse({"status": "ok"})


@handler.add(MessageEvent, message=TextMessageContent)
def handle_text_message(event) -> None:
    user_text = event.message.text
    user_id = event.source.user_id if hasattr(event, "source") else None
    today_iso = os.getenv("TODAY_OVERRIDE") or __import__("datetime").datetime.now().date().isoformat()

    parsed = parse_with_gemini(user_text, today_iso)

    # 解析結果ログ
    try:
        logger.info("Parsed intent from LINE: user_id=%s parsed=%s", user_id, parsed)
    except Exception:
        pass

    # 申請生成用のバックエンドpayloadへ変換
    intent = parsed.get("intent")
    date_value = parsed.get("date") or today_iso
    from_slot = parsed.get("from_slot")
    to_slot = parsed.get("to_slot")
    employee_name = parsed.get("employee_name")
    target_employee_name = parsed.get("target_employee_name")
    reason = parsed.get("reason")

    payload: Dict[str, Any] = {
        "type": intent,
        "date": date_value,
        "from_slot": from_slot,
        "to_slot": to_slot,
        "employee_name": employee_name,
        "reason": reason,
        "requested_via": "line",
        "line_user_id": user_id,
    }

    # swapの場合、target を名前で送る（サーバ側が best-effort で解決）
    if intent == "swap" and target_employee_name:
        payload["target_employee_id"] = None
        payload["target_employee_name"] = target_employee_name

    # バックエンドに申請作成（同期; エラーは無視してユーザー応答を優先）
    try:
        call_backend_create_request(payload)
    except Exception:
        logger.exception("Failed to post shift-change request to backend")

    # LLMで確認メッセージを生成
    summary = generate_confirmation_message(parsed, today_iso, user_text)

    messaging_api.reply_message(
        ReplyMessageRequest(
            replyToken=event.reply_token,
            messages=[TextMessage(text=summary)],
        )
    )


@app.post("/notify/approval")
async def notify_approval(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Internal endpoint: send approval notification to a LINE user.
    Expected payload: { "line_user_id": str, "message": str }
    """
    user_id = payload.get("line_user_id")
    message = payload.get("message") or "申請が承認されました。"
    if not user_id:
        raise HTTPException(status_code=400, detail="line_user_id is required")

    try:
        messaging_api.push_message(
            PushMessageRequest(to=user_id, messages=[TextMessage(text=message)])
        )
        logger.info("Sent approval notification to user_id=%s", user_id)
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to send approval notification: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send notification")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_reload,
    )

