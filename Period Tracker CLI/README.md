# Period Tracker CLI

A command-line app for recording menstrual periods and viewing period history. It stores records in PostgreSQL and reports period lengths and cycle lengths.

## Setup

1. Install the project dependencies with [uv](https://docs.astral.sh/uv/):

   ```bash
   uv sync
   ```

2. Copy `.env.example` to `.env` and set the PostgreSQL connection values:

   ```dotenv
   DATABASE_NAME=your_database
   DATABASE_USER=your_user
   DATABASE_PASSWORD=your_password
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   ```

3. Make sure the database exists and apply the migrations:

   ```bash
   uv run alembic upgrade head
   ```

## Usage

Run the CLI with:

```bash
uv run python main.py --help
```

Commands prompt for any required values. Dates use `YYYY-MM-DD` format.

| Command | What it does |
| --- | --- |
| `hello` | Display a welcome message. |
| `show-all` | Show all records in start-date order, oldest first. |
| `add-record` | Add a record. Leave the end date blank if the period is ongoing. |
| `update-end-date` | Set or change a record's end date by its ID. |
| `show-for-year` | Show records whose start date falls within the selected year. |
| `show-recent` | Show the requested number of most recent records, displayed oldest to newest. |

For example, to add a record, run `uv run python main.py add-record` and enter the prompted start date and optional end date.

The app calculates the inclusive period length when both dates are available. Ongoing records have no calculated length yet. In reports, a cycle length is shown on a completed period when a following period starts within 45 days of its start date. It is calculated from that period's start date through the day before the following start date. If the next start is more than 45 days away, the report marks a gap; records without an end date or a following period show `N/A`. Gaps are excluded from the average cycle length.
