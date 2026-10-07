#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "$script_dir/.." && pwd)

cd "$project_dir"
app_version=$(bash "$project_dir/scripts/resolve-version.sh")
./backend/mvnw -f backend/pom.xml clean install "-Drevision=$app_version"
docker build "$project_dir" \
  -f "$project_dir/deployment/backend.dockerfile" \
  --build-arg "APP_VERSION=$app_version" \
  -t "productivity-app:$app_version"
