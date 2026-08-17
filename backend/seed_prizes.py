"""Seed initial prize inventory. Safe to run multiple times — skips if already seeded.

The seed data in this file is intentionally generic (no real names, no
brand-specific items). Real event data is uploaded per-event via the
admin panel's CSV import (see `prizes.csv` for the template and
`POST /admin/prizes/import` for the endpoint).
"""
import json
from database import engine, SessionLocal
from models import Base, Prize

PRIZES = [
    {
        "segment_number": 1,
        "display_name": "Prize Bucket A",
        "wheel_label": "Bucket A",
        "winner_message": "An item of your choice from Prize Bucket A!",
        "description": "Item 1, Item 2, Item 3",
        "is_multi_item": True,
        "items": json.dumps(["Item 1", "Item 2", "Item 3"]),
        "starting_qty": 9,
        "remaining_qty": 9,
        "display_slice_count": 1,
        "tier": "mid",
        "wheel_color": "#F44336",
    },
    {
        "segment_number": 2,
        "display_name": "Prize Bucket B",
        "wheel_label": "Bucket B",
        "winner_message": "An item of your choice from Prize Bucket B!",
        "description": "Item 1, Item 2",
        "is_multi_item": True,
        "items": json.dumps(["Item 1", "Item 2"]),
        "starting_qty": 48,
        "remaining_qty": 48,
        "display_slice_count": 5,
        "tier": "standard",
        "wheel_color": "#00BCD4",
    },
    {
        "segment_number": 3,
        "display_name": "$50 Prize Order",
        "wheel_label": "$50 Order",
        "winner_message": "You won a $50 Prize Order!",
        "description": "$50 Prize Order",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 10,
        "remaining_qty": 10,
        "display_slice_count": 1,
        "tier": "mid",
        "wheel_color": "#FF5722",
    },
    {
        "segment_number": 4,
        "display_name": "$25 Prize Order",
        "wheel_label": "$25 Order",
        "winner_message": "You won a $25 Prize Order!",
        "description": "$25 Prize Order",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 20,
        "remaining_qty": 20,
        "display_slice_count": 2,
        "tier": "mid",
        "wheel_color": "#9C27B0",
    },
    {
        "segment_number": 5,
        "display_name": "Prize Bucket C",
        "wheel_label": "Bucket C",
        "winner_message": "An item of your choice from Prize Bucket C!",
        "description": "Item 1, Item 2",
        "is_multi_item": True,
        "items": json.dumps(["Item 1", "Item 2"]),
        "starting_qty": 17,
        "remaining_qty": 17,
        "display_slice_count": 2,
        "tier": "mid",
        "wheel_color": "#4CAF50",
    },
    {
        "segment_number": 6,
        "display_name": "Stress Ball",
        "wheel_label": "Stress Ball",
        "winner_message": "You won a Stress Ball!",
        "description": "Stress Ball",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 29,
        "remaining_qty": 29,
        "display_slice_count": 3,
        "tier": "standard",
        "wheel_color": "#FF9800",
    },
    {
        "segment_number": 7,
        "display_name": "T-Shirt",
        "wheel_label": "T-Shirt",
        "winner_message": "You won a T-Shirt!",
        "description": "T-Shirt",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 250,
        "remaining_qty": 250,
        "display_slice_count": 25,
        "tier": "standard",
        "wheel_color": "#2196F3",
    },
    {
        "segment_number": 8,
        "display_name": "Reserved Parking",
        "wheel_label": "Parking",
        "winner_message": "You won Reserved Parking!",
        "description": "Reserved Parking",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 2,
        "remaining_qty": 2,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#37474F",
    },
    {
        "segment_number": 9,
        "display_name": "Lunch with Manager A",
        "wheel_label": "Lunch A",
        "winner_message": "You won Lunch with Manager A!",
        "description": "Lunch with Manager A",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 3,
        "remaining_qty": 3,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#E91E63",
    },
    {
        "segment_number": 10,
        "display_name": "Lunch with Manager B",
        "wheel_label": "Lunch B",
        "winner_message": "You won Lunch with Manager B!",
        "description": "Lunch with Manager B",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 3,
        "remaining_qty": 3,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#FF7043",
    },
    {
        "segment_number": 11,
        "display_name": "Lunch with Manager C",
        "wheel_label": "Lunch C",
        "winner_message": "You won Lunch with Manager C!",
        "description": "Lunch with Manager C",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 3,
        "remaining_qty": 3,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#3F51B5",
    },
    {
        "segment_number": 12,
        "display_name": "Lunch with Manager D",
        "wheel_label": "Lunch D",
        "winner_message": "You won Lunch with Manager D!",
        "description": "Lunch with Manager D",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 3,
        "remaining_qty": 3,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#009688",
    },
    {
        "segment_number": 13,
        "display_name": "Lunch with Manager E",
        "wheel_label": "Lunch E",
        "winner_message": "You won Lunch with Manager E!",
        "description": "Lunch with Manager E",
        "is_multi_item": False,
        "items": None,
        "starting_qty": 3,
        "remaining_qty": 3,
        "display_slice_count": 1,
        "tier": "premium",
        "wheel_color": "#FFC107",
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Prize).count() > 0:
            print("Prizes already seeded — skipping.")
            return
        for data in PRIZES:
            db.add(Prize(**data))
        db.commit()
        print(f"Seeded {len(PRIZES)} prizes.")
    finally:
        db.close()


def sync_labels():
    """Update wheel_label for every prize from PRIZES without touching inventory."""
    label_map = {p["segment_number"]: p["wheel_label"] for p in PRIZES}
    db = SessionLocal()
    try:
        for prize in db.query(Prize).all():
            new_label = label_map.get(prize.segment_number)
            if new_label and prize.wheel_label != new_label:
                prize.wheel_label = new_label
        db.commit()
    finally:
        db.close()


def reseed():
    """Wipe and re-seed prizes (admin reset)."""
    db = SessionLocal()
    try:
        db.query(Prize).delete()
        for data in PRIZES:
            db.add(Prize(**data))
        db.commit()
        print(f"Re-seeded {len(PRIZES)} prizes.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
