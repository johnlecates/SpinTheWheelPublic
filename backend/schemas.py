from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SpinRequest(BaseModel):
    agent_id: str


class EmployeeOut(BaseModel):
    agent_id: str
    name: str
    has_spun: bool
    prize_won: Optional[str] = None
    spin_date: Optional[datetime] = None
    model_config = {"from_attributes": True}


class PrizeOut(BaseModel):
    id: int
    segment_number: int
    display_name: str
    wheel_label: str
    winner_message: str
    description: Optional[str] = None
    is_multi_item: bool
    items: Optional[str] = None
    starting_qty: int
    remaining_qty: int
    display_slice_count: int
    tier: str
    wheel_color: str
    is_active: bool = True
    model_config = {"from_attributes": True}


class PrizeCreate(BaseModel):
    display_name: str
    wheel_label: Optional[str] = None
    winner_message: Optional[str] = None
    description: Optional[str] = None
    is_multi_item: bool = False
    items: Optional[List[str]] = None
    starting_qty: int = 1
    display_slice_count: int = 1
    tier: str = "standard"
    wheel_color: str = "#2196F3"


class PrizeUpdate(BaseModel):
    """Editable subset of a prize. All fields are optional; only provided
    fields are changed. `is_active` is intentionally NOT editable here —
    admins should use the Remove button (soft delete) for deactivation.

    `remaining_qty` can be adjusted independently (e.g. more prizes were
    delivered, or some were lost/broken). It is clamped to [0, starting_qty].
    """
    display_name: Optional[str] = None
    wheel_label: Optional[str] = None
    winner_message: Optional[str] = None
    description: Optional[str] = None
    is_multi_item: Optional[bool] = None
    items: Optional[List[str]] = None
    starting_qty: Optional[int] = None
    remaining_qty: Optional[int] = None
    display_slice_count: Optional[int] = None
    tier: Optional[str] = None
    wheel_color: Optional[str] = None


class WheelSlice(BaseModel):
    prize_id: int
    label: str
    color: str


class SpinResponse(BaseModel):
    employee: EmployeeOut
    prize: dict
    wheel_layout: List[WheelSlice]


class RosterImportResult(BaseModel):
    added: int
    skipped: int
    errors: List[str]


class StatsOut(BaseModel):
    roster_count: int
    prize_count: int
    spun_count: int
    shortage: int
    warning: bool


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    ok: bool


class ManualRosterEntryRequest(BaseModel):
    agent_id: str
    name: str


class PrizeCSVImportResult(BaseModel):
    """Outcome of a prize CSV import."""
    added: int
    skipped: int
    errors: List[str]


class VoidWinnerRequest(BaseModel):
    """Request body for voiding a single winner.

    `restore_prize` (default true) increments the prize's remaining_qty by 1 so
    it goes back into the pool. `reset_employee` (default true) clears the
    employee's has_spun/prize_won so they can spin again — useful for testing
    and for the rare case where a winner declines their prize.
    """
    restore_prize: bool = True
    reset_employee: bool = True
