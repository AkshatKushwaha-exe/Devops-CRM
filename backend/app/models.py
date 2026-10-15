from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow():
    return datetime.now(UTC)


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        CheckConstraint("status IN ('lead', 'customer', 'inactive')", name="contact_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(120), default="", index=True)
    status: Mapped[str] = mapped_column(String(20), default="lead", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deals: Mapped[list["Deal"]] = relationship(back_populates="contact", passive_deletes="all")


class Deal(Base):
    __tablename__ = "deals"
    __table_args__ = (
        CheckConstraint("value >= 0", name="deal_value_nonnegative"),
        CheckConstraint("stage IN ('new','qualified','proposal','won','lost')", name="deal_stage"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.id", ondelete="RESTRICT"), index=True
    )
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stage: Mapped[str] = mapped_column(String(20), default="new", index=True)
    expected_close: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    contact: Mapped[Contact] = relationship(back_populates="deals", lazy="joined")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
