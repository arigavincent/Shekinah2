#!/usr/bin/env bash
# Build deployable artifacts without provisioning hosting or changing accounts.
set -euo pipefail
release_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
release_output="$release_root/release/artifacts"
release_stage=$(mktemp -d)
trap 'rm -rf -- "$release_stage"' EXIT
mkdir -p "$release_output" "$release_stage/api" "$release_stage/admin"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go -C "$release_root/backend" build -trimpath -ldflags='-s -w' -o "$release_stage/api/shekinah-api" ./cmd/api
cp -R "$release_root/backend/migrations" "$release_stage/api/"
cp "$release_root/backend/.env.production.example" "$release_stage/api/environment.example"
cp "$release_root/release/NATIVE_ANDROID_RELEASE.md" "$release_stage/api/RELEASE.md"
cp "$release_root/release/DEPLOYMENT_READINESS.md" "$release_stage/api/DEPLOYMENT_READINESS.md"
tar -czf "$release_output/shekinah-api-linux-amd64.tar.gz" -C "$release_stage/api" .
npm --prefix "$release_root/admin_dashboard" run build
cp -R "$release_root/admin_dashboard/.output" "$release_stage/admin/"
tar -czf "$release_output/shekinah-admin-node.tar.gz" -C "$release_stage/admin" .
"$release_root/android_app/gradlew" -p "$release_root/android_app" :app:assembleQa
cp "$release_root/android_app/app/build/outputs/apk/qa/app-qa.apk" "$release_output/shekinah-local-qa.apk"
if [[ -n "${SHEKINAH_API_BASE:-}" ]]; then
    "$release_root/android_app/gradlew" -p "$release_root/android_app" :app:assembleRelease :app:bundleRelease \
        "-PversionCode=${SHEKINAH_VERSION_CODE:-3}" "-PversionName=${SHEKINAH_VERSION_NAME:-2.0.1}"
    cp "$release_root/android_app/app/build/outputs/apk/release/app-release.apk" "$release_output/shekinah-production.apk"
    cp "$release_root/android_app/app/build/outputs/bundle/release/app-release.aab" "$release_output/shekinah-production.aab"
else
    echo 'Production Android build pending the actual HTTPS API domain. The QA APK uses localhost and the development certificate.'
fi
(cd "$release_output" && shopt -s nullglob && release_files=(*.apk *.aab *.tar.gz) && sha256sum -- "${release_files[@]}" > SHA256SUMS)
echo "Prepared artifacts: $release_output"
