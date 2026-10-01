from datetime import date, timedelta
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
    last_period_start_date = None
    total_cycle_days = 0
    cycle_count = 0
    for period in results:
        total_days += period.total_days if period.total_days is not None else 0
        if last_period_start_date:
            cycle_days = (
                (period.start_date - timedelta(days=1)) - last_period_start_date
            ).days
            # Check if the cycle length is more than 50 days to indicate a gap in the records
            if cycle_days > 50:
                cycle_length = f">50 days gap in records ({cycle_days} days)"
            else:
                cycle_length = cycle_days
                total_cycle_days += cycle_days
                cycle_count += 1
        else:
            cycle_length = "First record"

        last_period_start_date = period.start_date

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


if __name__ == "__main__":
    app()
