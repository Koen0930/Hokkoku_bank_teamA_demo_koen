# Multi-stage build for LINE Bot FastAPI service
FROM python:3.12-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Set work directory
WORKDIR /app

# Copy Poetry files
COPY pyproject.toml poetry.lock ./

# Configure Poetry
RUN poetry config virtualenvs.create false

# Ensure lock file matches pyproject and install dependencies
RUN (poetry lock --no-update || poetry lock)
RUN poetry install --only=main --no-root

# Production stage
FROM python:3.12-slim

# Set work directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY app/ ./app/

# Expose port (matches APP_PORT default)
EXPOSE 8082

# Default environment (can be overridden by compose)
ENV APP_HOST=0.0.0.0 \
    APP_PORT=8082 \
    APP_RELOAD=false

# Start the server
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]


