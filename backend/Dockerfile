# syntax=docker/dockerfile:1.7
# FastAPI backend: dependencies resolved from uv.lock, runtime as an unprivileged user.

FROM python:3.12.15-alpine3.24 AS build
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

FROM python:3.12.15-alpine3.24 AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="devops-crm-backend" \
      org.opencontainers.image.source="https://github.com/AkshatKushwaha-exe/Devops-CRM" \
      org.opencontainers.image.version="${VERSION}"
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# Remove pip from the runtime image: the app runs from /opt/venv and never installs packages.
RUN addgroup -S -g 10001 crm \
    && adduser -S -D -H -u 10001 -G crm -s /sbin/nologin crm \
    && python -m pip uninstall -y pip
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]
# Migrations are a separate, explicit step: `python -m app.migrate upgrade`.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
