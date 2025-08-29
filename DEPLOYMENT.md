# Deployment Guide

This document outlines how to deploy the three services to public HTTPS URLs.

Services:
- Backend: FastAPI (port 8000)
- Linebot: FastAPI (port 8082)
- Frontend: React + Vite (static build in hokkoku_frontend/dist)

Environment variables:
- Use the variables listed in .env.example. Provide secret values in the hosting platform, not in the repository.


## Backend (FastAPI) deployment

- App directory: hokkoku_backend
- Start command: uvicorn app.main:app --host 0.0.0.0 --port 8000
- Required env:
  - OPENAI_API_KEY
  - GEMINI_API_KEY (optional)
  - CORS_ALLOW_ORIGINS
  - OPENAI_MODEL
  - APP_HOST=0.0.0.0
  - APP_PORT=8000
- Health: https://<backend>/docs should return 200


## Linebot (FastAPI) deployment

- App directory: linebot_service
- Start command: uvicorn app.main:app --host 0.0.0.0 --port 8082
- Required env:
  - LINE_CHANNEL_SECRET
  - LINE_CHANNEL_ACCESS_TOKEN
  - OPENAI_API_KEY (if LLM features enabled)
  - APP_HOST=0.0.0.0
  - APP_PORT=8082
- Health: https://<linebot>/docs should return 200
- Note: LINE developer console webhook URL should point to https://<linebot>/callback (if applicable)


## Frontend (Vite) deployment

- App directory: hokkoku_frontend
- Build command: npm ci && npm run build
- Output directory: dist
- Required env (build-time):
  - VITE_API_URL=https://<backend-url>
- Health: https://<frontend>/ should load the app, and network calls should target https://<backend-url>


## CORS

Set CORS_ALLOW_ORIGINS to the deployed frontend origin (e.g., https://example.pages.dev). During initial verification you can use * and then restrict to the exact origin.


## Verification checklist

- Backend:
  - curl -sS https://<backend>/docs | head -n1 returns HTML
- Linebot:
  - curl -sS https://<linebot>/docs | head -n1 returns HTML
- Frontend:
  - Open https://<frontend> and verify API calls succeed to https://<backend> without CORS errors


## Notes

- Do not commit secrets to the repository.
- Update README if deployment URLs or steps change.
