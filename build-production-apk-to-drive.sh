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
apk_name="${CLARITARD_APK_NAME:-claritard-production-$(date -u +%Y%m%d-%H%M%S).apk}"
dry_run=0

usage() {
  cat <<'EOF'
Build the production Android APK and store it in Documents/productivity-app-apks.

Usage:
  ./build-production-apk-to-drive.sh [--dry-run]

Configuration:
  CLARITARD_APK_OUTPUT_DIR  output directory, default: Documents/productivity-app-apks
  CLARITARD_APK_NAME        output filename, default: timestamped production name

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

if [[ ! -x "$mobile_dir/android/gradlew" ]]; then
  echo "The generated Android project is missing. Run 'cd frontend/mobile && npx expo prebuild --platform android' first." >&2
  exit 1
fi

echo "Building the production APK..."
npm --prefix "$mobile_dir" run build:android:production

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
