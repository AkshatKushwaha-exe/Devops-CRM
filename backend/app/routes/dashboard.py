from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Activity, Contact, Deal
from app.schemas import ActivityRead, DashboardRead, DealStage

router = APIRouter(prefix="/api", tags=["Overview"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(db: DB):
    rows = db.execute(
        select(Deal.stage, func.count(Deal.id), func.sum(Deal.value)).group_by(Deal.stage)
    ).all()
    grouped = {stage: (count, value) for stage, count, value in rows}
    stages = [
        {
            "stage": stage,
            "count": grouped.get(stage, (0, 0))[0],
            "value": grouped.get(stage, (0, Decimal("0.00")))[1],
        }
        for stage in DealStage
    ]
    open_stages = [s for s in stages if s["stage"] not in ("won", "lost")]
    won = grouped.get("won", (0, Decimal("0.00")))
    closed_count = won[0] + grouped.get("lost", (0, 0))[0]
    return {
        "total_contacts": db.scalar(select(func.count(Contact.id))),
        "active_deals": sum(s["count"] for s in open_stages),
        "pipeline_value": sum((s["value"] for s in open_stages), Decimal("0.00")),
        "won_revenue": won[1],
        "win_rate": round(won[0] / closed_count * 100, 1) if closed_count else 0,
        "stages": stages,
        "upcoming_deals": db.scalars(
            select(Deal)
            .where(Deal.stage.notin_(["won", "lost"]), Deal.expected_close.is_not(None))
            .order_by(Deal.expected_close, Deal.id)
            .limit(5)
        )
        .unique()
        .all(),
        "recent_activity": db.scalars(
            select(Activity).order_by(Activity.created_at.desc(), Activity.id.desc()).limit(6)
        ).all(),
    }


@router.get("/activities", response_model=list[ActivityRead])
def activities(db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return db.scalars(
        select(Activity)
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
