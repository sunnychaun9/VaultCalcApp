# Play Store Release Checklist

## Store Listing

- [ ] App name (max 30 characters): **VaultCalc**
- [ ] Short description (max 80 characters)
- [ ] Full description (max 4000 characters)
- [ ] Privacy policy URL (required)

## Graphics

- [ ] App icon: 512x512 PNG, 32-bit, no transparency
- [ ] Feature graphic: 1024x500 PNG or JPG
- [ ] Phone screenshots: 2-8 screenshots (16:9 or 9:16)
- [ ] 7-inch tablet screenshots (optional but recommended)
- [ ] 10-inch tablet screenshots (optional but recommended)

## Categorization

- [ ] App category: Tools / Productivity
- [ ] Content rating questionnaire completed
- [ ] Target audience and content declarations

## App Content

- [ ] Ads declaration (no ads)
- [ ] App access instructions for reviewer (vault app behind auth — provide test credentials or instructions)
- [ ] Content rating submitted
- [ ] Data safety form completed

## Technical Requirements

- [ ] Signed AAB (not APK) — `./gradlew bundleProdRelease`
- [ ] Targeting API 36+
- [ ] 64-bit native libraries included (arm64-v8a)
- [ ] Deobfuscation mapping file uploaded (`app/build/outputs/mapping/prodRelease/mapping.txt`)
- [ ] ANR/crash testing completed (no crashes in basic flows)
- [ ] ProGuard/R8 minification verified (mapping.txt exists)

## Signing

- [ ] Release keystore generated:
  ```
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore android/app/release.keystore \
    -alias vaultcalc-release \
    -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] `android/signing.properties` populated with real passwords
- [ ] Keystore backed up securely (losing it = cannot update the app)
- [ ] Play App Signing enrolled (recommended — lets Google manage distribution key)

## Pre-Release Testing

- [ ] Dev debug build: `npx react-native run-android --mode=devDebug` — installs as "VaultCalc Dev"
- [ ] Prod release build: `cd android && ./gradlew assembleProdRelease` — produces signed APK
- [ ] AAB for Play Store: `cd android && ./gradlew bundleProdRelease`
- [ ] Version shows 1.0.0 / versionCode 10000
- [ ] All critical flows tested on release build (auth, vault, calculator, camera, billing)
- [ ] No JS bundle errors in release mode
- [ ] ProGuard mapping file present at `app/build/outputs/mapping/prodRelease/mapping.txt`

## Release Process

1. Bump version in `package.json` (versionCode auto-derives)
2. Build AAB: `cd android && ./gradlew bundleProdRelease`
3. Upload AAB to Play Console
4. Upload `mapping.txt` for deobfuscation
5. Fill in release notes
6. Submit for review
