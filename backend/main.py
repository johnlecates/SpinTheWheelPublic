import random
import csv
import io
import json
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, inspect, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, Employee, Prize, SpinHistory
from schemas import (
    SpinRequest,
    EmployeeOut,
    PrizeOut,
    PrizeCreate,
    PrizeUpdate,
    WheelSlice,
    RosterImportResult,
    StatsOut,
    AdminLoginRequest,
    AdminLoginResponse,
    ManualRosterEntryRequest,
    PrizeCSVImportResult,
    VoidWinnerRequest,
)
from seed_prizes import seed as seed_prizes_if_empty, reseed, sync_labels

Base.metadata.create_all(bind=engine)

# Idempotent migration for pre-existing databases: add the is_active column
# used to soft-remove prizes. create_all() only creates missing tables, so we
# add the column explicitly for older DBs.
_prize_columns = {c["name"] for c in inspect(engine).get_columns("prizes")}
if "is_active" not in _prize_columns:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE prizes ADD COLUMN is_active BOOLEAN DEFAULT 1"))

spin_history_columns = {c["name"] for c in inspect(engine).get_columns("spin_history")}
if "voided_at" not in spin_history_columns:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE spin_history ADD COLUMN voided_at DATETIME"))

seed_prizes_if_empty()
sync_labels()

