from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.models import Activity


def record(db, kind: str, message: str):
    db.add(Activity(kind=kind, message=message))


def commit(db, conflict: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=conflict) from None
