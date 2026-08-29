#!/usr/bin/env bash
set -euo pipefail

# This is the product's release entry point. The factory's generic deployer
# first publishes maxReplicas=3 with no data volume, which exposes split SQLite
# state while the product-specific repair runs. Build in ACR, then publish one
# safe template containing the image, /data mount, and one-replica limit.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dockerfile="${DOCKERFILE:-Dockerfile}"
resource_group="${AZURE_RESOURCE_GROUP:-sociobot}"
app_name="${AZURE_CONTAINER_APP:-sf-guest-booking-confirm}"
registry="${AZURE_CONTAINER_REGISTRY:-sociobotregistry}"
public_url="${PUBLIC_URL:-https://guest-booking-confirm.sociobot.in}"
release_verify_script="${RELEASE_VERIFY_SCRIPT:-$repo_dir/scripts/verify-release.mjs}"
source_sha="$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || true)"
image_tag="${source_sha:0:12}"
image="$registry.azurecr.io/$app_name:$image_tag"

if [[ -z "$source_sha" ]]; then
  printf 'Cannot determine the source commit for release verification.\n' >&2
  exit 2
fi

if [[ ! -x "$release_verify_script" ]]; then
  printf 'Release verification script is not executable: %s\n' "$release_verify_script" >&2
  exit 2
fi

if [[ ! -f "$repo_dir/$dockerfile" ]]; then
  printf 'Dockerfile not found: %s\n' "$repo_dir/$dockerfile" >&2
  exit 2
fi

az acr build \
  --registry "$registry" \
  --image "$app_name:$image_tag" \
  --file "$dockerfile" \
  --build-arg "BUILD_SHA=$source_sha" \
  --build-arg "GIT_SHA=$source_sha" \
  --build-arg "SOURCE_COMMIT=$source_sha" \
  "$repo_dir"

PREPARE_STORAGE_ONLY=1 "$repo_dir/deploy/ensure-persistent-data.sh" "$resource_group" "$app_name"
# Do not create the new revision while an older multiple-revision deployment
# can still receive traffic. This convergence is intentionally before the
# image/template patch as well as after it.
"$repo_dir/deploy/enforce-single-replica.sh" "$resource_group" "$app_name"
"$repo_dir/deploy/apply-safe-template.sh" "$resource_group" "$app_name" "$image"
"$repo_dir/deploy/enforce-single-replica.sh" "$resource_group" "$app_name"
"$release_verify_script" "$public_url" "$source_sha"
# Make the topology checks the final deployment actions as well. This closes
# only after the live limiter probe and protects against a concurrent template
# change while verification runs.
"$repo_dir/deploy/enforce-single-replica.sh" "$resource_group" "$app_name"
SAFE_TEMPLATE_VERIFY_ONLY=1 "$repo_dir/deploy/apply-safe-template.sh" "$resource_group" "$app_name"
