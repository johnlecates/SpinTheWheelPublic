from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    has_spun = Column(Boolean, default=False)
    spin_date = Column(DateTime, nullable=True)
    prize_won = Column(String, nullable=True)

    spins = relationship("SpinHistory", back_populates="employee")


class Prize(Base):
    __tablename__ = "prizes"

    id = Column(Integer, primary_key=True, index=True)
    segment_number = Column(Integer, nullable=False)
    display_name = Column(String, nullable=False)
    wheel_label = Column(String, nullable=False)
    winner_message = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_multi_item = Column(Boolean, default=False)
    items = Column(Text, nullable=True)  # JSON list stored as string
    starting_qty = Column(Integer, nullable=False)
    remaining_qty = Column(Integer, nullable=False)
    display_slice_count = Column(Integer, nullable=False)
    tier = Column(String, default="standard")  # standard | mid | premium
    wheel_color = Column(String, default="#2196F3")
    is_active = Column(Boolean, default=True)

    spins = relationship("SpinHistory", back_populates="prize")


class SpinHistory(Base):
    __tablename__ = "spin_history"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    prize_id = Column(Integer, ForeignKey("prizes.id"))
    agent_id = Column(String, nullable=False)
    employee_name = Column(String, nullable=False)
    prize_name = Column(String, nullable=False)
    spin_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    voided_at = Column(DateTime, nullable=True)

    employee = relationship("Employee", back_populates="spins")
    prize = relationship("Prize", back_populates="spins")
