# Boite a Coeur mobile

Compose Multiplatform app (Android + iOS targets).

## Android dev

Open `applications/mobile` in Android Studio.

```bash
cd applications/mobile
./gradlew :androidApp:assembleDebug
```

## Emoji assets

Copy emoji frame folders from `firmware/boite-a-coeur/data/assets/icons/` into:

`androidApp/src/androidMain/assets/emojis/{folder}/f00.rgb565 ...`

Supported refs in `EmojiFrameLoader`: `emoji:1f48c`, `emoji:1f389`, `emoji:1f329`.

## Permissions

BLE scan requires location permission on some devices. Grant at runtime when prompted.
