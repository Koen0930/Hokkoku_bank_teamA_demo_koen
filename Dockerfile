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
RUN cd hokkoku_backend && poetry config virtualenvs.create false && poetry install --only main --no-interaction --no-ansi --no-root

# install linebot deps
COPY linebot_service/pyproject.toml linebot_service/poetry.lock linebot_service/
RUN cd linebot_service && poetry config virtualenvs.create false && poetry install --only main --no-interaction --no-ansi --no-root

# --- Final runtime image ---
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx supervisor && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python dependencies from build stage
COPY --from=python-base /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Copy application code
COPY hokkoku_backend hokkoku_backend
COPY linebot_service linebot_service

# Copy frontend build
COPY --from=frontend-build /app/hokkoku_frontend/dist /usr/share/nginx/html

# Copy nginx config (modified for single container)
COPY nginx-single.conf /etc/nginx/nginx.conf

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create necessary directories for logs
RUN mkdir -p /var/log/supervisor /var/log/nginx /var/log/backend /var/log/linebot

# Set permissions
RUN chown -R www-data:www-data /usr/share/nginx/html

# Expose ports: frontend(80), backend(8000), linebot(8082)
EXPOSE 80 8000 8082

# Start all services with supervisord
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"