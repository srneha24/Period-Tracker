from datetime import date, timedelta
from itertools import pairwise
from math import ceil

from db import engine
from models import Period
from rich import print as rprint
from rich.console import Console
from rich.table import Table
from sqlmodel import Session, select
from typer import Option, Typer

app = Typer()
console = Console()


def parse_date(date_str: str) -> bool:
    try:
        date.fromisoformat(date_str)
        return True
    except ValueError:
        return False


def print_results(results):
    table = Table(title="Period Tracker Data")
    table.add_column("ID", justify="center", style="yellow", no_wrap=True)
    table.add_column("Start Date", justify="center", style="cyan")
    table.add_column("End Date", justify="center", style="green")
    table.add_column("Period Length", justify="center", style="red")
    table.add_column("Cycle Length", justify="center", style="purple")

    total_days = 0
    total_cycle_days = 0
    cycle_count = 0
    for index, period in enumerate(results):
        total_days += period.total_days if period.total_days is not None else 0
        next_period = results[index + 1] if index + 1 < len(results) else None
        if period.end_date is None or next_period is None:
            cycle_length = "Ongoing or N/A"
        else:
            start_date_gap = (next_period.start_date - period.start_date).days
            cycle_days = start_date_gap - 1
            if start_date_gap > 45:
                cycle_length = f">45 days gap in records ({cycle_days} days)"
            else:
                cycle_length = cycle_days
                total_cycle_days += cycle_days
                cycle_count += 1

        table.add_row(
            str(period.id),
            period.start_date.strftime("%d %B %Y"),
            period.end_date.strftime("%d %B %Y") if period.end_date else "Ongoing",
            str(period.total_days) if period.total_days is not None else "N/A",
            str(cycle_length),
        )

    console.print(table)

    average_length = (
        str(ceil(total_days / len(results))) + " [bold]days[/bold]"
        if results
        else "No data available"
    )
    rprint(
        f"[red italic]Average Period Length[/red italic] 🩸: [cyan]{average_length}[/cyan]"
    )

    average_cycle_length = (
        str(ceil(total_cycle_days / cycle_count)) + " [bold]days[/bold]"
        if cycle_count > 0
        else "No data available"
    )
    rprint(
        f"[red italic]Average Cycle Length[/red italic] 🩸: [cyan]{average_cycle_length}[/cyan]"
    )


def next_period_date_prediction() -> date | None:
    minimum_cycles_to_consider = 3
    maximum_cycles_to_consider = 6
    number_of_periods_to_consider = maximum_cycles_to_consider + 1

    with Session(engine) as session:
        statement = (
            select(Period)
            .order_by(Period.start_date.desc())
            .limit(number_of_periods_to_consider)
        )
        results = session.exec(statement).all()

    if len(results) < minimum_cycles_to_consider + 1:
        rprint(
            "❌ [red]At least three consecutive cycles are needed to estimate the next period. Please add more records.[/red]"
        )
        return

    latest_period = results[0]
    days_since_last_start = (date.today() - latest_period.start_date).days
    if not 0 <= days_since_last_start <= 45:
        rprint(
            "❌ [red]The latest period must have started within the last 45 days to estimate the next period.[/red]"
        )
        return

    recent_periods = sorted(results, key=lambda period: period.start_date)
    consecutive_cycle_lengths = []
    for current_period, next_period in reversed(list(pairwise(recent_periods))):
        start_date_gap = (next_period.start_date - current_period.start_date).days
        if start_date_gap > 45:
            break
        consecutive_cycle_lengths.append(start_date_gap - 1)

    if len(consecutive_cycle_lengths) < minimum_cycles_to_consider:
        rprint(
            "❌ [red]At least three consecutive cycles, each no more than 45 days apart, are needed to estimate the next period.[/red]"
        )
        return

    cycle_lengths_to_average = consecutive_cycle_lengths[:maximum_cycles_to_consider]
    average_cycle_length = ceil(
        sum(cycle_lengths_to_average) / len(cycle_lengths_to_average)
    )
    estimated_next_start = latest_period.start_date + timedelta(
        days=average_cycle_length + 1
    )

    return estimated_next_start


@app.command()
def hello():
    rprint("🩸 [bold red]Welcome to the Period Tracker CLI![/bold red] 🩸")


