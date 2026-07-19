# iOS app

The shared Compose Multiplatform module includes `iosX64`, `iosArm64`, and `iosSimulatorArm64` targets.

Build requires macOS with Xcode:

```bash
cd applications/mobile
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

Create an Xcode project that embeds the shared framework, or use the Kotlin Multiplatform Mobile plugin in Android Studio on Mac.

Deep links: `boiteacoeur://invite/{token}` and Associated Domains for `boite-a-coeur.fr`.
