"""Insert fictional demo records into an empty database, only when explicitly requested."""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Activity, Contact, Deal, utcnow


def seed():
    with SessionLocal() as db:
        if any(db.scalar(select(func.count(model.id))) for model in (Contact, Deal, Activity)):
            print("Database already contains records; demo seed skipped.")
            return
        people = [
            ("Aarav Mehta", "aarav@northstar.example", "Northstar Studio", "customer"),
            ("Priya Sharma", "priya@bloom.example", "Bloom & Co.", "lead"),
            ("Rohan Kapoor", "rohan@orbit.example", "Orbit Labs", "lead"),
            ("Ananya Rao", "ananya@paperplane.example", "Paperplane", "customer"),
            ("Kabir Sethi", "kabir@forma.example", "Forma Design", "lead"),
            ("Meera Iyer", "meera@evergreen.example", "Evergreen", "lead"),
            ("Dev Patel", "dev@stackwise.example", "Stackwise", "customer"),
            ("Isha Das", "isha@kindred.example", "Kindred Collective", "inactive"),
        ]
        contacts = []
        for i, (name, email, company, status) in enumerate(people):
            contact = Contact(
                name=name,
                email=email,
                company=company,
                status=status,
                phone="",
                notes="Fictional demo contact. Replace with your own records.",
                created_at=utcnow() - timedelta(days=14 - i),
            )
            db.add(contact)
            contacts.append(contact)
        db.flush()
        opportunities = [
            ("Website redesign", 0, "85000", "proposal", 4),
            ("Brand identity package", 1, "45000", "qualified", 7),
            ("Customer portal", 2, "150000", "new", 14),
            ("Annual support plan", 3, "60000", "won", -2),
            ("Design system", 4, "95000", "proposal", 9),
            ("Commerce storefront", 5, "120000", "qualified", 12),
            ("Analytics dashboard", 6, "75000", "won", -5),
            ("Discovery workshop", 7, "20000", "lost", -7),
            ("Mobile app discovery", 0, "35000", "new", 18),
        ]
        for i, (title, person, value, stage, days) in enumerate(opportunities):
            db.add(
                Deal(
                    title=title,
                    contact_id=contacts[person].id,
                    value=Decimal(value),
                    stage=stage,
                    expected_close=date.today() + timedelta(days=days),
                    notes="Fictional opportunity for exploring the CRM.",
                    created_at=utcnow() - timedelta(days=10 - i),
                )
            )
        for i, (kind, message) in enumerate(
            [
                ("stage_changed", "Moved Website redesign from qualified to proposal."),
                ("deal_created", "Created deal Mobile app discovery."),
                ("contact_created", "Added Meera Iyer to contacts."),
                ("stage_changed", "Moved Annual support plan from proposal to won."),
                ("contact_updated", "Updated contact Aarav Mehta."),
                ("deal_created", "Created deal Commerce storefront."),
            ]
        ):
            db.add(
                Activity(
                    kind=kind, message=message, created_at=utcnow() - timedelta(hours=i * 3 + 1)
                )
            )
        db.commit()
        print("Created 8 fictional contacts, 9 deals, and 6 activity entries.")


if __name__ == "__main__":
    seed()
