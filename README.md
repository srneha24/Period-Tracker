# Period Tracker

A privacy-focused menstrual cycle tracking project that helps log periods, track cycle lengths, and monitor cycle statistics over time.

The project contains two client applications sharing the same core tracking logic:

- **[Period Tracker CLI](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20CLI/README.md)**: A Python command-line app using Typer, SQLModel, and PostgreSQL.
- **[Period Tracker Android](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20Android/README.md)**: A cross-platform mobile app built with React Native and Expo, storing data locally on device with SQLite.

---

## Tracking & Calculation Rules

- **Period Length**: Calculated inclusively when both start and end dates are recorded:
  $$\text{Period Length} = (\text{End Date} - \text{Start Date}) + 1 \text{ days}$$
  Ongoing records without an end date do not have a completed length yet.

- **Cycle Length**: Measured as the difference of days from the start date of the previous period to the date before the start date of the current period:
  $$\text{Cycle Length} = (\text{Current Start Date} - 1\text{ day}) - \text{Previous Start Date}$$

- **Average Metrics & Gaps**:
  - **Average Period Length**: The average duration of all completed periods (rounded up to the nearest whole day).
  - **Average Cycle Length**: The average duration across recorded cycles. Intervals with gaps greater than 50 days are flagged in history/reports and excluded from the cycle average to prevent distorted statistics.

---

## Subprojects

### 1. [Period Tracker CLI](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20CLI/README.md)

- **Tech Stack**: Python 3.13+, Typer, SQLModel, Alembic, PostgreSQL, Rich
- **Features**:
  - Add, view, and update period records.
  - Formatted tabular terminal output with color-coded period and cycle lengths.
  - Yearly and recent record filtering.
  - Automatic migration management via Alembic.

See the [CLI README](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20CLI/README.md) for database configuration and usage instructions.

### 2. [Period Tracker Android](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20Android/README.md)

- **Tech Stack**: React Native 0.86, Expo 57, TypeScript, Expo SQLite
- **Features**:
  - Fully local, offline-first storage (`period-tracker.db` SQLite).
  - Native date pickers for logging and editing periods.
  - Summary cards displaying average period length and average cycle length.
  - History view with yearly and recent filters.
  - Customizable theme (System, Light, Dark) and personalized greeting.

See the [Android README](file:///c:/Users/Neha/Documents/Programming/Period%20Tracker/Period%20Tracker%20Android/README.md) for instructions on running with Expo Go.
