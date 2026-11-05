# AUSTWise Android floating bubble

A minimal Android app that draws the AUSTWise chat head **over every app** —
Instagram, YouTube, games, home screen — using the `SYSTEM_ALERT_WINDOW`
("display over other apps") permission. This is the only way to get a real
Messenger-style chat head on a phone; a website or PWA cannot do it.

## Build

The Gradle wrapper is already committed (`gradlew`, `gradlew.bat`,
`gradle/wrapper/gradle-wrapper.jar`, `gradle-wrapper.properties` → Gradle 8.9),
so nothing needs installing except a JDK 17:

```bash
cd android-overlay
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

APK lands in `app/build/outputs/apk/debug/app-debug.apk`. You can also just open
the folder in Android Studio and press Run.

If `local.properties` is missing, create it with `sdk.dir=<path to Android SDK>`
(Android Studio writes it automatically).

## Use

1. Open **AUSTWise Bubble** from the app drawer.
2. Tap **Allow display over other apps** → enable the toggle in Android settings.
3. Come back, tap **Start floating bubble**.
4. Drag the bubble anywhere; tap it to open AUSTWise.
5. Stop it from the app screen, or the notification's **Stop** action.

## Notes

- `BubbleService` is a foreground service (`specialUse` subtype), so Android
  keeps it alive while other apps are in front; a persistent notification is
  required by the platform.
- The bubble is a plain `WindowManager` overlay with no AndroidX/Compose
  dependency, so the APK stays tiny.
- Change `SITE` in `BubbleService.kt` to point elsewhere.
- Body text is drawn with the dark disc + white "AW" + amber rule, matching the
  in-app bubble; swap in a real drawable if you want the exact SVG.
