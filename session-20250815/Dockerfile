FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# アプリコード（backend）のみコピーして軽量化
COPY hokkoku_backend/ /app/hokkoku_backend/

WORKDIR /app/hokkoku_backend
RUN python -m pip install -U pip && \
    pip install -e .

# 既定はReal想定（必要に応じてcompose/envで上書き）
ENV MOCK_OPENAI=false \
    OPENAI_MODEL=gpt-4o-mini \
    CORS_ALLOW_ORIGINS=*

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
