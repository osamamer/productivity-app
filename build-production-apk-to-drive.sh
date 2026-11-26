#!/usr/bin/env bash

set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mobile_dir="$repo_root/frontend/mobile"
apk_path="$mobile_dir/android/app/build/outputs/apk/release/app-release.apk"
documents_dir=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  documents_dir=$(xdg-user-dir DOCUMENTS 2>/dev/null || true)
fi
documents_dir="${documents_dir:-${HOME:?HOME must be set}/Documents}"
output_dir="${CLARITARD_APK_OUTPUT_DIR:-$documents_dir/productivity-app-apks}"
apk_name="${CLARITARD_APK_NAME:-}"
dry_run=0

usage() {
  cat <<'EOF'
Build the production Android APK and store it in Documents/productivity-app-apks.

Usage:
  ./build-production-apk-to-drive.sh [--dry-run]

Configuration:
  CLARITARD_APK_OUTPUT_DIR  output directory, default: Documents/productivity-app-apks
  CLARITARD_APK_NAME        output filename, default: timestamped production name
  CLARITARD_KDECONNECT_DEVICE  paired device name; auto-selects the only paired device

Examples:
  ./build-production-apk-to-drive.sh
  CLARITARD_APK_OUTPUT_DIR='/tmp/apks' ./build-production-apk-to-drive.sh
  ./build-production-apk-to-drive.sh --dry-run
EOF
}

on_error() {
  echo "Production APK build/store failed at line $1." >&2
}

trap 'on_error "$LINENO"' ERR

for argument in "$@"; do
  case "$argument" in
    --dry-run)
      dry_run=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $argument" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v npm >/dev/null 2>&1 || {
  echo "npm is required to build the mobile app." >&2
  exit 1
}

if [[ ! -d "$mobile_dir/node_modules" ]]; then
  echo "Mobile dependencies are missing. Run 'cd frontend/mobile && npm install' first." >&2
  exit 1
fi

# Match CI's versionCode (commit count) so the APK installs over Obtainium builds;
# Android rejects a lower versionCode as "App not installed".
commit_count=$(git -C "$repo_root" rev-list --count HEAD)
# Uncommitted previews need to install over the APK published for the current commit.
if ! git -C "$repo_root" diff --quiet HEAD -- frontend/mobile frontend/shared; then
  commit_count=$((commit_count + 1))
fi
export ANDROID_VERSION_CODE="${ANDROID_VERSION_CODE:-$commit_count}"
base_version=$(node -e 'process.stdout.write(require(process.argv[1]).expo.version)' "$mobile_dir/app.json")
apk_name="${apk_name:-claritard-production-${base_version}-${ANDROID_VERSION_CODE}.apk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.daemon=false -Dorg.gradle.workers.max=2"
export CMAKE_BUILD_PARALLEL_LEVEL=2

echo "Building the production APK (versionCode $ANDROID_VERSION_CODE)..."
nice -n 10 npm --prefix "$mobile_dir" run build:android:production

if [[ ! -s "$apk_path" ]]; then
  echo "The Gradle build completed but no APK was found at: $apk_path" >&2
  exit 1
fi

if (( dry_run == 1 )); then
  echo "Dry run: would copy $apk_path to ${output_dir%/}/$apk_name"
  exit 0
fi

mkdir -p "$output_dir"
output_path="${output_dir%/}/$apk_name"
echo "Storing $apk_path in $output_path..."
cp -- "$apk_path" "$output_path"

echo "Stored production APK: $output_path"

command -v kdeconnect-cli >/dev/null 2>&1 || {
  echo "kdeconnect-cli is required to send the APK to the phone." >&2
  exit 1
}

device="${CLARITARD_KDECONNECT_DEVICE:-}"
if [[ -z "$device" ]]; then
  mapfile -t devices < <(kdeconnect-cli --list-devices --name-only 2>/dev/null)
  if (( ${#devices[@]} != 1 )); then
    echo "Set CLARITARD_KDECONNECT_DEVICE to the paired phone name or ID; found ${#devices[@]} paired devices." >&2
    exit 1
  fi
  device="${devices[0]}"
fi

echo "Sending APK to KDE Connect device: $device"
kdeconnect-cli --name "$device" --share "$output_path"
echo "Sent production APK to $device"
