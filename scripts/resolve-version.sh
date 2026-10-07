#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "${script_dir}/.." && pwd)
base_version=$(tr -d '[:space:]' < "${project_dir}/VERSION")

if [[ ! "${base_version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "VERSION must contain a semantic version in MAJOR.MINOR.PATCH form." >&2
  exit 2
fi

IFS=. read -r major minor patch <<< "${base_version}"
baseline_commit=$(git -C "${project_dir}" log --first-parent -1 --format=%H -- VERSION 2>/dev/null || true)
commits_since_baseline=0

if [[ -n "${baseline_commit}" ]]; then
  commits_since_baseline=$(git -C "${project_dir}" rev-list --first-parent --count "${baseline_commit}..HEAD")
fi

printf '%s.%s.%s\n' "${major}" "${minor}" "$((patch + commits_since_baseline))"
