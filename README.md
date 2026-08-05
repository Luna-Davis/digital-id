# Digital ID - Beta

Digital ID turns a physical Kenyan national identity card into a secure digital card stored on your phone. You photograph the front and back of your ID, the app reads the fields, you confirm the result, and the card is saved encrypted on-device. The whole thing works offline.

Built with Expo SDK 57, React Native 0.86 and TypeScript.

## What it does

- Scans both sides of the ID with the camera or from your photo library.
- Extracts the fields using on-device ML Kit text recognition: surname, given name, sex, nationality, date of birth, place of birth, ID number, place of issue, date of expiry, plus the county, sub-county, division, location, sub-location and date of issue from the back.
- Crops the portrait photo from the front of the card.
- Shows a review step so you can correct anything the scanner misread before the data is saved.
- Renders a faithful digital version of the card, including the header, serial number, MRZ string and portrait.
- Locks the app with a PIN and biometrics (fingerprint or Face ID, when the device supports it).
- Stores everything encrypted on the phone. The credential file is written once and cannot be rewritten; the portrait photo can be updated.

## Privacy

There are no servers, no accounts and no analytics. Text recognition, encryption and storage all happen on the device. Production builds ship without the internet permission, so the app cannot make network calls.

## Requirements

- Node 22 (20.19 or newer).
- JDK 17 or 21 (JDK 24 breaks the native CMake build tasks).
- Android SDK with platform 36, build-tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1.
- An Android device or emulator.

The repository includes `scripts/setup-remote.sh`, an idempotent bootstrap script that installs all of the above on a clean Linux machine, with a fallback chain for each component.

## Getting started

```bash
npm ci
npx expo start
```

For a development build with the native modules:

```bash
npx expo run:android
```

## Building an APK

```bash
npx expo prebuild -p android
cd android
./gradlew assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

## Cloud builds (EAS)

```bash
eas build -p android --profile preview      # beta APK, shares a link for testers
eas build -p android --profile production   # release AAB for Google Play
```

The two profiles differ on purpose:

- `preview` keeps the internet permission, so the ML Kit OCR model can be downloaded once at runtime.
- `production` strips the internet permission and ships the OCR and barcode models at install time (Google Play delivers them). This build is fully offline.

## Project layout

- `components/IDCard/` — the digital card rendering (front, back, flip, fields).
- `components/Provision/` — camera capture, cropping and the extraction flow.
- `components/Lock/` — the PIN and biometric lock screen.
- `components/Boot/` — the boot screen and first-run provisioning.
- `components/Settings/` — the in-app settings page (license, disclaimer, privacy).
- `lib/` — credential types, encryption and on-device storage.
- `plugins/withOffline.js` — config plugin that manages the ML Kit model metadata and removes the internet permission from production manifests.

## License

This project is licensed under the GNU Affero General Public License, version 3. See the `LICENSE` file for the full text.

## Disclaimer

This application was developed with the assistance of artificial intelligence, under very strict human supervision. Every feature, line of code, configuration and security decision was reviewed, validated and approved by a human developer before release.

Your data never leaves this device. This app has no servers, no accounts, no analytics and no cloud of any kind. Everything — your ID details, portrait and lock PIN — is encrypted and stored on your phone only.

- 100% on-device processing (OCR, encryption, storage)
- No network calls made by the app itself
- Production builds ship with no internet permission
- The app works fully offline