app = FastAPI(title="SpinTheWheel API", version="1.5.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Password required to access the /admin panel.
# Override at runtime by exporting the ADMIN_PASSWORD environment variable
# (e.g. in docker-compose.yml, .env, or your shell). Changing it requires
# restarting the backend.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "spinadmin")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_wheel_layout(db: Session) -> List[WheelSlice]:
    """Build the wheel's visual slices.

    Each *active* prize gets a fixed 2 visual slices. The number of slices
    is purely cosmetic and does NOT affect the probability of winning —
    the backend's weighted-random draw uses `remaining_qty` exclusively.
    `display_slice_count` is kept on the prize record for future use but
    is currently ignored by the wheel.
    """
    prizes = db.query(Prize).filter(Prize.is_active.is_(True), Prize.remaining_qty > 0).order_by(Prize.segment_number).all()
    if not prizes:
        return []

    slices_per = 2
    num_prizes = len(prizes)
    entries: List[tuple] = []
    for j, p in enumerate(prizes):
        phase = j / (num_prizes * 2)
        for i in range(slices_per):
            pos = (i / slices_per + phase) % 1.0
            entries.append((pos, p.id, p.wheel_label, p.wheel_color))

    entries.sort(key=lambda x: x[0])
    return [WheelSlice(prize_id=pid, label=label, color=color)
            for _, pid, label, color in entries]


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/wheel/layout", response_model=List[WheelSlice])
def get_wheel_layout(db: Session = Depends(get_db)):
    return _build_wheel_layout(db)


@app.get("/employee/{agent_id}", response_model=EmployeeOut)
def get_employee(agent_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.agent_id == agent_id.strip().upper()).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in roster")
    return emp


@app.post("/spin")
def spin(request: SpinRequest, db: Session = Depends(get_db)):
    agent_id = request.agent_id.strip().upper()
    emp = db.query(Employee).filter(Employee.agent_id == agent_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in roster")
    if emp.has_spun:
        raise HTTPException(
            status_code=400,
            detail=f"{emp.name} has already spun and won: {emp.prize_won}",
        )

    prizes = db.query(Prize).filter(Prize.is_active.is_(True), Prize.remaining_qty > 0).all()
    if not prizes:
        raise HTTPException(status_code=503, detail="No prizes remaining")

    # Weighted random selection based on remaining inventory
    total_qty = sum(p.remaining_qty for p in prizes)
    pick = random.uniform(0, total_qty)
    cumulative = 0.0
    winner: Prize = prizes[-1]
    for p in prizes:
        cumulative += p.remaining_qty
        if pick <= cumulative:
            winner = p
            break

    # Persist result immediately so the audit trail is complete before animation
    now = datetime.now(timezone.utc)
    emp.has_spun = True
    emp.spin_date = now
    emp.prize_won = winner.display_name
    winner.remaining_qty -= 1

    history = SpinHistory(
        employee_id=emp.id,
        prize_id=winner.id,
        agent_id=emp.agent_id,
        employee_name=emp.name,
        prize_name=winner.display_name,
        spin_timestamp=now,
    )
    db.add(history)
    db.commit()

    return {
        "employee": {"agent_id": emp.agent_id, "name": emp.name},
        "prize": {
            "id": winner.id,
            "segment_number": winner.segment_number,
            "display_name": winner.display_name,
            "winner_message": winner.winner_message,
            "is_multi_item": winner.is_multi_item,
            "items": json.loads(winner.items) if winner.items else [],
            "tier": winner.tier,
            "wheel_color": winner.wheel_color,
        },
        "wheel_layout": [s.model_dump() for s in _build_wheel_layout(db)],
    }


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@app.post("/admin/login", response_model=AdminLoginResponse)
def admin_login(request: AdminLoginRequest):
    """Validate the admin panel password.

    Uses a constant-time comparison so the response time does not leak
    information about the password. The actual password is configured via
    the ADMIN_PASSWORD environment variable (default: 'spinadmin').
    """
    provided = (request.password or "").encode("utf-8")
    expected = ADMIN_PASSWORD.encode("utf-8")
    if hmac.compare_digest(provided, expected):
        return AdminLoginResponse(ok=True)
    raise HTTPException(status_code=401, detail="Incorrect password")


@app.post("/admin/roster/import", response_model=RosterImportResult)
async def import_roster(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()

    # Try common Windows/UTF-8 encodings; utf-8-sig strips BOM automatically
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = content.decode(enc)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    else:
        text = content.decode("latin-1")

    # Null bytes confuse SQLite; strip them
    text = text.replace("\x00", "")

    reader = csv.reader(io.StringIO(text))

    added = skipped = 0
    errors: List[str] = []
    # Track IDs added this import to handle in-file duplicates without a DB flush
    seen_this_import: set = set()

    for row_num, row in enumerate(reader, start=1):
        if not row or not any(cell.strip() for cell in row):
            continue
        if row_num == 1 and row[0].strip().lower() in ("agentid", "agent_id", "id", "agent"):
            continue
        if len(row) < 2:
            errors.append(f"Row {row_num}: need at least 2 columns (AgentID, Name)")
            continue

        agent_id = row[0].strip().upper()
        name = row[1].strip()

        if not agent_id or not name:
            errors.append(f"Row {row_num}: empty AgentID or Name")
            continue

        if agent_id in seen_this_import:
            skipped += 1
            continue

        if db.query(Employee).filter(Employee.agent_id == agent_id).first():
            skipped += 1
            continue

        seen_this_import.add(agent_id)
        db.add(Employee(agent_id=agent_id, name=name))
        added += 1

    db.commit()
    return RosterImportResult(added=added, skipped=skipped, errors=errors)


@app.get("/admin/roster", response_model=List[EmployeeOut])
def get_roster(db: Session = Depends(get_db)):
    return db.query(Employee).order_by(Employee.name).all()


@app.post("/admin/roster/manual", response_model=EmployeeOut)
def add_manual_roster_entry(
    request: ManualRosterEntryRequest,
    db: Session = Depends(get_db),
):
    """Add a single agent to the roster by ID and name.

    Use this when an arriving contestant is not in the imported roster and
    there is no time (or need) to re-import the whole CSV. Mirrors the
    validation performed during a CSV import: IDs are uppercased/trimmed,
    both fields are required, and duplicates return 409.
    """
    agent_id = (request.agent_id or "").strip().upper()
    name = (request.name or "").strip()

    if not agent_id or not name:
        raise HTTPException(
            status_code=400,
            detail="Both Agent ID and Name are required.",
        )

    if db.query(Employee).filter(Employee.agent_id == agent_id).first():
        raise HTTPException(
            status_code=409,
            detail=f"Agent {agent_id} is already in the roster.",
        )

    employee = Employee(agent_id=agent_id, name=name)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@app.get("/admin/prizes", response_model=List[PrizeOut])
def get_prizes(db: Session = Depends(get_db)):
    return db.query(Prize).order_by(Prize.segment_number).all()


@app.post("/admin/prizes", response_model=PrizeOut)
def add_prize(request: PrizeCreate, db: Session = Depends(get_db)):
    """Manually add a prize to the wheel.

    The new prize is immediately eligible with its given starting quantity, so
    it participates in the weighted draw and the other prizes' odds adjust
    accordingly (probability is weighted by remaining quantity).
    """
    name = (request.display_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Prize name is required.")

    last = db.query(Prize).order_by(Prize.segment_number.desc()).first()
    next_segment = (last.segment_number + 1) if last else 1
    qty = max(1, request.starting_qty or 1)

    prize = Prize(
        segment_number=next_segment,
        display_name=name,
        wheel_label=(request.wheel_label or name).strip(),
        winner_message=(request.winner_message or f"You won {name}!").strip(),
        description=request.description,
        is_multi_item=bool(request.is_multi_item),
        items=json.dumps(request.items) if request.items else None,
        starting_qty=qty,
        remaining_qty=qty,
        display_slice_count=max(1, request.display_slice_count or 1),
        tier=request.tier or "standard",
        wheel_color=request.wheel_color or "#2196F3",
        is_active=True,
    )
    db.add(prize)
    db.commit()
    db.refresh(prize)
    return prize


@app.delete("/admin/prizes/{prize_id}")
def remove_prize(prize_id: int, db: Session = Depends(get_db)):
    """Remove a prize from the wheel (soft delete).

    Deactivates the prize and zeroes its remaining quantity so it drops out of
    the wheel and the weighted draw. Its spin history is preserved so winners
    remain viewable, and the odds of the remaining prizes are recalculated.
    """
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")
    prize.is_active = False
    prize.remaining_qty = 0
    db.commit()
    return {"detail": f"Prize removed: {prize.display_name}"}


ALLOWED_TIERS = {"standard", "mid", "premium"}


@app.post("/admin/prizes/{prize_id}/restore")
def restore_prize(prize_id: int, db: Session = Depends(get_db)):
    """Restore a previously removed prize.

    Reactivates the prize (`is_active = True`) and restocks it to its
    original `starting_qty` so it re-enters the wheel. The admin can then
    use the Edit form to adjust the Remaining field if the restock
    quantity isn't what they want.

    Idempotent guard: if the prize is already active, returns 400.
    """
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")
    if prize.is_active is not False:
        raise HTTPException(status_code=400, detail="Prize is not removed; nothing to restore.")

    prize.is_active = True
    # Restock to starting_qty so the prize re-enters the wheel. The admin
    # can fine-tune the Remaining field via the Edit form after restoring.
    prize.remaining_qty = prize.starting_qty
    db.commit()
    return {
        "detail": f"Restored: {prize.display_name}. Restocked to {prize.remaining_qty}.",
        "prize": {
            "id": prize.id,
            "display_name": prize.display_name,
            "is_active": prize.is_active,
            "remaining_qty": prize.remaining_qty,
        },
    }


@app.put("/admin/prizes/{prize_id}", response_model=PrizeOut)
def update_prize(prize_id: int, request: PrizeUpdate, db: Session = Depends(get_db)):
    """Edit an existing prize.

    Only provided fields are changed. If `starting_qty` is reduced below the
    current `remaining_qty`, `remaining_qty` is clamped down to match (we do
    not refund past wins). `is_active` is intentionally not editable here —
    admins should use the Remove button for deactivation.
    """
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")
    if prize.is_active is False:
        raise HTTPException(
            status_code=400,
            detail="Removed prizes cannot be edited. Add a new prize instead.",
        )

    if request.display_name is not None:
        name = request.display_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Prize name cannot be empty.")
        prize.display_name = name

    if request.wheel_label is not None:
        label = request.wheel_label.strip()
        prize.wheel_label = label or prize.display_name

    if request.winner_message is not None:
        prize.winner_message = request.winner_message.strip() or f"You won {prize.display_name}!"

    if request.description is not None:
        prize.description = request.description.strip() or None

    if request.tier is not None:
        if request.tier not in ALLOWED_TIERS:
            raise HTTPException(
                status_code=400,
                detail=f"tier must be one of: {', '.join(sorted(ALLOWED_TIERS))}",
            )
        prize.tier = request.tier

    if request.wheel_color is not None:
        prize.wheel_color = request.wheel_color or prize.wheel_color

    if request.display_slice_count is not None:
        prize.display_slice_count = max(1, int(request.display_slice_count))

    # Multi-item toggle + items list. When flipping from true→false, clear items.
    if request.is_multi_item is not None:
        prize.is_multi_item = bool(request.is_multi_item)
        if not prize.is_multi_item:
            prize.items = None
    if prize.is_multi_item and request.items is not None:
        prize.items = json.dumps([s for s in (i.strip() for i in request.items) if s])

    if request.starting_qty is not None:
        new_starting = max(1, int(request.starting_qty))
        prize.starting_qty = new_starting
        # Clamp remaining_qty down if needed (cannot refund past wins)
        if prize.remaining_qty > new_starting:
            prize.remaining_qty = new_starting

    if request.remaining_qty is not None:
        # Independent adjustment: clamp to [0, starting_qty]. Applied AFTER
        # starting_qty so admins can raise both at once and have the
        # remaining value honored.
        new_remaining = max(0, min(int(request.remaining_qty), prize.starting_qty))
        prize.remaining_qty = new_remaining

    db.commit()
    db.refresh(prize)
    return prize


@app.get("/admin/prizes/{prize_id}/winners")
def get_prize_winners(
    prize_id: int,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List everyone who won a given prize, with optional name/Agent ID search."""
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")

    query = db.query(SpinHistory).filter(SpinHistory.prize_id == prize_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                SpinHistory.employee_name.ilike(like),
                SpinHistory.agent_id.ilike(like),
            )
        )
    rows = query.order_by(SpinHistory.spin_timestamp.desc()).all()
    total = (
        db.query(func.count(SpinHistory.id))
        .filter(SpinHistory.prize_id == prize_id)
        .scalar()
        or 0
    )
    return {
        "prize_id": prize_id,
        "prize_name": prize.display_name,
        "total": total,
        "winners": [
            {
                "agent_id": h.agent_id,
                "name": h.employee_name,
                "spin_timestamp": h.spin_timestamp.isoformat() if h.spin_timestamp else None,
                "voided_at": h.voided_at.isoformat() if h.voided_at else None,
            }
            for h in rows
        ],
    }


@app.post("/admin/prizes/{prize_id}/winners/{agent_id}/void")
def void_winner(
    prize_id: int,
    agent_id: str,
    request: VoidWinnerRequest,
    db: Session = Depends(get_db),
):
    """Void a single spin result and optionally restore the prize + employee.

    Effects (each gated by a flag, both default true):
      - `restore_prize`: increment the prize's remaining_qty by 1 (capped at
        starting_qty), so the prize goes back into the wheel pool.
      - `reset_employee`: clear the employee's has_spun/prize_won/spin_date
        so they can spin again (useful for testing, or for a winner who
        declines their prize).

    The SpinHistory row is marked with `voided_at` so the audit trail is
    preserved; winners stay in the list (faded) and remain searchable.
    """
    agent_id = (agent_id or "").strip().upper()
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="Prize not found")

    history = (
        db.query(SpinHistory)
        .filter(SpinHistory.prize_id == prize_id, SpinHistory.agent_id == agent_id)
        .order_by(SpinHistory.spin_timestamp.desc())
        .first()
    )
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"No spin found for Agent {agent_id} on this prize.",
        )
    if history.voided_at is not None:
        raise HTTPException(
            status_code=400,
            detail=f"This win was already voided at {history.voided_at.isoformat()}.",
        )

    history.voided_at = datetime.now(timezone.utc)

    inventory_restored = False
    if request.restore_prize:
        # Cap at starting_qty so voiding a winner of a never-spun prize can't
        # inflate inventory above the original starting count.
        if prize.remaining_qty < prize.starting_qty:
            prize.remaining_qty += 1
            inventory_restored = True
        else:
            inventory_restored = False  # already at max; no-op

    employee_reset = False
    if request.reset_employee:
        emp = db.query(Employee).filter(Employee.agent_id == agent_id).first()
        if emp:
            emp.has_spun = False
            emp.spin_date = None
            emp.prize_won = None
            employee_reset = True

    db.commit()

    return {
        "detail": f"Voided win: {history.employee_name} ({agent_id}) for {prize.display_name}.",
        "inventory_restored": inventory_restored,
        "employee_reset": employee_reset,
    }


@app.post("/admin/prizes/{prize_id}/winners/{agent_id}/unvoid")
def unvoid_winner(
    prize_id: int,
    agent_id: str,
    db: Session = Depends(get_db),
):
    """Reverse a previous void. Used for accidental clicks. Does not touch
    prize inventory or employee state — just clears the voided_at marker."""
    agent_id = (agent_id or "").strip().upper()
    history = (
        db.query(SpinHistory)
        .filter(SpinHistory.prize_id == prize_id, SpinHistory.agent_id == agent_id)
        .order_by(SpinHistory.spin_timestamp.desc())
        .first()
    )
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"No spin found for Agent {agent_id} on this prize.",
        )
    if history.voided_at is None:
        raise HTTPException(status_code=400, detail="This win is not voided.")
    history.voided_at = None
    db.commit()
    return {"detail": "Win restored."}


@app.get("/admin/history")
def get_history(db: Session = Depends(get_db)):
    rows = db.query(SpinHistory).order_by(SpinHistory.spin_timestamp.desc()).all()
    return [
        {
            "id": h.id,
            "agent_id": h.agent_id,
            "name": h.employee_name,
            "prize": h.prize_name,
            "timestamp": h.spin_timestamp.isoformat() if h.spin_timestamp else None,
            "voided_at": h.voided_at.isoformat() if h.voided_at else None,
        }
        for h in rows
    ]


@app.get("/admin/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    roster_count = db.query(func.count(Employee.id)).scalar() or 0
    prize_count = db.query(func.sum(Prize.remaining_qty)).scalar() or 0
    spun_count = db.query(func.count(Employee.id)).filter(Employee.has_spun.is_(True)).scalar() or 0
    shortage = max(0, roster_count - prize_count)
    return StatsOut(
        roster_count=roster_count,
        prize_count=prize_count,
        spun_count=spun_count,
        shortage=shortage,
        warning=shortage > 0,
    )


@app.delete("/admin/prizes/all")
def clear_all_prizes(db: Session = Depends(get_db)):
    """Wipe all prizes and their spin history. For starting a fresh event.

    This is the prize-side equivalent of "Clear Roster & History". It
    removes every prize and every SpinHistory row (so no orphans reference
    a missing prize). After calling this, the wheel is empty until the
    admin uploads a fresh CSV (or uses Re-seed).
    """
    history_count = db.query(SpinHistory).delete()
    prize_count = db.query(Prize).delete()
    db.commit()
    return {
        "detail": f"Removed {prize_count} prizes and {history_count} spin-history rows.",
        "prizes_removed": prize_count,
        "history_removed": history_count,
    }


@app.post("/admin/prizes/reset")
def reset_prizes(db: Session = Depends(get_db)):
    """Restore all prize inventory to starting quantities."""
    prizes = db.query(Prize).all()
    for p in prizes:
        p.remaining_qty = p.starting_qty
    db.commit()
    return {"detail": "Prize inventory reset to starting quantities"}


@app.post("/admin/prizes/import", response_model=PrizeCSVImportResult)
def import_prizes(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Bulk-import prizes from a CSV file.

    Headers (case-insensitive; only DisplayName and Quantity are required):
      DisplayName, Quantity, WheelLabel, Color, Tier, IsMultiItem, Items,
      WinnerMessage, Description, SliceCount

    Notes:
      - Import is **additive** — it adds to the existing prize list. Use
        "Remove All Prizes" in the Actions tab to start fresh first.
      - Tier must be one of: standard, mid, premium (default: standard).
      - Color must be a 6-digit hex like "#FF0000" (default: #2196F3).
      - Items is a comma-separated list; only used when IsMultiItem is true.
      - Blank rows and lines starting with "#" are ignored.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = file.file.read()
    try:
        csv_text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text")

    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty")

    header_idx = 0
    for i, row in enumerate(rows):
        if row and any(c.strip() for c in row) and not (row[0] or "").strip().startswith("#"):
            header_idx = i
            break
    headers = [h.strip().lower() for h in rows[header_idx]]
    col = {name: i for i, name in enumerate(headers)}

    if "displayname" not in col:
        raise HTTPException(status_code=400, detail="CSV is missing required column: DisplayName")
    if "quantity" not in col:
        raise HTTPException(status_code=400, detail="CSV is missing required column: Quantity")

    last = db.query(Prize).order_by(Prize.segment_number.desc()).first()
    next_segment = (last.segment_number + 1) if last else 1

    ALLOWED_TIERS = {"standard", "mid", "premium"}
    added = 0
    skipped = 0
    errors: List[str] = []

    for line_idx, row in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
        if not row or not any(c.strip() for c in row):
            continue
        if (row[0] or "").strip().startswith("#"):
            continue

        def cell(name):
            i = col.get(name)
            if i is None or i >= len(row):
                return ""
            return (row[i] or "").strip()

        try:
            name = cell("displayname")
            if not name:
                errors.append(f"Row {line_idx}: missing DisplayName")
                continue
            try:
                qty = int(cell("quantity") or "0")
            except ValueError:
                errors.append(f"Row {line_idx}: Quantity must be an integer")
                continue
            if qty < 1:
                errors.append(f"Row {line_idx}: Quantity must be ≥ 1")
                continue

            tier = (cell("tier") or "standard").lower()
            if tier not in ALLOWED_TIERS:
                errors.append(f"Row {line_idx}: tier '{tier}' must be one of {sorted(ALLOWED_TIERS)}")
                continue

            color = cell("color") or "#2196F3"
            if not (color.startswith("#") and len(color) == 7):
                errors.append(f"Row {line_idx}: Color must be a 7-char hex like #FF0000")
                continue

            is_multi_raw = (cell("ismultiitem") or "").lower()
            is_multi_item = is_multi_raw in ("1", "true", "yes", "y")

            items_str = cell("items")
            items_list = [s.strip() for s in items_str.split(",") if s.strip()] if is_multi_item else None

            try:
                slice_count = max(1, int(cell("slicecount") or "2"))
            except ValueError:
                slice_count = 2

            display_name = name
            wheel_label = cell("wheellabel") or display_name
            winner_message = cell("winnermessage") or f"You won {display_name}!"
            description = cell("description") or None

            prize = Prize(
                segment_number=next_segment,
                display_name=display_name,
                wheel_label=wheel_label,
                winner_message=winner_message,
                description=description,
                is_multi_item=is_multi_item,
                items=json.dumps(items_list) if items_list else None,
                starting_qty=qty,
                remaining_qty=qty,
                display_slice_count=slice_count,
                tier=tier,
                wheel_color=color,
                is_active=True,
            )
            db.add(prize)
            next_segment += 1
            added += 1
        except Exception as e:
            errors.append(f"Row {line_idx}: {e}")

    db.commit()
    return PrizeCSVImportResult(added=added, skipped=skipped, errors=errors)


@app.post("/admin/prizes/reseed")
def reseed_prizes():
    """Wipe and re-seed prize table from defaults."""
    reseed()
    return {"detail": "Prizes re-seeded from defaults"}


@app.delete("/admin/roster")
def clear_roster(db: Session = Depends(get_db)):
    """Remove all employees (event reset)."""
    db.query(SpinHistory).delete()
    db.query(Employee).delete()
    db.commit()
    return {"detail": "Roster and spin history cleared"}
