## LINE Bot Service (Standalone)

This is an independent FastAPI service for LINE Messaging API. It is intentionally isolated from the existing backend/frontend to allow separate development and future integration.

### Features
- FastAPI server with `/healthz` and `/callback` (LINE Webhook)
- Signature verification using LINE official SDK
- Minimal echo bot handler
- Environment-based configuration via Pydantic Settings

### Prerequisites
- Python 3.12
- LINE Developers Messaging API channel
  - Channel Secret
  - Channel Access Token (long-lived)

### Setup
1. Install with Poetry
   ```bash
   cd linebot_service
   poetry install
   ```

2. Configure environment
   ```bash
   cp env.example .env
   # Fill in:
   # LINE_CHANNEL_SECRET=...
   # LINE_CHANNEL_ACCESS_TOKEN=...
   # GEMINI_API_KEY=...  # Google Generative AI (Gemini)
   ```

3. Run server
   ```bash
   poetry run fastapi dev app/main.py --host 0.0.0.0 --port 8082
   # or
   poetry run uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
   ```

4. Expose webhook locally (optional)
   - Using ngrok:
     ```bash
     ngrok http http://localhost:8082
     ```
   - Set the public URL + `/callback` in LINE Developers Console as the Webhook URL
   - Turn on "Use webhook" and turn off "Auto-reply messages"

### Endpoints
- GET `/healthz` → {"status": "ok"}
- POST `/callback` → receives LINE webhook events

### Notes for future integration
- This service can call the existing backend (`hokkoku_backend`) APIs via HTTP, or share a message queue in the future.
- Keep LINE channel secrets and tokens outside source control; never commit `.env`.
 - By default, backend base URL is `http://backend:8000` (Docker Compose network). Override with `BACKEND_BASE_URL`.


