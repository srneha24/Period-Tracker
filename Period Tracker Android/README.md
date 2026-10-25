# Period Tracker Android

An Expo and React Native version of the Period Tracker app. Period records are stored locally in SQLite on the device. No server or account is required.

## Run in Expo Go

1. Use Node.js 22.13 or newer, then install the project dependencies with `npm install`.
2. Start Expo with `npx expo start`.
3. Update Expo Go on your Android phone, sign in, and scan the QR code shown in the terminal or browser. Your phone and computer should be on the same network.

Use `npm run android` to start Expo with the Android target. Expo Go runs the app without an Android Studio build.

## Features

- Browse saved period dates in the month calendar with connected range highlights and blood drop indicators. Tap an available date to log a period start, or drag across dates from start to end to record a full period. Dates in completed records are disabled to prevent accidental modifications.
- Update and delete saved periods.
- See the inclusive length of each completed period.
- Review all periods, the five most recent records, or records by start year in History.
- View recent averages based on up to six latest consecutive cycles (each adjacent start is no more than 45 days apart) and historical averages based on all saved records. Period averages use completed records. Cycle averages exclude intervals longer than 45 days.
- Keep records in the device's `period-tracker.db` SQLite database.
- Open Settings from the top-right gear to set a name and choose System, Light, or Dark appearance. System follows the device setting; both preferences are saved locally.

The date picker is provided by Expo's supported native date picker package, so it works in Expo Go.

## Build APK

Make sure you have the following installed

- JDK 17
- Android CLI

If you do not have the platform tools already installed, run the following command to install them. The version you require for your Gradle may be different than the versions set in the following example

```powershell
android sdk install "platforms;android-36" "build-tools;36.0.0"
```

Run the following commands to build the APK

```powershell
npx expo prebuild --platform android --clean
Set-Content android\local.properties "sdk.dir=C:\\Users\\<USERNAME>\\AppData\\Local\\Android\\Sdk"
cd android
.\gradlew.bat assembleRelease
```

The APK will be in `.\android\app\build\outputs\apk\release\app-release.apk`.
