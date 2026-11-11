# iOS compilation and signing handoff

The `Momentum iOS compile` workflow compiles an **unsigned Release build for a generic iOS device**. It does not sign, install, archive, export an IPA, or upload anything to Apple. A green run closes the native compilation check only; retain its run URL and artifacts as evidence. Until that run has completed, compilation remains unverified.

## Repeat the CI build

The workflow uses GitHub's `macos-26` runner and explicitly selects Xcode **26.6** at `/Applications/Xcode_26.6.app/Contents/Developer`. This version is listed in the [official runner inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md), checked November 10, 2026; its iOS SDK is 26.5. The script fails rather than silently using a different Xcode. GitHub periodically updates runner images, so review the workflow's toolchain pin deliberately when that version is removed.

On a Mac with that toolchain:

```bash
export DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer
npm ci
npm run native:sync
bash scripts/ios-validate.sh
```

To select another reviewed Xcode version, set both `DEVELOPER_DIR` and `MOMENTUM_XCODE_VERSION`. The script requires an iOS SDK of at least 26. Local results default to a new timestamped directory under `test-results/`; `MOMENTUM_IOS_OUTPUT` can select a different directory. Existing build evidence is not overwritten.

The shared `App` scheme is committed. Capacitor is configured to generate its Swift package using tools version 6.0: the iOS 18 platform constant requires PackageDescription 6.0 or newer. This setting is retained on every native sync. JavaScript dependencies come from `package-lock.json`; Swift package resolution is saved with the build evidence. CI artifacts contain the environment/toolchain record, package-resolution log, `Package.resolved`, build log, Xcode result bundle, bundle checks, and a zipped **unsigned** `App.app`. The zip is for inspection and cannot be installed on a normal iPhone as a signed distribution build.

## Verify the result

- [ ] The workflow ran for the intended commit and finished successfully, not merely queued or skipped.
- [ ] `environment.txt` records the intended commit, Xcode 26.6, and iOS SDK 26.5 or the explicitly reviewed replacement.
- [ ] `build.log` ends in `BUILD SUCCEEDED`; inspect warnings and the Xcode result bundle.
- [ ] Bundle checks find the executable, packaged `public/index.html`, and `PrivacyInfo.xcprivacy`; the identifier and minimum OS match the chosen app record and supported devices.
- [ ] Review `Package.resolved` and framework/privacy manifests after dependency changes. Retain the resolution file with the release source for repeatable future builds.
- [ ] Run the separate physical-device and TestFlight checks in [release.md](release.md). Compilation alone does not verify keyboard behavior, native file picking/sharing, offline launch, VoiceOver, or App Review acceptance.

## Signed archive on the owner's Mac

Use the verified source revision and a Prism-owned Apple Developer account. Confirm the permanent bundle identifier first; `com.prism.momentum` is provisional. Select the owner's signing team in Xcode, configure a monotonically increasing build number, and use **Product → Archive** with the generic iOS device destination. The committed shared scheme's Archive action uses Release.

A command-line archive can use an externally supplied team ID without storing it in source:

```bash
: "${MOMENTUM_APPLE_TEAM_ID:?Set the Prism Apple Developer team ID in this shell}"
xcodebuild archive \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/test-results/Momentum.xcarchive" \
  DEVELOPMENT_TEAM="$MOMENTUM_APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic
```

This requires valid signing credentials and provisioning on that Mac; it intentionally does not import credentials or authorize provisioning changes. If Xcode needs to register or download signing assets, complete that through the owner's account in Xcode. Do not put certificates, passwords, private keys, App Store Connect keys, or provisioning profiles in Git. The CI workflow above neither needs nor receives those secrets.

Use Organizer to validate the signed archive, review export compliance and privacy warnings, and export for App Store Connect. If command-line export is needed, use an owner-reviewed `ExportOptions.plist` kept outside the repository:

```bash
: "${MOMENTUM_EXPORT_OPTIONS_PLIST:?Set the path to the reviewed export options file}"
xcodebuild -exportArchive \
  -archivePath "$PWD/test-results/Momentum.xcarchive" \
  -exportPath "$PWD/test-results/ios-export" \
  -exportOptionsPlist "$MOMENTUM_EXPORT_OPTIONS_PLIST"
```

Archive creation, signature verification, Organizer validation, TestFlight installation and App Store submission are separate checks. Record their actual results; do not infer them from the unsigned CI build.
