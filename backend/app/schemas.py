from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ContactStatus(StrEnum):
    lead = "lead"
    customer = "customer"
    inactive = "inactive"


class DealStage(StrEnum):
    new = "new"
    qualified = "qualified"
    proposal = "proposal"
    won = "won"
    lost = "lost"


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ContactInput(InputModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr = Field(max_length=254)
    phone: str = Field(default="", max_length=40)
    company: str = Field(default="", max_length=120)
    status: ContactStatus = ContactStatus.lead
    notes: str = Field(default="", max_length=5000)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class ContactRead(ContactInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class DealInput(InputModel):
    title: str = Field(min_length=1, max_length=160)
    contact_id: int = Field(gt=0)
    value: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stage: DealStage = DealStage.new
    expected_close: date | None = None
    notes: str = Field(default="", max_length=5000)


class DealRead(DealInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contact: ContactRead
    created_at: datetime
    updated_at: datetime


class StageUpdate(InputModel):
    stage: DealStage


class ContactPage(BaseModel):
    items: list[ContactRead]
    total: int


class DealPage(BaseModel):
    items: list[DealRead]
    total: int


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    message: str
    created_at: datetime


class StageSummary(BaseModel):
    stage: DealStage
    count: int
    value: Decimal


class DashboardRead(BaseModel):
    total_contacts: int
    active_deals: int
    pipeline_value: Decimal
    won_revenue: Decimal
    win_rate: float
    stages: list[StageSummary]
    upcoming_deals: list[DealRead]
    recent_activity: list[ActivityRead]
