# Period Tracker

Period Tracker contains two independent apps for recording period dates and
reviewing cycle history. There is no shared runtime or network service:

- [Period Tracker CLI](Period%20Tracker%20CLI/README.md) stores records in a
  PostgreSQL database you configure.
- [Period Tracker Android](Period%20Tracker%20Android/README.md) stores
  records and preferences in an on-device SQLite database and can run offline.

## Features

The CLI supports adding, editing, deleting, filtering, and viewing period
records. It reports period and cycle lengths and estimates a next period start,
ovulation date, and fertile window from recent cycle history.

The Android app provides a calendar for recording periods, history filters,
editing and deletion, recent and historical averages, cycle estimates, and
local name and appearance preferences. See the [Android user manual](Period%20Tracker%20Android/USER_MANUAL.md)
for instructions on using the mobile app.

## Tracking and calculation rules

- **Period length:** Counts both the start and end dates. An ongoing record
  has no completed length.
- **Cycle length:** Calculated as the days between consecutive start dates,
  minus one day, matching the app's reports.
- **Long gaps:** Start-date intervals greater than 45 days are marked as gaps
  and excluded from cycle averages. The Android app uses intervals of up to
  six latest consecutive cycles for recent averages and estimates.
- **Averages:** Average values are rounded up to a whole day. The Android
  app's period averages include completed records only.
- **Ovulation and fertility estimates:** Based only on recorded start dates.
  Ovulation is estimated 14 days before the next expected period; the fertile
  window is the five days before that estimate. These are estimates, not
  medical guidance or contraception.

## Subprojects

### Period Tracker CLI

Built with Python, Typer, SQLModel, Alembic, and PostgreSQL. Follow the
[CLI setup and usage guide](Period%20Tracker%20CLI/README.md).

### Period Tracker Android

Built with TypeScript, React Native, and Expo. Follow the
[Android setup and build guide](Period%20Tracker%20Android/README.md). APKs can
also be built and published to GitHub Releases with a version tag.
