# Period Tracker Android

An offline-first period tracker built with TypeScript, React Native 0.88, and
Expo SDK 58. Period records and personalisation settings are stored in the
app's local SQLite database. No account or server is required.

## Run with Expo Go

Use Node.js 22.13 or newer. From this directory, install dependencies and
start Expo:

```bash
npm install
npx expo start
```

Open Expo Go on an Android phone and scan the QR code shown in the terminal or
browser. Keep the phone and computer on the same network. To launch the
Android target from a development environment, use `npm run android`.

## Features

- **Calendar:** Browse months, tap a free date to record an ongoing period, or
  drag from its first day through its last day to draft a complete period.
  Review the dates and duration and confirm before saving. Future start dates
  and dates already covered by saved periods cannot be selected.
- **Edit and delete:** Change period dates in History. The app checks for
  invalid dates and overlap with other records. Deletion requires confirmation.
- **History:** Review all records, the five most recent records, or records
  filtered by start year. Records show period duration and a cycle length or a
  long-gap marker when the following start date is available.
- **Overview:** See recent and historical averages, estimated next period and
  ovulation dates, and a status for today. Recent averages use up to six latest
  consecutive cycles; historical averages use all records. Period averages
  include completed periods only.
- **Fertility calendar:** Past cycle dates can show an estimated five-day
  fertile window and ovulation date when both period records are complete and
  the next start is within 45 days.
- **Personalisation:** Set a name for the Overview greeting and choose System,
  Light, or Dark appearance. System follows the device setting.
- **Resources:** Open the user manual and tutorial video from Personalisation.

All averages are rounded up to a whole day. Cycle lengths are the difference
between consecutive start dates minus one day. Intervals greater than 45 days
are shown as gaps and excluded from cycle averages. Estimates use recorded
dates only, can be inaccurate, and are not medical guidance or contraception.

See the [user manual](USER_MANUAL.md) for calendar, history, prediction, and
personalisation instructions.

## Build an Android APK

For a local release build, install JDK 17 and the Android command-line tools.
Install the Android platform and build tools required by the Gradle project;
for example:

```powershell
android sdk install "platforms;android-36" "build-tools;36.0.0"
```

Generate the Android project and set the Android SDK path in
`android/local.properties` (replace `<USERNAME>` with your Windows account
name), then build the release APK:

```powershell
npx expo prebuild --platform android --clean
Set-Content android\local.properties "sdk.dir=C:\\Users\\<USERNAME>\\AppData\\Local\\Android\\Sdk"
Set-Location android
.\gradlew.bat assembleRelease
```

The APK is written to
`android\app\build\outputs\apk\release\app-release.apk`. The generated
`android` directory is a build artifact and is not the source of truth for the
Expo project.
