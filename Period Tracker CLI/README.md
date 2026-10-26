# Period Tracker CLI

A Typer command-line app for recording period dates and reviewing cycle history.
It stores data in PostgreSQL; the app does not provide a hosted database.

## Requirements and setup

- Python 3.13 or newer
- [uv](https://docs.astral.sh/uv/)
- A PostgreSQL server and an existing database

From this directory, install dependencies:

```bash
uv sync
```

Copy `.env.example` to `.env` and fill in the database connection settings:

```dotenv
DATABASE_NAME=your_database
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

Apply the database migrations:

```bash
uv run alembic upgrade head
```

## Commands

Run `uv run python main.py --help` to see the command list. Commands prompt for
required values. Dates use `YYYY-MM-DD` format. You can also invoke a command
directly, for example `uv run python main.py add-record`.

| Command | Description |
| --- | --- |
| `hello` | Display a welcome message. |
| `show-all` | Show all records from oldest to newest. |
| `add-record` | Add a period. Leave the end date blank for an ongoing record. |
| `update-end-date` | Set or change a record's end date using its ID. |
| `delete-record` | Delete a record using its ID. |
| `show-for-year` | Show records whose start date falls in the selected year. |
| `show-recent` | Show a requested number of recent records, oldest to newest. |
| `next-period-estimate` | Estimate the next period start from recent cycles. |
| `next-ovulation-estimate` | Estimate the next ovulation date and fertile window. |

## Calculations and reports

Period length includes both the start and end dates. An ongoing period has no
completed length. Reports show cycle length for a completed period when a
following period is recorded and its start is no more than 45 days later. The
reported cycle length is the difference between those start dates minus one
day. Longer intervals are labeled as gaps and excluded from the cycle average.

The next-period estimate requires at least three consecutive qualifying
cycles (four period starts). It considers up to the latest six cycles, requires
the latest period to have started within the past 45 days, averages the cycle
lengths rounded up to a whole day, and adds that average plus one day to the
latest start date. The next-ovulation command estimates ovulation 14 days
before that predicted start and shows a five-day fertile window ending on the
estimated ovulation date. If the required recent records are unavailable, the
estimate is not shown.

Ovulation and fertile-window dates are estimates based only on period start
dates. They are not medical guidance or a reliable way to prevent pregnancy.
