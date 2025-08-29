# --- Frontend build stage ---
    FROM node:20-alpine AS frontend-build
    WORKDIR /app
    COPY hokkoku_frontend/package*.json hokkoku_frontend/
    RUN cd hokkoku_frontend && npm ci
    COPY hokkoku_frontend hokkoku_frontend
    RUN cd hokkoku_frontend && npm run build
    
    # --- Python base stage (deps for backend & linebot) ---
    FROM python:3.12-slim AS python-base
    ENV PIP_NO_CACHE_DIR=1 \
        PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1
    RUN apt-get update && apt-get install -y --no-install-recommends \
          build-essential curl && \
        pip install --no-cache-dir poetry && \
        apt-get clean && rm -rf /var/lib/apt/lists/*
    
    WORKDIR /app
    
    # install backend deps
    COPY hokkoku_backend/pyproject.toml hokkoku_backend/poetry.lock hokkoku_backend/
    RUN cd hokkoku_backend && poetry config virtualenvs.create false && poetry install --only main --no-interaction --no-ansi
    
    # install linebot deps
    COPY linebot_service/pyproject.toml linebot_service/poetry.lock linebot_service/
    RUN cd linebot_service && poetry config virtualenvs.create false && poetry install --only main --no-interaction --no-ansi
    
    # --- Final runtime image ---
    FROM python:3.12-slim
    ENV PYTHONUNBUFFERED=1
    RUN apt-get update && apt-get install -y --no-install-recommends \
          nginx supervisor && \
        apt-get clean && rm -rf /var/lib/apt/lists/*
    
    WORKDIR /app
    
    # apps
    COPY hokkoku_backend hokkoku_backend
    COPY linebot_service linebot_service
    
    # frontend build
    COPY --from=frontend-build /app/hokkoku_frontend/dist /usr/share/nginx/html
    
    # nginx config（必要なら既存の nginx.conf を COPY）
    # COPY hokkoku_frontend/nginx.conf /etc/nginx/nginx.conf
    
    # supervisord config
    COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
    
    # ポート公開: フロント80/バック8000/LINEBOT8082
    EXPOSE 80 8000 8082
    
    # 静的ファイル所有者調整（任意）
    RUN chown -R www-data:www-data /usr/share/nginx/html
    
    # 起動（nginx/uvicorn*2 を supervisor で）
    CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]