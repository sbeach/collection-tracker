# Mug Tracker

An iPhone-first Expo/React Native app for photographing a Starbucks mug collection and receiving
local reminders when missing location mugs may be available nearby.

The MVP is local-only: photos are processed on-device, collection data lives in SQLite, and
notifications use the phone's location without a backend or account.

## Run locally

Requirements: Node.js, Xcode, CocoaPods, and an Apple development team configured in Xcode.

```sh
npm install
npm run ios
```

`npm run ios` creates a local Expo development build. Expo Go is not enough for Apple Vision OCR
or background location. Use a physical iPhone to validate camera, Photos, and background reminders;
the simulator can cover navigation, storage, and location matching.

Useful checks:

```sh
npm test
npm run typecheck
npm run lint
npx expo-doctor
```

## How it works

- `src/data/mugs.json` is the bundled catalog. Its MVP records cover all 50 states, Nashville, and
  New York City. Availability is deliberately marked unverified until the entries are fact-checked.
- `src/lib/database.ts` imports that catalog into SQLite and stores collection items, processed
  Photos assets, settings, and daily notification history.
- `src/lib/catalog.ts` contains shared OCR normalization and city/state matching.
- `src/lib/alerts.ts` defines the Expo background-location task and local notification behavior.
- `src/providers/app-provider.tsx` refreshes the connected Photos album on launch/foreground and
  maintains the review queue.

To add inventory, give each mug a stable `id`, geographic `locationKey`, state fields, aliases for
OCR, a `seriesId`, and an explicit availability status. User photos and third-party mug artwork
must not be added to the bundled catalog without permission.

## MVP limitations

- Geographic matching indicates that a mug may be available in an area; it is not live store stock.
- iOS can suspend background work, and force-quitting the app stops continuous location updates.
- Sync, Android, worldwide inventory, automated catalog updates, art/series recognition, and
  calendar-based trip reminders are future work.
