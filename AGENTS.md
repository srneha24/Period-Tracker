# AGENTS.md

## Project layout and architecture

- This repository contains two independent clients; there is no shared runtime library or API.
- `Period Tracker CLI/` is a Python Typer command-line app. `main.py` defines commands and report calculations, `models.py` defines the SQLModel schema and period-length hook, and `db.py` loads configuration and creates the PostgreSQL engine. `migrations/` contains Alembic environment and version scripts.
- `Period Tracker Android/` is a single-screen-file Expo/React Native app. `App.tsx` contains UI, date/cycle calculations, SQLite initialization and access, and styles; `assets/` contains app assets. Expo configuration is in `app.json`.
- The root `README.md` documents the cycle calculation rules and links to each app's README for setup details. Follow each subproject's README for its own workflow.

## Stack and code patterns

- CLI: Python 3.13+, `uv`, Typer, SQLModel/SQLAlchemy, Alembic, PostgreSQL (`psycopg2-binary`), `python-dotenv`, and Rich. Use Python type annotations, snake_case functions/variables, and SQLModel models. Use SQLModel `Session` and `select()` for database operations; keep schema changes in Alembic migrations.
- Mobile: TypeScript with strict checking, React 19, React Native 0.86, Expo 57, Expo SQLite, `@react-native-community/datetimepicker`, and `react-native-safe-area-context`. Components/types use PascalCase; functions, variables, and database fields use camelCase or snake_case as appropriate to their current UI/SQL boundary. Styles are created with `StyleSheet.create` in `App.tsx`.
- Preserve the existing offline/local-storage model: CLI data lives in PostgreSQL; mobile data and preferences live on-device in SQLite. Do not add network/API behavior unless the feature explicitly requires it.
- Both apps calculate completed period length inclusively. Cycle length is the days from the previous start date through the day before the next start date; gaps above 50 days are flagged and excluded from averages. Keep these rules consistent across both clients.

## Setup and development commands

Run commands from the named subproject directory.

### CLI

- Install/sync dependencies: `uv sync`
- Copy `.env.example` to `.env` and set `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, and `DATABASE_PORT` for an existing PostgreSQL database.
- Apply migrations: `uv run alembic upgrade head`
- Show CLI help: `uv run python main.py --help`
- Run a command, for example: `uv run python main.py add-record`
- Add future schema changes as Alembic revisions under `migrations/versions/`; the Alembic environment imports `models.py` metadata for autogeneration.

### Android / Expo

- Use Node.js 22.13 or newer; install dependencies with `npm install`.
- Start Expo Go: `npx expo start`; start the Android target with `npm run android`.
- Package scripts also provide `npm run ios` and `npm run web`.
- The README documents the optional Android APK workflow (`expo prebuild` and Gradle); generated native folders are ignored and should not be treated as source of truth.
- SQLite schema setup is in `migrateDb` in `App.tsx`, called by `SQLiteProvider` on initialization. Make compatible schema updates there and preserve existing local data when evolving the schema.

## Data access, validation, and errors

- CLI `Period` rows are stored in the `periods` table: `id`, required `start_date`, optional `end_date`, nullable calculated `total_days`, and server-generated timezone-aware `created_at`. `before_insert`/`before_update` recomputes inclusive `total_days`; keep that derived value consistent when changing date handling. Alembic names constraints using the convention in `models.py`.
- Mobile SQLite uses `periods` (`id`, `start_date`, `end_date`, `total_days`) and `app_settings` (`key`, `value`). Use parameterized `?` placeholders with Expo SQLite query/run methods; avoid interpolating user values into SQL. Theme and name settings are stored locally.
- CLI dates use ISO `YYYY-MM-DD` input and `parse_date`; invalid values are reported through Rich and command execution returns. Missing update IDs are reported to the user. Keep interactive command parameters and prompts consistent with Typer's existing `Option(..., prompt=...)` pattern.
- Mobile prevents an end date earlier than the start date and presents that validation with `Alert`. Database reads are wrapped in `try/catch` and logged with `console.error`; follow the existing pattern when handling local read failures. There is no HTTP API or API error convention in this repository.

## Configuration and verification

- The CLI reads its five `DATABASE_*` settings from `.env` via `python-dotenv`; `.env` is ignored and must not be committed. `.env.example` documents the required names.
- Expo app identity, native plugins, icon, portrait orientation, and automatic system UI mode are configured in `Period Tracker Android/app.json`. TypeScript inherits Expo's base config with `strict: true`.
- No tests, lint scripts, or test-runner configuration are present. Do not assume a test command; verify changes with the relevant app workflow or add tests only when the project establishes that tooling.

## Feature change rules

- First identify which app(s) the feature affects; update both only when the behavior should be shared, since their implementations and databases are separate.
- Keep calculation semantics, date ordering, ongoing-period handling, filters, and 50-day gap treatment aligned with the root README and both clients' existing behavior.
- For CLI schema changes, update the SQLModel definition and create/review an Alembic migration. For mobile schema changes, update the Expo SQLite initialization/migration logic so existing installs remain usable.
- Keep sensitive tracking data local to each app's configured database. Never commit `.env`, local SQLite databases, generated native build folders, or dependency directories.
- Make changes within the relevant subproject and update its README when setup or user-facing commands change. Avoid adding dependencies or new conventions where the existing stack already provides the needed behavior.

## TypeScript Readability

- Write code for readability, not minimum line count.
- Prefer a maximum target line length of 80 characters.
- Proactively split long function calls, chained expressions, conditional expressions, and complex return statements across multiple lines.
- Use multiline formatting for objects, arrays, function arguments, and JSX when it improves readability, even when the code could technically fit on one line.
- Avoid deeply nested expressions; extract intermediate variables or small helper functions when that improves clarity.
- Do not rely on Prettier alone to decide where logical line breaks belong.
- After implementing a change, run Prettier on modified files and inspect the resulting code.
- If Prettier collapses an expression into an unreadable line, restructure the expression into smaller, meaningful parts.
- Do not introduce unnecessary abstractions solely to shorten lines.
