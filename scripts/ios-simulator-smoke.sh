#!/usr/bin/env bash
# Launch the bundled app in a temporary iPhone simulator and retain a screenshot.
# This is native startup evidence, not a physical-device or accessibility test.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'The iOS simulator smoke test requires macOS with Xcode.' >&2
  exit 1
fi

output="${MOMENTUM_IOS_OUTPUT:-$repo_root/test-results/ios}"
mkdir -p "$output"
output="$(cd "$output" && pwd)"
if [[ ! -f "$output/Package.resolved" ]]; then
  echo 'Run ios-validate.sh with the same MOMENTUM_IOS_OUTPUT first.' >&2
  exit 1
fi
if [[ -e "$output/simulator-build.log" || -e "$output/SimulatorBuild.xcresult" ]]; then
  echo 'Simulator evidence already exists; select a fresh output directory and rebuild.' >&2
  exit 1
fi

xcodebuild build \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$output/DerivedDataSimulator" \
  -clonedSourcePackagesDirPath "$output/SourcePackages" \
  -disableAutomaticPackageResolution \
  -resultBundlePath "$output/SimulatorBuild.xcresult" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  COMPILER_INDEX_STORE_ENABLE=NO \
  2>&1 | tee "$output/simulator-build.log"

app="$output/DerivedDataSimulator/Build/Products/Release-iphonesimulator/App.app"
test -f "$app/App"
bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")"
xcrun simctl list runtimes --json > "$output/simulator-runtimes.json"
xcrun simctl list devicetypes --json > "$output/simulator-device-types.json"
node --input-type=module - "$output" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const output = process.argv[2];
const runtimes = JSON.parse(fs.readFileSync(path.join(output, 'simulator-runtimes.json'))).runtimes;
const types = JSON.parse(fs.readFileSync(path.join(output, 'simulator-device-types.json'))).devicetypes;
const runtime = runtimes.filter(x => x.isAvailable && x.identifier.includes('.iOS-'))
  .sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }))[0];
const deviceType = types.find(x => x.name === 'iPhone 17 Pro') || types.find(x => x.name === 'iPhone 16 Pro');
if (!runtime || !deviceType) throw new Error('A supported iPhone simulator and iOS runtime are not installed.');
fs.writeFileSync(path.join(output, 'simulator-device.json'), JSON.stringify({ runtime, deviceType }, null, 2));
JS
runtime_id="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).runtime.identifier' "$output/simulator-device.json")"
device_type="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).deviceType.identifier' "$output/simulator-device.json")"
simulator_udid="$(xcrun simctl create "Momentum CI $(date -u +%Y%m%dT%H%M%SZ)" "$device_type" "$runtime_id")"
cleanup() {
  xcrun simctl shutdown "$simulator_udid" >/dev/null 2>&1 || true
  xcrun simctl delete "$simulator_udid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

xcrun simctl boot "$simulator_udid"
xcrun simctl bootstatus "$simulator_udid" -b | tee "$output/simulator-boot.log"
xcrun simctl install "$simulator_udid" "$app"
xcrun simctl launch "$simulator_udid" "$bundle_id" | tee "$output/simulator-launch.log"
app_pid="$(awk -F ': ' 'END { print $NF }' "$output/simulator-launch.log")"
case "$app_pid" in
  ''|*[!0-9]*) echo 'Simulator launch did not return a valid process ID.' >&2; exit 1 ;;
esac
sleep 5
kill -0 "$app_pid"
ps -p "$app_pid" -o pid,etime,comm > "$output/simulator-process.txt"
xcrun simctl io "$simulator_udid" screenshot --type=png "$output/simulator-startup.png"
xcrun simctl spawn "$simulator_udid" log show --last 2m --style compact \
  --predicate 'process == "App"' > "$output/simulator-system.log" 2>&1 || true
ditto -c -k --sequesterRsrc --keepParent "$app" "$output/Momentum-unsigned-simulator.zip"
echo "Simulator app launched and remained running. Review $output/simulator-startup.png."
