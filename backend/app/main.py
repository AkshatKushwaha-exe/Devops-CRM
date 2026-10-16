from time import perf_counter

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.routes import contacts, dashboard, deals

app = FastAPI(
    title="DevOps CRM",
    version="0.1.0",
    description="A focused local sales workspace.",
    # Served under /api so the same proxy route reaches the docs locally and behind Ingress.
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.include_router(contacts.router)
app.include_router(deals.router)
app.include_router(dashboard.router)

requests = Counter("crm_http_requests_total", "HTTP requests", ["method", "route", "status"])
latency = Histogram("crm_http_request_duration_seconds", "HTTP latency", ["method", "route"])


@app.middleware("http")
async def measure_requests(request: Request, call_next):
    start = perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", "unmatched")
        if path != "/metrics":
            requests.labels(request.method, path, str(status)).inc()
            latency.labels(request.method, path).observe(perf_counter() - start)


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database unavailable. Check the database connection and apply migrations."
        },
    )


@app.get("/health", tags=["Operations"])
def health():
    return {"status": "ok"}


@app.get("/ready", tags=["Operations"])
def ready(db: Session = Depends(get_db)):
    # Verify the application schema as well as database connectivity.
    db.execute(text("SELECT id FROM contacts LIMIT 1"))
    db.execute(text("SELECT id FROM deals LIMIT 1"))
    db.execute(text("SELECT id FROM activities LIMIT 1"))
    return {"status": "ready"}


@app.get("/api/version", tags=["Operations"])
def version():
    """The build running in this pod: lets a deployment be verified end to end."""
    return {"version": settings.app_version}


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})
