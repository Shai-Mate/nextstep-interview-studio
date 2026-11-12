#!/usr/bin/env bash
# Compile the bundled iOS app without a signing identity. This does not create
# an installable IPA, signed archive, simulator test, or App Store submission.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'iOS compilation requires macOS with Xcode; this host cannot perform it.' >&2
  exit 1
fi
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo 'xcodebuild is unavailable. Install Xcode and select its Developer directory.' >&2
  exit 1
fi
if [[ ! -f ios/App/App/public/index.html ]]; then
  echo 'Bundled web assets are missing. Run npm ci and npm run native:sync first.' >&2
  exit 1
fi

expected_xcode="${MOMENTUM_XCODE_VERSION:-26.6}"
xcode_version="$(xcodebuild -version | awk 'NR==1 { print $2 }')"
if [[ "$xcode_version" != "$expected_xcode" ]]; then
  echo "Expected Xcode $expected_xcode, selected $xcode_version. Set DEVELOPER_DIR explicitly." >&2
  exit 1
fi
sdk_version="$(xcrun --sdk iphoneos --show-sdk-version)"
if [[ "${sdk_version%%.*}" -lt 26 ]]; then
  echo "An iOS 26 or newer SDK is required; selected $sdk_version." >&2
  exit 1
fi

output="${MOMENTUM_IOS_OUTPUT:-$repo_root/test-results/ios-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$output"
output="$(cd "$output" && pwd)"
if [[ -e "$output/build.log" || -e "$output/Build.xcresult" ]]; then
  echo 'Output already contains build evidence. Choose a new MOMENTUM_IOS_OUTPUT directory.' >&2
  exit 1
fi

{
  git rev-parse HEAD
  xcodebuild -version
  xcrun --sdk iphoneos --show-sdk-version
  node --version
  npm --version
  sw_vers
} > "$output/environment.txt"

xcodebuild -resolvePackageDependencies \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -clonedSourcePackagesDirPath "$output/SourcePackages" \
  2>&1 | tee "$output/package-resolution.log"

resolved=ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
if [[ -f "$resolved" ]]; then
  cp "$resolved" "$output/Package.resolved"
fi

xcodebuild build \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$output/DerivedData" \
  -clonedSourcePackagesDirPath "$output/SourcePackages" \
  -disableAutomaticPackageResolution \
  -resultBundlePath "$output/Build.xcresult" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  COMPILER_INDEX_STORE_ENABLE=NO \
  2>&1 | tee "$output/build.log"

app="$output/DerivedData/Build/Products/Release-iphoneos/App.app"
test -f "$app/App"
test -f "$app/public/index.html"
test -f "$app/PrivacyInfo.xcprivacy"
plutil -lint "$app/Info.plist" "$app/PrivacyInfo.xcprivacy" | tee "$output/bundle-validation.log"
file "$app/App" | tee -a "$output/bundle-validation.log"
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist" | tee -a "$output/bundle-validation.log"
/usr/libexec/PlistBuddy -c 'Print :MinimumOSVersion' "$app/Info.plist" | tee -a "$output/bundle-validation.log"
ditto -c -k --sequesterRsrc --keepParent "$app" "$output/Momentum-unsigned-iphoneos.zip"
echo "Unsigned iOS compile passed. Evidence: $output"
