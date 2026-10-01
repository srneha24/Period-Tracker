# Period Tracker CLI

A command-line app for recording menstrual periods and viewing period history. It stores records in PostgreSQL and reports period lengths and time between records.

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

The app calculates the inclusive period length when both dates are available. Ongoing records have no calculated length yet. Reports show the average recorded period length and, when there is more than one record, the average days between periods. Gaps longer than 50 days are marked in the report.
