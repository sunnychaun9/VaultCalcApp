# Splash Screen Architecture

## Implementation

Uses `androidx.core:core-splashscreen:1.0.1` to provide a unified splash
screen across Android 7+ (API 24) through Android 15+ (API 35).

### How it works

```
Cold start
    |
    v
SplashTheme applied (window background + icon)
    |
    v
MainActivity.onCreate()
    |-- installSplashScreen()     ← configures compat layer
    |-- super.onCreate()          ← RN initializes
    |
    v
First frame drawn
    |
    v
Splash dismissed (system fade-out ~166ms)
    |
    v
postSplashScreenTheme (AppTheme) applied
    |
    v
React Native content visible
```

### No white flash guarantee

Three layers ensure seamless color continuity:

1. **SplashTheme** sets `windowSplashScreenBackground` to `@color/splash_background`
2. **AppTheme** sets `android:windowBackground` to the same `@color/splash_background`
3. The color resource uses `-night` qualifier to match the system dark mode

The window background stays the same color from splash through RN init.
React Native's first render (calculator screen) then fills the viewport.

## File inventory

| File | Purpose |
|------|---------|
| `values/colors.xml` | `splash_background` = `#F9F9FB` (light), `ic_launcher_background` = `#1C1C1E` |
| `values-night/colors.xml` | `splash_background` = `#1C1C1E` (dark) |
| `drawable/ic_splash_foreground.xml` | Glyph vector — charcoal bars (#3A3A3C) for light bg |
| `drawable-night/ic_splash_foreground.xml` | Glyph vector — silver bars (#E5E5EA) for dark bg |
| `drawable/ic_launcher_foreground.xml` | Glyph vector — silver bars for adaptive icon (dark bg) |
| `mipmap-anydpi-v26/ic_launcher.xml` | Adaptive icon definition (foreground + background) |
| `mipmap-anydpi-v26/ic_launcher_round.xml` | Adaptive icon definition (round variant) |
| `values/styles.xml` | `SplashTheme` + updated `AppTheme` |
| `values-night/styles.xml` | Explicit dark variant of `SplashTheme` + `AppTheme` |
| `AndroidManifest.xml` | `android:theme="@style/SplashTheme"` on MainActivity |
| `MainActivity.kt` | `installSplashScreen()` before `super.onCreate()` |
| `build.gradle` | `core-splashscreen:1.0.1` dependency |
| `src/shared/components/SplashTransition.tsx` | RN overlay for seamless native→JS handoff |

## Theme structure

```
SplashTheme (parent: Theme.SplashScreen)
    |-- windowSplashScreenBackground → @color/splash_background
    |-- windowSplashScreenAnimatedIcon → @drawable/ic_splash_foreground
    |-- postSplashScreenTheme → AppTheme
         |
         v
AppTheme (parent: Theme.AppCompat.DayNight.NoActionBar)
    |-- android:windowBackground → @color/splash_background
    |-- android:editTextBackground → @drawable/rn_edit_text_material
```

## Dark mode behavior

The system dark mode setting automatically resolves the correct resources:

| Resource | Light mode | Dark mode |
|----------|-----------|-----------|
| `@color/splash_background` | `#F9F9FB` | `#1C1C1E` |
| `@drawable/ic_splash_foreground` | Charcoal bars | Silver bars |

No runtime code is needed. Android's resource qualifier system handles it.

## Version-specific behavior

| Android version | Splash mechanism | Icon display |
|-----------------|-----------------|--------------|
| 7-11 (API 24-30) | `core-splashscreen` compat — themed window background + centered icon drawable | No circular mask |
| 12+ (API 31+) | System splash API — `core-splashscreen` delegates to native implementation | Circular mask applied, icon shown within 240dp circle |

## RN transition overlay

A React Native `SplashTransition` component (`src/shared/components/SplashTransition.tsx`)
bridges the gap between the native splash dismissal and calculator readiness.

### How it works

The overlay renders on RN's first frame and is visually identical to the native splash
(same background color, View-based recreation of the icon vector). The native splash's
~166ms crossfade dissolves into this pixel-matched overlay — seamless handoff. When the
database finishes initializing, the overlay exits with a 200ms fade-through animation.

```
Cold start
    |
    v
Native splash visible (SplashTheme)
    |
    v
First RN frame drawn → native splash fades out (~166ms)
    |                   RN overlay visible (identical appearance)
    v
DB initializes → overlay animates out (200ms)
    |
    v
Calculator visible
```

### Animation spec

Both tracks run in parallel, completing in 200ms:

| Property    | From | To   | Duration | Easing            |
|-------------|------|------|----------|-------------------|
| bg opacity  | 1    | 0    | 200ms    | cubic ease-out    |
| icon opacity| 1    | 0    | 200ms    | cubic ease-out    |
| icon Y      | 0    | -8dp | 200ms    | cubic ease-out    |
| icon scale  | 1    | 0.97 | 200ms    | cubic ease-out    |

No artificial delays. Animation fires immediately when `isReady` becomes true.

### Icon recreation

The `SplashIcon` sub-component recreates the native vector using `View` elements:

- Two rounded bars (top + bottom) matching the vector path geometry
- One rotated square (diamond) centered between bars
- Dimensions computed from the 512-unit viewport scaled to 108dp
- Colors resolved using the same `themeMode` + `useColorScheme()` logic as `useThemeColors`

### Theme color mapping

| Mode  | Background | Icon    |
|-------|-----------|---------|
| Light | `#F9F9FB` | `#3A3A3C` |
| Dark  | `#1C1C1E` | `#E5E5EA` |

### Integration (App.tsx)

- Full app tree always renders (providers, NavigationContainer)
- `RootNavigator` guarded by `dbReady` to prevent premature DB access
- `SplashTransition` overlay sits on top with `zIndex: 10`, `pointerEvents="none"`
- Removed from tree after `onComplete` fires

## Performance

- Zero JS cost for native splash — runs before Hermes initializes
- No artificial delays — native splash dismisses on first draw, overlay exits immediately on DB ready
- RN overlay uses `useNativeDriver: true` — animation runs on UI thread, zero JS thread cost
- Total transition budget: ~166ms (native fade) + 200ms (overlay exit) = ~366ms worst case
- `installSplashScreen()` adds <1ms to `onCreate`
- Overlay uses static `StyleSheet` + `Animated.Value` refs — no re-render overhead

## Launcher icon

The adaptive icon (`mipmap-anydpi-v26`) overrides the legacy PNG mipmaps
on API 26+ devices. The legacy PNGs in `mipmap-hdpi` through `mipmap-xxxhdpi`
remain as fallback for API 24-25.

To generate updated legacy PNGs from the vector, use Android Studio's
Image Asset tool: right-click `res` → New → Image Asset → select
`ic_launcher_foreground.xml` as foreground, `#1C1C1E` as background.
