# Boite a coeur - Mobile (React Native + Expo)

Cross-platform (Android + iOS) client for Boite a Coeur.
BLE provisioning, the Skia scene editor and RGB565 rasterization require
native modules, so this project runs on a **custom dev client** (Expo Go will
not work).

## Stack

- Expo SDK 57 + `expo-router` (file-based navigation in `src/app`)
- `zustand` app store (`src/store/appStore.ts`)
- `react-native-ble-plx` for BLE GATT provisioning
- `@shopify/react-native-skia` for the editor canvas + RGB565 pipeline
- `expo-secure-store` for tokens, `expo-web-browser` / `expo-linking` for OAuth
- `expo-image-picker`, `expo-file-system`, `expo-asset` for photos and emojis

## Features

- Auth (login, register, forgot password)
- BLE provisioning and device claim
- Pairing codes (link boxes between partners)
- Skia message editor (text, photos, animated emojis, fonts)
- Send now or schedule delivery
- Ephemeral messages (10 s on box, excluded from history)
- Sent history with delivery status (Reçu / Ouvert / Vu)

## Structure

- `src/app` - routes (auth gate, `(tabs)` shell, stack screens)
- `src/components` - design system + editor components
- `src/data` - API client, DTOs, BLE module, storage, legal content
- `src/domain/bacm` - BACM v1 pipeline (rgb565, packer, rasterizer, emoji loader)
- `src/store` - the single Zustand store mirroring the app state machine
- `assets/emojis` - bundled `.rgb565` / `.alpha` emoji frames

## First-time setup

```bash
cd applications/mobile-rn
npm install
node scripts/gen-emojis.js   # regenerate the bundled emoji require-map if assets change
```

Configure API base in `src/config/AppConfig.ts` (default: production URL).

## Dev client build (run by the developer, not automated)

The dev client must be built once per platform, then the JS is served by Metro.

```bash
npm install -g eas-cli
eas login

eas build --profile development --platform android
eas build --profile development --platform ios
```

Profiles are defined in `eas.json` (`development` → `developmentClient: true`).

After installing the dev client on the device:

```bash
npx expo start --dev-client
```

## Native configuration

Permissions and native metadata are declared in `app.json`:

- Android: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`
- iOS: `NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`,
  `NSPhotoLibraryUsageDescription`
- Custom scheme: `boiteacoeur://` (OAuth callback `boiteacoeur://oauth-callback`)

## Contracts

The app targets `https://boite-a-coeur.techalchemy.fr` and reproduces the REST,
BLE (service `bac1c201-...`) and BACM v1 binary contracts of the firmware and
backend. Do not change these without updating the device/backend.
