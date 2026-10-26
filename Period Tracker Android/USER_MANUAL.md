# Period Tracker User Manual

Period Tracker is an on-device journal for recording period dates and viewing
cycle estimates. You do not need an account, and your records and preferences
are stored in the app's local database on your device.

## Get started

Open the app and select **Calendar** from the bottom navigation. You can record
a period in either of these ways:

- **Record a start date:** Tap an available date. Review the date in the
  confirmation dialog, then choose **Save**. The record is marked as ongoing
  until you add an end date.
- **Record a complete period:** Press and drag across the calendar from the
  first day through the last day. Review the dates and inclusive duration, then
  choose **Save record**.

Dates in the future cannot be used as period starts. A date already covered by
a saved period is unavailable for a new record.

## Calendar

Use the arrows beside the month name to move between months. When viewing a
different month, tap **Today** to return to the current month.

The calendar legend explains the markings:

- 🩸 **Period:** A saved period date. The first and last dates are included.
- 🌸 **Fertile:** An estimated five-day window before an estimated ovulation
  day.
- 🥚 **Ovulation:** An estimated ovulation date.

The calendar also uses a small dot to mark today's date when no period or
fertility symbol is shown on that date. A purple outline marks an estimated
ovulation date.

Tap an available date to enter a period start, or drag across dates to enter a
complete period. Confirm or cancel the proposed dates in the dialog before
they are saved.

## History

Open **History** to review saved records. Use **All**, **Recent 5**, or a year
filter to narrow the list. Each record shows its start and end date, period
duration, and cycle length when one can be calculated. An ongoing record has
no end date or completed duration yet.

Choose **Edit** on a record to change its dates. The app checks that dates are
valid and do not overlap another record. Use the delete button to remove a
record; confirm the deletion when prompted.

## Overview and averages

The **Overview** screen shows recent averages, predictions, historical
averages, and a short status for today.

- **Today badge:** The symbols show the current estimate:
  - 🩸 Today falls within a period recorded in the app, or within the
    predicted period dates.
  - 🌸 Today is in the estimated fertile window.
  - 🥚 Today is the estimated ovulation day.
  - 😎 None of those period or fertility dates apply today, and predictions
    are available.
  - 🤷‍♀️ The app cannot currently make predictions, so it cannot show a cycle
    status for today.

Recent and historical averages are shown below the predictions:

- **Recent averages** use up to the six latest consecutive cycles, ending at
  the latest record. A gap over 45 days breaks the consecutive sequence.
- **Historical averages** use all saved records. Period averages include
  completed periods only. Cycle averages skip gaps over 45 days.
- Period duration counts both the start and end dates. The cycle length shown
  in History is calculated from the days between consecutive start dates,
  minus one day. Gaps over 45 days are shown as gaps rather than cycle lengths.

## How predictions are made

Predictions use the dates you have recorded; the app does not use symptoms,
temperature, or other health measurements.

1. The app orders your period starts from newest to oldest and looks at up to
   six recent cycle intervals.
2. It needs at least **three consecutive intervals**, which means at least
   four period start dates. Each interval must be no more than 45 days from one
   start to the next. For each interval, the app subtracts one day from the
   number of days between the two start dates.
3. It averages those values and rounds the result up to a whole day. To
   estimate the next start, it adds the average plus one day to your latest
   start date.
4. Estimated ovulation is set to 14 days before the predicted next period
   start.

Predictions are hidden when there are too few qualifying cycles, or when the
latest recorded period started more than 45 days ago (or is dated in the
future). The Overview explains why an estimate is unavailable. Predictions
are estimates and can be inaccurate; they are not a diagnosis or a reliable
way to prevent pregnancy. The fertile and ovulation markings shown for past
cycles are also estimates based on the recorded dates.

## Personalisation

Open **Personalisation** using the button at the top right of the app. Enter a
name and choose **Save Name** to change the greeting on Overview. Under
**Appearance**, choose **System**, **Light**, or **Dark**. System follows your
device's appearance setting. These preferences are stored on your device.

## Your data

Period records and personalisation settings are kept in the app's local SQLite
database on your device. The app does not require a server or account to use.
Uninstalling the app or clearing its storage may remove local records, so keep
your device data safe.
