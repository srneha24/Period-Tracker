# Period Tracker Android

An Expo and React Native version of the Period Tracker app. Period records are stored locally in SQLite on the device. No server or account is required.

## Run in Expo Go

1. Use Node.js 22.13 or newer, then install the project dependencies with `npm install`.
2. Start Expo with `npx expo start`.
3. Update Expo Go on your Android phone, sign in, and scan the QR code shown in the terminal or browser. Your phone and computer should be on the same network.

Use `npm run android` to start Expo with the Android target. Expo Go runs the app without an Android Studio build.

## Features

- Add periods by choosing a start date and optional end date in the native date picker.
- Update and delete saved periods.
- See the inclusive length of each completed period.
- Review all periods, the five most recent records, or records by start year.
- View average completed period length and average cycle length (calculated as the difference of days from the previous period's start date to the date before the current period's start date). Gaps over 50 days are excluded from the cycle average and flagged in the history list.
- Keep records in the device's `period-tracker.db` SQLite database.
- Open Settings from the top-right gear to set a name and choose System, Light, or Dark appearance. System follows the device setting; both preferences are saved locally.

The date picker is provided by Expo's supported native date picker package, so it works in Expo Go.
