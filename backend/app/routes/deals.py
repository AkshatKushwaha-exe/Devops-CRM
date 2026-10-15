from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Contact, Deal, utcnow
from app.routes.contacts import find_contact
from app.schemas import DealInput, DealPage, DealRead, DealStage, StageUpdate
from app.transactions import commit, record

router = APIRouter(prefix="/api/deals", tags=["Deals"])
DB = Annotated[Session, Depends(get_db)]


def find_deal(db, deal_id):
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(404, "Deal not found.")
    return deal


@router.get("", response_model=DealPage)
def list_deals(
    db: DB,
    search: str = Query("", max_length=120),
    stage: DealStage | None = None,
    contact_id: int | None = Query(None, gt=0),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
):
    query = select(Deal).join(Contact)
    if search.strip():
        term = search.strip()
        query = query.where(
            or_(
                Deal.title.icontains(term, autoescape=True),
                Contact.name.icontains(term, autoescape=True),
                Contact.company.icontains(term, autoescape=True),
            )
        )
    if stage:
        query = query.where(Deal.stage == stage)
    if contact_id:
        query = query.where(Deal.contact_id == contact_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = (
        db.scalars(
            query.order_by(Deal.updated_at.desc(), Deal.id.desc()).offset(offset).limit(limit)
        )
        .unique()
        .all()
    )
    return {"items": items, "total": total}


@router.post("", response_model=DealRead, status_code=201)
def create_deal(data: DealInput, db: DB):
    find_contact(db, data.contact_id)
    deal = Deal(**data.model_dump())
    db.add(deal)
    record(db, "deal_created", f"Created deal {deal.title}.")
    commit(db, "The selected contact is no longer available.")
    db.refresh(deal)
    return deal


@router.get("/{deal_id}", response_model=DealRead)
def get_deal(deal_id: int, db: DB):
    return find_deal(db, deal_id)


@router.put("/{deal_id}", response_model=DealRead)
def update_deal(deal_id: int, data: DealInput, db: DB):
    deal = find_deal(db, deal_id)
    find_contact(db, data.contact_id)
    previous = deal.stage
    for key, value in data.model_dump().items():
        setattr(deal, key, value)
    deal.updated_at = utcnow()
    if previous != deal.stage:
        record(db, "stage_changed", f"Moved {deal.title} from {previous} to {deal.stage}.")
    else:
        record(db, "deal_updated", f"Updated deal {deal.title}.")
    commit(db, "The selected contact is no longer available.")
    db.refresh(deal)
    return deal


@router.patch("/{deal_id}/stage", response_model=DealRead)
def update_stage(deal_id: int, data: StageUpdate, db: DB):
    deal = find_deal(db, deal_id)
    if deal.stage != data.stage:
        record(db, "stage_changed", f"Moved {deal.title} from {deal.stage} to {data.stage}.")
        deal.stage = data.stage
        deal.updated_at = utcnow()
        commit(db, "The deal could not be updated. Please reload and try again.")
        db.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=204)
def delete_deal(deal_id: int, db: DB):
    deal = find_deal(db, deal_id)
    record(db, "deal_deleted", f"Removed deal {deal.title}.")
    db.delete(deal)
    commit(db, "The deal could not be deleted.")
    return Response(status_code=204)
