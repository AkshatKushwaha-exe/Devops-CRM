from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Contact, Deal, utcnow
from app.schemas import ContactInput, ContactPage, ContactRead, ContactStatus
from app.transactions import commit, record

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])
DB = Annotated[Session, Depends(get_db)]


def find_contact(db, contact_id):
    contact = db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found.")
    return contact


@router.get("", response_model=ContactPage)
def list_contacts(
    db: DB,
    search: str = Query("", max_length=120),
    status: ContactStatus | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
):
    query = select(Contact)
    if search.strip():
        term = search.strip()
        query = query.where(
            or_(
                Contact.name.icontains(term, autoescape=True),
                Contact.company.icontains(term, autoescape=True),
                Contact.email.icontains(term, autoescape=True),
            )
        )
    if status:
        query = query.where(Contact.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(Contact.created_at.desc(), Contact.id.desc()).offset(offset).limit(limit)
    ).all()
    return {"items": items, "total": total}


@router.post("", response_model=ContactRead, status_code=201)
def create_contact(data: ContactInput, db: DB):
    contact = Contact(**data.model_dump())
    db.add(contact)
    record(db, "contact_created", f"Added {contact.name} to contacts.")
    commit(db, "A contact with this email already exists.")
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(contact_id: int, db: DB):
    return find_contact(db, contact_id)


@router.put("/{contact_id}", response_model=ContactRead)
def update_contact(contact_id: int, data: ContactInput, db: DB):
    contact = find_contact(db, contact_id)
    for key, value in data.model_dump().items():
        setattr(contact, key, value)
    contact.updated_at = utcnow()
    record(db, "contact_updated", f"Updated contact {contact.name}.")
    commit(db, "A contact with this email already exists.")
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: DB):
    contact = find_contact(db, contact_id)
    if db.scalar(select(Deal.id).where(Deal.contact_id == contact_id).limit(1)):
        raise HTTPException(409, "This contact has deals. Delete or reassign those deals first.")
    record(db, "contact_deleted", f"Removed contact {contact.name}.")
    db.delete(contact)
    commit(db, "This contact has deals. Delete or reassign those deals first.")
    return Response(status_code=204)
