"""Create contacts, deals, and activity history."""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("company", sa.String(120), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("status IN ('lead', 'customer', 'inactive')", name="contact_status"),
    )
    op.create_index("ix_contacts_company", "contacts", ["company"])
    op.create_index("ix_contacts_status", "contacts", ["status"])
    op.create_table(
        "deals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column(
            "contact_id",
            sa.Integer(),
            sa.ForeignKey("contacts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("value", sa.Numeric(12, 2), nullable=False),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("expected_close", sa.Date()),
        sa.Column("notes", sa.Text(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("value >= 0", name="deal_value_nonnegative"),
        sa.CheckConstraint(
            "stage IN ('new','qualified','proposal','won','lost')", name="deal_stage"
        ),
    )
    op.create_index("ix_deals_contact_id", "deals", ["contact_id"])
    op.create_index("ix_deals_stage", "deals", ["stage"])
    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("message", sa.String(400), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_activities_created_at", "activities", ["created_at"])


def downgrade():
    op.drop_table("activities")
    op.drop_table("deals")
    op.drop_table("contacts")
