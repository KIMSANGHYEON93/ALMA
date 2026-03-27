FROM python:3.13-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv

# Python deps (copy src/ for setuptools find_packages)
COPY pyproject.toml .
COPY src/ ./src/
RUN uv pip install --system . && rm -rf /root/.cache

# Alembic migrations
COPY alembic/ ./alembic/
COPY alembic.ini .

# Entrypoint: migrate then start
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV PYTHONPATH=/app/src
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "alma.main:app", "--host", "0.0.0.0", "--port", "8000"]