@app.command()
def show_all():
    with Session(engine) as session:
        statement = select(Period).order_by(Period.start_date.asc())
        results = session.exec(statement).all()

        print_results(results)


@app.command()
def add_record(
    start_date: str = Option(..., prompt="Enter the start date (YYYY-MM-DD)"),
    end_date: str = Option(
        "", prompt="Enter the end date (YYYY-MM-DD) or leave blank if ongoing"
    ),
):
    if start_date and not parse_date(start_date):
        rprint("❌ [red]Invalid start date format. Please use YYYY-MM-DD.[/red]")
        return

    start_date = date.fromisoformat(start_date)

    if end_date and not parse_date(end_date):
        rprint("❌ [red]Invalid end date format. Please use YYYY-MM-DD.[/red]")
        return
    elif end_date:
        end_date = date.fromisoformat(end_date)
    else:
        end_date = None

    with Session(engine) as session:
        new_period = Period(start_date=start_date, end_date=end_date)
        session.add(new_period)
        session.commit()

    rprint("✅️ [green]Period added successfully![/green]")


@app.command()
def update_end_date(
    period_id: int = Option(..., prompt="Enter the ID of the period to update"),
    end_date: str = Option(..., prompt="Enter the end date (YYYY-MM-DD)"),
):
    if not parse_date(end_date):
        rprint("❌ [red]Invalid end date format. Please use YYYY-MM-DD.[/red]")
        return

    end_date = date.fromisoformat(end_date)

    with Session(engine) as session:
        period = session.get(Period, period_id)
        if not period:
            rprint(f"❌ [red]No period found with ID {period_id}.[/red]")
            return

        period.end_date = end_date
        session.add(period)
        session.commit()

    rprint("✅️ [green]End date updated successfully![/green]")


@app.command()
def delete_record(
    period_id: int = Option(..., prompt="Enter the ID of the period to delete")
):
    with Session(engine) as session:
        period = session.get(Period, period_id)
        if not period:
            rprint(f"❌ [red]No period found with ID {period_id}.[/red]")
            return

        session.delete(period)
        session.commit()

    rprint("✅️ [green]Period deleted successfully![/green]")


@app.command()
def show_for_year(
    year: int = Option(..., prompt="Enter the year (YYYY) to filter records")
):
    with Session(engine) as session:
        statement = (
            select(Period)
            .where(Period.start_date.between(f"{year}-01-01", f"{year}-12-31"))
            .order_by(Period.start_date.asc())
        )
        results = session.exec(statement).all()

    if not results:
        rprint(f"❌ [red]No records found for the year {year}.[/red]")
        return

    print_results(results)

    rprint(
        f"[italic red]Total Periods Recorded In {year}[/italic red] 🩸: [cyan]{len(results)}[/cyan]"
    )


@app.command()
def show_recent(
    count: int = Option(..., prompt="Enter the number of recent records to display")
):
    with Session(engine) as session:
        statement = select(Period).order_by(Period.start_date.desc()).limit(count)
        results = session.exec(statement).all()

    if not results:
        rprint("❌ [red]No records found.[/red]")
        return

    print_results(list(reversed(results)))


@app.command()
def next_period_estimate():
    estimated_next_start = next_period_date_prediction()

    if estimated_next_start is None:
        return

    rprint(
        f"[italic red]Estimated Next Period Start Date[/italic red] 🩸: [cyan]{estimated_next_start.strftime('%d %B %Y')}[/cyan]"
    )


@app.command()
def next_ovulation_estimate():
    estimated_next_start = next_period_date_prediction()
    
    if estimated_next_start:
        estimated_next_ovulation = estimated_next_start - timedelta(days=14)
        rprint(
            f"[italic red]Estimated Next Ovulation Date[/italic red] 🩸: [cyan]{estimated_next_ovulation.strftime('%d %B %Y')}[/cyan]"
        )

        fertile_window_start = estimated_next_ovulation - timedelta(days=5)
        rprint(
            f"[italic red]Estimated Fertile Window[/italic red] 🩸: [cyan]{fertile_window_start.strftime('%d %B %Y')}[/cyan] to [cyan]{estimated_next_ovulation.strftime('%d %B %Y')}[/cyan]"
        )


if __name__ == "__main__":
    app()
