FROM python:3.13-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || true

COPY backend/src/ src/
RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "alma.main:app", "--host", "0.0.0.0", "--port", "8000"]
