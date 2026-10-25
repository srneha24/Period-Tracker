from datetime import date, datetime

from sqlalchemy import event
from sqlmodel import Column, Date, DateTime, Field, SQLModel, func

SQLModel.metadata.naming_convention = {
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Period(SQLModel, table=True):
    __tablename__ = "periods"

    id: int = Field(default=None, primary_key=True)
    start_date: date
    end_date: date | None = Field(default=None, sa_column=Column(Date, nullable=True))
    total_days: int | None = Field(default=None)
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=False
        ),
    )


@event.listens_for(Period, "before_insert")
@event.listens_for(Period, "before_update")
def calculate_total_days(mapper, connection, target: Period):
    if target.start_date and target.end_date:
        target.total_days = (target.end_date - target.start_date).days + 1
    else:
        target.total_days = None
